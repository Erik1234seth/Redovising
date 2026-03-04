'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface ParsedTransaction {
  id: string;
  row_number: number;
  booking_date: string;
  transaction_date: string;
  description: string;
  reference: string;
  amount: number;
  balance: number;
  note: string | null;
  is_eu_transaction: boolean;
  is_private: boolean;
  is_business_expense: boolean;
  is_business: boolean;
  category: string | null;
}

interface TransactionSummary {
  totalCount: number;
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  euTransactionCount: number;
  privateCount: number;
}

export default function ReviewTransactionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;
  useTrackStep('review-transactions', packageType, bankId, user?.id);

  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [groupNoteText, setGroupNoteText] = useState('');
  const [hasSeparateAccount, setHasSeparateAccount] = useState<boolean>(true);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [showNoBusinessWarning, setShowNoBusinessWarning] = useState<boolean>(false);

  // Ref to prevent double parsing (React StrictMode runs useEffect twice)
  const hasStartedParsing = useRef(false);
  const hasInitializedBusinessStatus = useRef(false);

  // Load qualification answers to check if user has separate account
  useEffect(() => {
    const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
    console.log('🔍 Qualification answers from sessionStorage:', answersStr);
    if (answersStr) {
      const answers = JSON.parse(answersStr);
      const hasAccount = answers.hasSeparateAccount !== false;
      console.log('🔍 hasSeparateAccount value:', answers.hasSeparateAccount, '→ setting state to:', hasAccount);
      setHasSeparateAccount(hasAccount);
    } else {
      console.log('🔍 No qualification answers found, defaulting to hasSeparateAccount = true');
      setHasSeparateAccount(true);
    }
  }, [packageType]);

  // Total steps: 9 for all, except ne-bilaga first year = 8
  const [totalSteps, setTotalSteps] = useState(9);

  useEffect(() => {
    const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
    if (answersStr) {
      const answers = JSON.parse(answersStr);
      if (packageType !== 'komplett' && answers.isFirstYear === true) {
        setTotalSteps(8);
      } else {
        setTotalSteps(9);
      }
    } else {
      setTotalSteps(9);
    }
  }, [packageType]);

  // Show tooltip when page loads
  useEffect(() => {
    if (!loading && transactions.length > 0) {
      setShowTooltip(true);
    }
  }, [loading, transactions.length]);

  // Protect route - require authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/review-transactions?bank=${bankId}`);
    }
  }, [user, authLoading, router, packageType, bankId]);

  // Get order ID and parse the uploaded file
  useEffect(() => {
    const initializeTransactions = async () => {
      // Prevent double execution (React StrictMode)
      if (hasStartedParsing.current) {
        console.log('🔍 Review Transactions: Already parsing, skipping...');
        return;
      }
      hasStartedParsing.current = true;

      const id = sessionStorage.getItem('tempOrderId');
      const fileUrl = sessionStorage.getItem('statementFileUrl');

      console.log('🔍 Review Transactions: Order ID:', id);
      console.log('🔍 Review Transactions: File URL:', fileUrl);

      if (id) {
        setOrderId(id);

        if (fileUrl) {
          // Always parse the file fresh - never use cached transactions
          console.log('🔍 Review Transactions: Parsing file...');
          await parseUploadedFile(id);
        } else {
          console.log('🔍 Review Transactions: No file URL found');
          setError('Ingen fil hittades. Gå tillbaka och ladda upp ditt kontoutdrag först.');
          setLoading(false);
        }
      } else {
        setError('Ingen order hittades. Gå tillbaka och ladda upp ditt kontoutdrag först.');
        setLoading(false);
      }
    };

    initializeTransactions();
  }, []);

  const fetchTransactions = async (orderId: string): Promise<boolean> => {
    try {
      console.log('🔍 Fetching transactions for order:', orderId);
      const response = await fetch(`/api/parsed-transactions?orderId=${orderId}`);
      const data = await response.json();
      console.log('🔍 Fetch response:', response.status, data);

      if (response.ok && data.transactions && data.transactions.length > 0) {
        console.log('🔍 Found', data.transactions.length, 'transactions');
        setTransactions(data.transactions);
        setSummary(data.summary);
        setLoading(false);
        return true;
      }
      console.log('🔍 No transactions found');
      return false;
    } catch (err) {
      console.error('🔍 Error fetching transactions:', err);
      return false;
    }
  };

  // Fetch only the latest batch of transactions (by created_at)
  const fetchLatestTransactions = async (orderId: string): Promise<void> => {
    try {
      console.log('🔍 Fetching latest transactions for order:', orderId);
      const response = await fetch(`/api/parsed-transactions?orderId=${orderId}&latest=true`);
      const data = await response.json();
      console.log('🔍 Fetch response:', response.status, data);

      if (response.ok && data.transactions && data.transactions.length > 0) {
        console.log('🔍 Found', data.transactions.length, 'latest transactions');

        // Check if user has separate account from sessionStorage
        const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
        const userHasSeparateAccount = answersStr
          ? JSON.parse(answersStr).hasSeparateAccount !== false
          : true;

        // If user doesn't have separate account, set all is_business to false locally
        // (without making API calls - user will select which ones are business)
        let transactions = data.transactions;
        if (!userHasSeparateAccount) {
          transactions = data.transactions.map((t: ParsedTransaction) => ({ ...t, is_business: false }));
        }

        setTransactions(transactions);
        setSummary(data.summary);
      }
      setLoading(false);
    } catch (err) {
      console.error('🔍 Error fetching transactions:', err);
      setLoading(false);
    }
  };

  const parseUploadedFile = async (orderId: string) => {
    setParsing(true);
    setError('');

    try {
      // Get the file URL from sessionStorage
      const fileUrl = sessionStorage.getItem('statementFileUrl');
      console.log('📄 Parsing file from URL:', fileUrl);

      if (!fileUrl) {
        setError('Ingen fil hittades. Gå tillbaka och ladda upp ditt kontoutdrag först.');
        setLoading(false);
        setParsing(false);
        return;
      }

      // Fetch the file from Supabase Storage
      console.log('📄 Fetching file from Supabase...');
      const fileResponse = await fetch(fileUrl);
      console.log('📄 File fetch response:', fileResponse.status);
      if (!fileResponse.ok) {
        throw new Error('Could not fetch uploaded file');
      }

      const fileBlob = await fileResponse.blob();
      console.log('📄 File blob size:', fileBlob.size);

      // Create FormData with the file
      // Get the original filename from the URL to preserve file extension
      const urlPath = fileUrl.split('/').pop() || 'statement.xlsx';
      // Remove timestamp prefix if present (e.g., "1234567890_filename.csv" -> "filename.csv")
      const originalFilename = urlPath.replace(/^\d+_/, '');

      const formData = new FormData();
      formData.append('file', fileBlob, originalFilename);
      formData.append('orderId', orderId);
      formData.append('bank', bankId);
      if (user?.id) {
        formData.append('userId', user.id);
      }

      // Parse the file
      console.log('📄 Sending to parse-statement API...');
      const parseResponse = await fetch('/api/parse-statement', {
        method: 'POST',
        body: formData,
      });

      const parseData = await parseResponse.json();
      console.log('📄 Parse response:', parseResponse.status, parseData);

      if (!parseResponse.ok) {
        throw new Error(parseData.error || 'Failed to parse file');
      }

      console.log('📄 Parse successful! Transaction count:', parseData.transactionCount);

      // Wait for database to complete insert, then fetch with IDs
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fetch from database to get proper IDs for updates
      // Only get latest transactions by filtering on the parse session
      await fetchLatestTransactions(orderId);

    } catch (err) {
      console.error('📄 Error parsing file:', err);
      setError('Kunde inte läsa kontoutdraget. Kontrollera att filen är i rätt format (Excel).');
    } finally {
      setLoading(false);
      setParsing(false);
    }
  };

  // Update transaction locally only (no API call) - used for is_business toggle
  const updateTransactionLocal = (id: string, updates: Partial<ParsedTransaction>) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
  };

  // Update transaction via API (for notes, EU transaction, private etc.)
  const updateTransaction = async (id: string, updates: Partial<ParsedTransaction>) => {
    // For is_business, only update locally (no API call needed)
    if ('is_business' in updates && Object.keys(updates).length === 1) {
      updateTransactionLocal(id, updates);
      return;
    }

    try {
      const response = await fetch(`/api/parsed-transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setTransactions(prev =>
          prev.map(t => t.id === id ? { ...t, ...updates } : t)
        );
      }
    } catch (err) {
      console.error('Error updating transaction:', err);
    }
  };

  const handleNoteSubmit = (id: string) => {
    updateTransaction(id, { note: noteText });
    setEditingId(null);
    setNoteText('');
  };

  const handleContinue = () => {
    // If user doesn't have separate account, check if any transactions are marked as business
    if (!hasSeparateAccount) {
      const hasAnyBusiness = transactions.some(t => t.is_business);
      if (!hasAnyBusiness) {
        setShowNoBusinessWarning(true);
        return;
      }
    }
    router.push(`/flow/${packageType}/add-transactions?bank=${bankId}`);
  };

  const handleContinueAnyway = () => {
    setShowNoBusinessWarning(false);
    router.push(`/flow/${packageType}/add-transactions?bank=${bankId}`);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('sv-SE');
  };

  // Group transactions by description
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const key = transaction.description || transaction.reference || 'Ingen beskrivning';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(transaction);
    return groups;
  }, {} as Record<string, ParsedTransaction[]>);

  // Sort groups:
  // 1. Income first (positive total), then expenses (negative total)
  // 2. Within each category: grouped transactions first, then single transactions
  // 3. Then by absolute amount (largest first)
  const sortedGroups = Object.entries(groupedTransactions).sort((a, b) => {
    const totalA = a[1].reduce((sum, t) => sum + t.amount, 0);
    const totalB = b[1].reduce((sum, t) => sum + t.amount, 0);
    const isGroupedA = a[1].length > 1;
    const isGroupedB = b[1].length > 1;

    // Income (positive) comes before expenses (negative)
    if (totalA >= 0 && totalB < 0) return -1;
    if (totalA < 0 && totalB >= 0) return 1;

    // Within same category: grouped first, then single
    if (isGroupedA && !isGroupedB) return -1;
    if (!isGroupedA && isGroupedB) return 1;

    // Then by absolute amount (largest first)
    return Math.abs(totalB) - Math.abs(totalA);
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // Add note to all transactions in a group
  const handleGroupNoteSubmit = async (groupName: string, groupTransactions: ParsedTransaction[]) => {
    for (const transaction of groupTransactions) {
      await updateTransaction(transaction.id, { note: groupNoteText });
    }
    setEditingGroupName(null);
    setGroupNoteText('');
  };

  if (loading || parsing) {
    return (
      <FlowContainer
        title="Analyserar kontoutdrag..."
        description="Vänta medan vi läser in dina transaktioner."
        currentStep={4}
        totalSteps={totalSteps}
        packageType={packageType}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#173b57] mb-6"></div>
          <p className="text-slate-600 text-lg">
            {parsing ? 'Läser in transaktioner från kontoutdraget...' : 'Laddar...'}
          </p>
        </div>
      </FlowContainer>
    );
  }

  return (
    <>
      {/* Warning modal when no business transactions are marked - positioned outside FlowContainer */}
      {showNoBusinessWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#0d2235] border-2 border-amber-300 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-amber-500 font-bold text-lg mb-2">
                  Inga verksamhetstransaktioner markerade
                </h3>
                <p className="text-slate-300 text-sm mb-3">
                  Du har inte markerat någon transaktion som tillhör din verksamhet. Är du säker på att du vill fortsätta?
                </p>
                <p className="text-slate-400 text-xs italic">
                  Tips: Gå tillbaka och klicka i rutan till höger om transaktioner som tillhör din enskilda firma.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNoBusinessWarning(false)}
                className="flex-1 px-6 py-3 bg-[#173b57] text-white rounded-xl font-semibold hover:opacity-80 transition-all"
              >
                Gå tillbaka
              </button>
              <button
                onClick={handleContinueAnyway}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-slate-600 rounded-xl font-semibold transition-all"
              >
                Fortsätt ändå
              </button>
            </div>
          </div>
        </div>
      )}

      <FlowContainer
        title={hasSeparateAccount ? "Granska transaktioner" : "Granska och välj transaktioner"}
        description={hasSeparateAccount
          ? "Kontrollera att transaktionerna stämmer, lägg till anteckningar vid behov och markera eventuella EU-transaktioner."
          : "Markera vilka transaktioner som tillhör din verksamhet, lägg till anteckningar och markera eventuella EU-transaktioner."
        }
        currentStep={4}
        totalSteps={totalSteps}
        packageType={packageType}
      >
      {error ? (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 mb-6">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push(`/flow/${packageType}/upload-statement?bank=${bankId}`)}
            className="mt-4 text-[#E95C63] hover:opacity-70 font-semibold"
          >
            ← Gå tillbaka och ladda upp igen
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-[#0d2235] border border-[#173b57]/50 rounded-xl p-3 sm:p-4">
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Totalt</p>
                <p className="text-white text-lg sm:text-xl font-bold">{summary.totalCount} st</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 sm:p-4">
                <p className="text-green-400 text-xs sm:text-sm mb-1">Inkomster</p>
                <p className="text-green-400 text-lg sm:text-xl font-bold">{formatAmount(summary.totalIncome)}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 sm:p-4">
                <p className="text-red-400 text-xs sm:text-sm mb-1">Utgifter</p>
                <p className="text-red-400 text-lg sm:text-xl font-bold">{formatAmount(summary.totalExpenses)}</p>
              </div>
              <div className="bg-[#0d2235] border border-[#173b57]/50 rounded-xl p-3 sm:p-4">
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Netto</p>
                <p className={`text-lg sm:text-xl font-bold ${summary.netAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatAmount(summary.netAmount)}
                </p>
              </div>
            </div>
          )}

          {/* Interactive tutorial - example transaction with arrows */}
          {showTooltip && (
            <div className="bg-[#0d2235] border border-[#173b57] rounded-xl mb-4 shadow-lg overflow-hidden">
              {/* Header */}
              <div className="bg-[#173b57] px-4 py-2 flex items-center justify-between">
                <p className="font-bold text-white">Så här granskar du transaktioner</p>
                <button
                  onClick={() => setShowTooltip(false)}
                  className="text-white hover:opacity-80 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Example transaction */}
              <div className={`p-4 ${!hasSeparateAccount ? 'pt-8' : ''}`}>
                <div className="relative">
                  {/* The example transaction row */}
                  <div className="bg-[#173b57]/30 border border-[#173b57]/50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium text-sm">Exempel AB</p>
                          <span className="text-slate-400 text-xs">2024-01-15</span>
                        </div>
                      </div>
                      <span className="text-red-400 font-bold text-sm">-1 500 kr</span>
                      {/* Example checkbox - only show when user doesn't have separate account */}
                      {!hasSeparateAccount && (
                        <div className="relative">
                          {/* Arrow pointing to checkbox - above */}
                          <div className="absolute bottom-full right-0 mb-1 flex flex-col items-end">
                            <span className="text-[#E95C63] text-xs font-medium whitespace-nowrap">Verksamhetstransaktion</span>
                            <span className="text-[#E95C63] text-lg leading-none">↓</span>
                          </div>
                          <div className="w-10 h-10 rounded-lg border-2 bg-gray-100 border-gray-300 flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons row */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-gray-200">
                      <div className="relative">
                        <button className="text-xs text-slate-300 flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Lägg till anteckning
                        </button>
                        {/* Arrow pointing to note */}
                        <div className="absolute left-0 top-full mt-1 flex flex-col items-start">
                          <span className="text-[#E95C63] text-lg">↑</span>
                          <span className="text-[#E95C63] text-xs font-medium">Anteckning</span>
                        </div>
                      </div>

                      <span className="text-gray-300">|</span>

                      <div className="relative">
                        <button className="px-3 py-1 text-xs font-medium rounded border bg-transparent border-[#173b57]/50 text-slate-400">
                          EU-transaktion
                        </button>
                        {/* Arrow pointing to EU */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex flex-col items-center">
                          <span className="text-[#E95C63] text-lg">↑</span>
                          <span className="text-[#E95C63] text-xs font-medium whitespace-nowrap">Köp från EU</span>
                        </div>
                      </div>

                      {/* Privat button - only show when user has separate account */}
                      {hasSeparateAccount && (
                        <div className="relative">
                          <button className="px-3 py-1 text-xs font-medium rounded border bg-transparent border-[#173b57]/50 text-slate-400">
                            Privat
                          </button>
                          {/* Arrow pointing to Privat */}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex flex-col items-center">
                            <span className="text-[#E95C63] text-lg">↑</span>
                            <span className="text-[#E95C63] text-xs font-medium whitespace-nowrap">Ej företag</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Extra spacing for arrows */}
                <div className="h-10"></div>
              </div>

              {/* Footer */}
              <div className="px-4 pb-3">
                <button
                  onClick={() => setShowTooltip(false)}
                  className="w-full py-2 bg-[#173b57] hover:opacity-80 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  Jag förstår, stäng
                </button>
              </div>
            </div>
          )}

          {/* Grouped Transactions List */}
          <div className="bg-[#0d2235] border border-[#173b57]/50 rounded-xl overflow-hidden mb-6">
            <div className="p-4 border-b border-[#173b57]/50">
              <h3 className="text-lg font-bold text-white">
                Transaktioner ({transactions.length} st i {sortedGroups.length} grupper)
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {!hasSeparateAccount
                  ? 'Klicka i rutan till höger för att markera företagstransaktioner'
                  : 'Klicka på en grupp för att expandera och se alla transaktioner'
                }
              </p>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {sortedGroups.map(([groupName, groupTransactions]) => {
                const isExpanded = expandedGroups.has(groupName);
                const totalAmount = groupTransactions.reduce((sum, t) => sum + t.amount, 0);
                const hasMultiple = groupTransactions.length > 1;
                const hasEuTransaction = groupTransactions.some(t => t.is_eu_transaction);
                const hasPrivate = groupTransactions.some(t => t.is_private);
                const hasBusiness = groupTransactions.some(t => t.is_business);
                const allBusiness = groupTransactions.every(t => t.is_business);

                // Determine opacity: for separate account, dim private ones; for shared account, dim non-business ones
                const shouldDim = hasSeparateAccount ? hasPrivate : !allBusiness;

                // Function to toggle all transactions in a group (local only, no API calls)
                const toggleGroupBusiness = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const newValue = !allBusiness;
                  const groupIds = groupTransactions.map(t => t.id);
                  setTransactions(prev =>
                    prev.map(t =>
                      groupIds.includes(t.id)
                        ? { ...t, is_business: newValue }
                        : t
                    )
                  );
                };

                return (
                  <div key={groupName} className="border-b border-[#173b57]/30 last:border-b-0">
                    {/* Group Header */}
                    <div className={`${shouldDim ? 'opacity-60' : ''}`}>
                      <div className="flex items-center">
                        <button
                          onClick={() => hasMultiple && toggleGroup(groupName)}
                          className={`flex-1 p-3 sm:p-4 flex items-center gap-3 hover:bg-[#173b57]/20 transition-colors ${
                            hasMultiple ? 'cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {hasMultiple && (
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-[#173b57]/60 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-2 mb-1">
                                {hasMultiple && (
                                  <span className="px-2 py-0.5 bg-[#173b57]/60 text-slate-300 text-xs rounded-full font-medium">
                                    {groupTransactions.length} st
                                  </span>
                                )}
                                {hasEuTransaction && (
                                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                    EU
                                  </span>
                                )}
                                {hasSeparateAccount && hasPrivate && (
                                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                                    Privat
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium text-sm sm:text-base truncate">
                                  {groupName}
                                </p>
                                {/* Show date inline for single transactions */}
                                {!hasMultiple && (
                                  <span className="text-slate-400 text-xs sm:text-sm flex-shrink-0">
                                    {formatDate(groupTransactions[0].booking_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-base sm:text-lg font-bold whitespace-nowrap ${
                              totalAmount >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {formatAmount(totalAmount)}
                          </span>
                        </button>

                        {/* Business checkbox on the right - only when no separate account */}
                        {!hasSeparateAccount && (
                          <button
                            onClick={(e) => {
                              toggleGroupBusiness(e);
                              setShowTooltip(false);
                            }}
                            className={`flex-shrink-0 mr-3 sm:mr-4 w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                              allBusiness
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'bg-[#173b57]/30 border-[#173b57]/50 text-slate-400 hover:border-green-500/50'
                            }`}
                            title={allBusiness ? 'Ta bort från företag' : 'Markera som företag'}
                          >
                            {allBusiness ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Group Note Button (for groups with multiple transactions) */}
                      {hasMultiple && (
                        <div className="px-3 sm:px-4 pb-3">
                          {editingGroupName === groupName ? (
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={groupNoteText}
                                onChange={(e) => setGroupNoteText(e.target.value)}
                                placeholder="Skriv anteckning för hela gruppen..."
                                className="flex-1 px-3 py-2 bg-[#0d2235] border border-[#173b57]/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-[#173b57]"
                                autoFocus
                              />
                              <button
                                onClick={() => handleGroupNoteSubmit(groupName, groupTransactions)}
                                className="px-4 py-2 bg-[#173b57] hover:opacity-80 text-white rounded-lg text-sm font-semibold transition-colors"
                              >
                                Spara alla
                              </button>
                              <button
                                onClick={() => {
                                  setEditingGroupName(null);
                                  setGroupNoteText('');
                                }}
                                className="px-4 py-2 bg-[#173b57]/30 hover:bg-[#173b57]/50 text-slate-300 rounded-lg text-sm transition-colors"
                              >
                                Avbryt
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingGroupName(groupName);
                                setGroupNoteText('');
                              }}
                              className="text-xs text-slate-400 hover:text-[#E95C63] transition-colors flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Lägg till anteckning på alla {groupTransactions.length} transaktioner
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expanded Transactions */}
                    {(isExpanded || !hasMultiple) && (
                      <div className={`${hasMultiple ? 'bg-[#173b57]/10 border-t border-[#173b57]/30' : ''}`}>
                        {groupTransactions.map((transaction, idx) => (
                          <div
                            key={transaction.id}
                            className={`${hasMultiple ? 'ml-4 sm:ml-8 border-l-2 border-[#173b57]/40' : ''} ${
                              (hasSeparateAccount && transaction.is_private) || (!hasSeparateAccount && !transaction.is_business) ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="p-3 sm:p-4 hover:bg-[#173b57]/15 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  {/* Only show date/badges row for grouped transactions (single transactions show date in header) */}
                                  {hasMultiple && (
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-slate-400 text-xs sm:text-sm">
                                        {formatDate(transaction.booking_date)}
                                      </span>
                                      {transaction.is_eu_transaction && (
                                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                          EU
                                        </span>
                                      )}
                                      {hasSeparateAccount && transaction.is_private && (
                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                                          Privat
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {hasMultiple && (
                                    <p className="text-white font-medium text-sm sm:text-base">
                                      {groupName} ({idx + 1})
                                    </p>
                                  )}
                                  {transaction.note && (
                                    <p className="text-[#E95C63]/80 text-xs sm:text-sm mt-1 italic border-l-2 border-[#E95C63]/30 pl-2">
                                      {transaction.note}
                                    </p>
                                  )}
                                </div>

                                {/* Only show amount here for grouped transactions (single transactions show it in group header) */}
                                {hasMultiple && (
                                  <span
                                    className={`text-base sm:text-lg font-bold whitespace-nowrap ${
                                      transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    {formatAmount(transaction.amount)}
                                  </span>
                                )}

                                {/* Business checkbox on the right - only for grouped transactions when no separate account */}
                                {/* (Single transactions already have checkbox in the group header) */}
                                {!hasSeparateAccount && hasMultiple && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTransaction(transaction.id, {
                                        is_business: !transaction.is_business
                                      });
                                    }}
                                    className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                                      transaction.is_business
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'bg-[#173b57]/30 border-[#173b57]/50 text-slate-400 hover:border-green-500/50'
                                    }`}
                                    title={transaction.is_business ? 'Ta bort från företag' : 'Markera som företag'}
                                  >
                                    {transaction.is_business && (
                                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Action buttons - less spacing for single transactions */}
                              <div className={`flex flex-wrap items-center gap-3 ${hasMultiple ? 'mt-3 pt-3 border-t border-[#173b57]/30' : 'mt-1'}`}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingId(transaction.id);
                                    setNoteText(transaction.note || '');
                                  }}
                                  className="text-xs sm:text-sm text-slate-400 hover:text-[#E95C63] transition-colors flex items-center gap-1.5"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  {transaction.note ? 'Redigera anteckning' : 'Lägg till anteckning'}
                                </button>

                                <span className="text-gray-300">|</span>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTransaction(transaction.id, {
                                        is_eu_transaction: !transaction.is_eu_transaction
                                      });
                                    }}
                                    className={`px-3 py-1 text-xs font-medium rounded border transition-all ${
                                      transaction.is_eu_transaction
                                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                                        : 'bg-transparent border-[#173b57]/50 text-slate-400 hover:border-slate-400 hover:text-slate-300'
                                    }`}
                                  >
                                    {transaction.is_eu_transaction && (
                                      <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                    EU-transaktion
                                  </button>
                                  {/* Show private toggle when user has separate account */}
                                  {hasSeparateAccount && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateTransaction(transaction.id, {
                                          is_private: !transaction.is_private
                                        });
                                      }}
                                      className={`px-3 py-1 text-xs font-medium rounded border transition-all ${
                                        transaction.is_private
                                          ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                                          : 'bg-transparent border-[#173b57]/50 text-slate-400 hover:border-slate-400 hover:text-slate-300'
                                      }`}
                                    >
                                      {transaction.is_private && (
                                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      Privat
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Note input */}
                              {editingId === transaction.id && (
                                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder="Skriv en anteckning..."
                                    className="flex-1 px-3 py-2 bg-[#0d2235] border border-[#173b57]/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-[#173b57]"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleNoteSubmit(transaction.id)}
                                    className="px-4 py-2 bg-[#173b57] hover:opacity-80 text-white rounded-lg text-sm font-semibold transition-colors"
                                  >
                                    Spara
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingId(null);
                                      setNoteText('');
                                    }}
                                    className="px-4 py-2 bg-[#173b57]/30 hover:bg-[#173b57]/50 text-slate-300 rounded-lg text-sm transition-colors"
                                  >
                                    Avbryt
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {transactions.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-slate-400">Inga transaktioner hittades i kontoutdraget.</p>
                </div>
              )}
            </div>
          </div>

          {/* Info box - different content based on account type */}
          {!hasSeparateAccount ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 sm:p-6 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-green-400 font-semibold mb-2">Klicka i rutan för företagstransaktioner</h3>
                  <p className="text-slate-400 text-sm mb-3">
                    Eftersom du inte har ett separat företagskonto behöver du markera vilka transaktioner som tillhör din enskilda firma.
                    Klicka på den gröna rutan till höger om varje transaktion för att välja.
                  </p>
                  <div className="text-slate-400 text-sm space-y-1.5">
                    <p className="flex items-center gap-2">
                      <span className="inline-flex w-5 h-5 bg-green-500 rounded items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span>= Tillhör verksamheten (ingår i bokföringen)</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="inline-flex w-5 h-5 bg-[#173b57]/30 border border-[#173b57]/50 rounded"></span>
                      <span>= Privat transaktion (ingår inte)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0d2235] border border-[#173b57]/40 rounded-xl p-4 sm:p-6 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-[#173b57]/40 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#E95C63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-2">Tips för granskning</h3>
                  <div className="text-slate-400 text-sm space-y-1.5">
                    <p><span className="text-purple-400 font-medium">Privat</span> – Markera transaktioner som inte ska ingå i bokföringen</p>
                    <p><span className="text-blue-400 font-medium">EU-transaktion</span> – Markera köp från andra EU-länder för korrekt momshantering</p>
                    <p><span className="text-[#E95C63] font-medium">Anteckningar</span> – Lägg till förklaringar för oklara transaktioner</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-6 border-t border-[#173b57]/30">
        <button
          onClick={() => router.push(`/flow/${packageType}/upload-statement?bank=${bankId}`)}
          className="text-slate-600 hover:text-white font-semibold transition-colors flex items-center justify-center sm:justify-start py-3 sm:py-0"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={transactions.length === 0}
          className={`px-6 sm:px-8 py-3 rounded-xl font-bold transition-all duration-200 w-full sm:w-auto ${
            transactions.length > 0
              ? 'bg-gradient-to-r text-white hover:opacity-90'
              : 'bg-gray-200 text-navy-400 cursor-not-allowed'
          }`}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
    </>
  );
}
