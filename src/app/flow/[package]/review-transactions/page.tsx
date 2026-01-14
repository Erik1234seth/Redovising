'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
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

  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const totalSteps = 8; // Updated to include this new step

  // Protect route - require authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/review-transactions?bank=${bankId}`);
    }
  }, [user, authLoading, router, packageType, bankId]);

  // Get order ID and parse the uploaded file
  useEffect(() => {
    const id = sessionStorage.getItem('tempOrderId');
    const fileUrl = sessionStorage.getItem('statementFileUrl');

    if (id) {
      setOrderId(id);
      // First try to fetch existing parsed transactions
      fetchTransactions(id).then(hasData => {
        if (!hasData && fileUrl) {
          // If no existing data, parse the file
          parseUploadedFile(id);
        }
      });
    } else {
      setError('Ingen order hittades. Gå tillbaka och ladda upp ditt kontoutdrag först.');
      setLoading(false);
    }
  }, []);

  const fetchTransactions = async (orderId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/parsed-transactions?orderId=${orderId}`);
      const data = await response.json();

      if (response.ok && data.transactions && data.transactions.length > 0) {
        setTransactions(data.transactions);
        setSummary(data.summary);
        setLoading(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error fetching transactions:', err);
      return false;
    }
  };

  const parseUploadedFile = async (orderId: string) => {
    setParsing(true);
    setError('');

    try {
      // Get the file URL from sessionStorage
      const fileUrl = sessionStorage.getItem('statementFileUrl');

      if (!fileUrl) {
        setError('Ingen fil hittades. Gå tillbaka och ladda upp ditt kontoutdrag först.');
        setLoading(false);
        setParsing(false);
        return;
      }

      // Fetch the file from Supabase Storage
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error('Could not fetch uploaded file');
      }

      const fileBlob = await fileResponse.blob();

      // Create FormData with the file
      const formData = new FormData();
      formData.append('file', fileBlob, 'statement.xlsx');
      formData.append('orderId', orderId);
      if (user?.id) {
        formData.append('userId', user.id);
      }

      // Parse the file
      const parseResponse = await fetch('/api/parse-statement', {
        method: 'POST',
        body: formData,
      });

      const parseData = await parseResponse.json();

      if (!parseResponse.ok) {
        throw new Error(parseData.error || 'Failed to parse file');
      }

      // Fetch the saved transactions
      await fetchTransactions(orderId);

    } catch (err) {
      console.error('Error parsing file:', err);
      setError('Kunde inte läsa kontoutdraget. Kontrollera att filen är i rätt format (Excel/CSV).');
    } finally {
      setLoading(false);
      setParsing(false);
    }
  };

  const updateTransaction = async (id: string, updates: Partial<ParsedTransaction>) => {
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
        // Refresh summary
        if (orderId) {
          fetchTransactions(orderId);
        }
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gold-500 mb-6"></div>
          <p className="text-warm-300 text-lg">
            {parsing ? 'Läser in transaktioner från kontoutdraget...' : 'Laddar...'}
          </p>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      title="Granska transaktioner"
      description="Kontrollera att transaktionerna stämmer och lägg till anteckningar vid behov."
      currentStep={4}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      {error ? (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 mb-6">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push(`/flow/${packageType}/upload-statement?bank=${bankId}`)}
            className="mt-4 text-gold-500 hover:text-gold-400 font-semibold"
          >
            ← Gå tillbaka och ladda upp igen
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-3 sm:p-4">
                <p className="text-warm-400 text-xs sm:text-sm mb-1">Totalt</p>
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
              <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-3 sm:p-4">
                <p className="text-warm-400 text-xs sm:text-sm mb-1">Netto</p>
                <p className={`text-lg sm:text-xl font-bold ${summary.netAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatAmount(summary.netAmount)}
                </p>
              </div>
            </div>
          )}

          {/* Transactions List */}
          <div className="bg-navy-800/50 border border-navy-600 rounded-xl overflow-hidden mb-6">
            <div className="p-4 border-b border-navy-600">
              <h3 className="text-lg font-bold text-white">
                Transaktioner ({transactions.length})
              </h3>
              <p className="text-sm text-warm-400 mt-1">
                Klicka på en transaktion för att lägga till anteckning eller markera som EU-transaktion
              </p>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={`border-b border-navy-700 last:border-b-0 ${
                    transaction.is_private ? 'opacity-50' : ''
                  }`}
                >
                  <div className="p-3 sm:p-4 hover:bg-navy-700/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-warm-400 text-xs sm:text-sm">
                            {formatDate(transaction.booking_date)}
                          </span>
                          {transaction.is_eu_transaction && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                              EU
                            </span>
                          )}
                          {transaction.is_private && (
                            <span className="px-2 py-0.5 bg-warm-500/20 text-warm-400 text-xs rounded-full">
                              Privat
                            </span>
                          )}
                        </div>
                        <p className="text-white font-medium text-sm sm:text-base truncate">
                          {transaction.description || transaction.reference || 'Ingen beskrivning'}
                        </p>
                        {transaction.note && (
                          <p className="text-gold-500 text-xs sm:text-sm mt-1 italic">
                            📝 {transaction.note}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-base sm:text-lg font-bold whitespace-nowrap ${
                            transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {formatAmount(transaction.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => {
                          setEditingId(transaction.id);
                          setNoteText(transaction.note || '');
                        }}
                        className="px-3 py-1.5 text-xs sm:text-sm bg-navy-700 hover:bg-navy-600 text-warm-300 rounded-lg transition-colors"
                      >
                        {transaction.note ? '✏️ Redigera' : '📝 Anteckning'}
                      </button>
                      <button
                        onClick={() => updateTransaction(transaction.id, {
                          is_eu_transaction: !transaction.is_eu_transaction
                        })}
                        className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                          transaction.is_eu_transaction
                            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                            : 'bg-navy-700 hover:bg-navy-600 text-warm-300'
                        }`}
                      >
                        🇪🇺 EU-transaktion
                      </button>
                      <button
                        onClick={() => updateTransaction(transaction.id, {
                          is_private: !transaction.is_private
                        })}
                        className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                          transaction.is_private
                            ? 'bg-warm-500/20 text-warm-400 hover:bg-warm-500/30'
                            : 'bg-navy-700 hover:bg-navy-600 text-warm-300'
                        }`}
                      >
                        🏠 Privat
                      </button>
                    </div>

                    {/* Note input */}
                    {editingId === transaction.id && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Skriv en anteckning..."
                          className="flex-1 px-3 py-2 bg-navy-700 border border-navy-600 rounded-lg text-white text-sm placeholder-warm-500 focus:outline-none focus:border-gold-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleNoteSubmit(transaction.id)}
                          className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Spara
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setNoteText('');
                          }}
                          className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-warm-300 rounded-lg text-sm transition-colors"
                        >
                          Avbryt
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {transactions.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-warm-400">Inga transaktioner hittades i kontoutdraget.</p>
                </div>
              )}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-xl p-4 sm:p-6 mb-6">
            <h3 className="text-gold-500 font-bold mb-2">Tips för granskning</h3>
            <ul className="text-warm-200 text-sm space-y-1">
              <li>• Markera privata transaktioner som inte ska tas med i bokföringen</li>
              <li>• Lägg till anteckningar för att förtydliga oklara transaktioner</li>
              <li>• Markera EU-transaktioner för korrekt momshantering</li>
            </ul>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-6 border-t border-navy-600">
        <button
          onClick={() => router.push(`/flow/${packageType}/upload-statement?bank=${bankId}`)}
          className="text-warm-300 hover:text-white font-semibold transition-colors flex items-center justify-center sm:justify-start py-3 sm:py-0"
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
              ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105'
              : 'bg-navy-600 text-navy-400 cursor-not-allowed'
          }`}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
  );
}
