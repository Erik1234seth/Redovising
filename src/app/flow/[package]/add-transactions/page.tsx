'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const NAV_BG = '#173b57';

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'income' | 'expense';
}

export default function AddTransactionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;
  useTrackStep('add-transactions', packageType, bankId, user?.id);

  const [orderId, setOrderId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [formError, setFormError] = useState('');

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

  // Protect route - require authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/add-transactions?bank=${bankId}`);
    }
  }, [user, loading, router, packageType, bankId]);

  useEffect(() => {
    const id = sessionStorage.getItem('tempOrderId');
    if (id) {
      setOrderId(id);
      fetchTransactions(id);
    }
  }, []);

  const fetchTransactions = async (orderId: string) => {
    setFetching(true);
    try {
      const response = await fetch(`/api/transactions?orderId=${orderId}`);
      const data = await response.json();
      if (response.ok) setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!date || !description || !amount || !quantity) {
      setFormError('Alla fält måste fyllas i');
      return;
    }
    if (parseFloat(amount) <= 0) {
      setFormError('Beloppet måste vara större än 0');
      return;
    }
    const qty = parseInt(quantity);
    if (qty <= 0) {
      setFormError('Antal måste vara minst 1');
      return;
    }

    setSubmitting(true);

    try {
      const newTransactions: Transaction[] = [];
      for (let i = 0; i < qty; i++) {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            userId: user?.id || null,
            guestEmail: null,
            guestName: null,
            transactionDate: date,
            description: qty > 1 ? `${description} (${i + 1}/${qty})` : description,
            amount: parseFloat(amount),
            transactionType,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          newTransactions.push(data.transaction);
        } else {
          setFormError(data.error || 'Ett fel uppstod');
          break;
        }
      }
      if (newTransactions.length > 0) {
        setTransactions([...newTransactions, ...transactions]);
        setDate('');
        setDescription('');
        setAmount('');
        setQuantity('1');
        setTransactionType('expense');
      }
    } catch (error) {
      setFormError('Ett oväntat fel uppstod');
      console.error('Error creating transaction:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna transaktion?')) return;
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, { method: 'DELETE' });
      if (response.ok) {
        setTransactions(transactions.filter((t) => t.id !== transactionId));
      } else {
        alert('Kunde inte ta bort transaktion');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Ett oväntat fel uppstod');
    }
  };

  const handleContinue = () => {
    const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
    const isFirstYear = answersStr ? JSON.parse(answersStr).isFirstYear === true : false;

    if (packageType === 'komplett') {
      router.push(`/flow/${packageType}/delegation-guide?bank=${bankId}`);
    } else if (isFirstYear) {
      router.push(`/flow/${packageType}/contact-info?bank=${bankId}`);
    } else {
      router.push(`/flow/${packageType}/upload-previous?bank=${bankId}`);
    }
  };

  const totalIncome = transactions.filter((t) => t.transaction_type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.transaction_type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  const inputClass = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 placeholder-gray-400 outline-none transition";

  return (
    <FlowContainer
      title="Lägg till utgifter och inkomster"
      description="Lägg till transaktioner som inte syns i ditt kontoutdrag (valfritt)."
      currentStep={5}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      {/* Add Transaction Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
        <h3 className="text-lg sm:text-xl font-bold mb-4" style={{ color: NAV_BG }}>
          Lägg till transaktion
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="date" className="block text-sm font-semibold text-slate-600 mb-2">Datum</label>
            <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)}
              className={inputClass}
              onFocus={e => e.currentTarget.style.borderColor = NAV_BG}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
              required />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-slate-600 mb-2">Beskrivning</label>
            <input type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="T.ex. Kontorsmaterial, Konsultarvode..."
              className={inputClass}
              onFocus={e => e.currentTarget.style.borderColor = NAV_BG}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
              required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-semibold text-slate-600 mb-2">Belopp (kr, inklusive moms)</label>
              <input type="number" id="amount" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" step="0.01" min="0"
                className={inputClass}
                onFocus={e => e.currentTarget.style.borderColor = NAV_BG}
                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                required />
            </div>
            <div>
              <label htmlFor="quantity" className="block text-sm font-semibold text-slate-600 mb-2">Antal</label>
              <input type="number" id="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                placeholder="1" step="1" min="1"
                className={inputClass}
                onFocus={e => e.currentTarget.style.borderColor = NAV_BG}
                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                required />
              <p className="text-xs text-slate-400 mt-1">Lägg till flera identiska transaktioner</p>
            </div>
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-semibold text-slate-600 mb-2">Typ</label>
            <select id="type" value={transactionType} onChange={(e) => setTransactionType(e.target.value as 'income' | 'expense')}
              className={inputClass}
              onFocus={e => e.currentTarget.style.borderColor = NAV_BG}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <option value="expense">Utgift</option>
              <option value="income">Inkomst</option>
            </select>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-500">{formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-6 py-3 rounded-xl font-bold transition-all duration-200 text-white"
            style={submitting ? { backgroundColor: '#d1d5db', color: '#9ca3af', cursor: 'not-allowed' } : { backgroundColor: NAV_BG }}
          >
            {submitting ? 'Lägger till...' : '+ Lägg till transaktion'}
          </button>
        </form>
      </div>

      {/* Transactions List */}
      {fetching ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: NAV_BG }}></div>
          <p className="text-slate-500">Laddar transaktioner...</p>
        </div>
      ) : transactions.length > 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-0" style={{ color: NAV_BG }}>
              Tillagda transaktioner ({transactions.length})
            </h3>
            <div className="flex gap-3 text-sm">
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1">
                <span className="text-green-600 font-semibold">Inkomst: {totalIncome.toFixed(2)} kr</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1">
                <span className="text-red-500 font-semibold">Utgift: {totalExpense.toFixed(2)} kr</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      transaction.transaction_type === 'income' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-400'
                    }`}>
                      {transaction.transaction_type === 'income' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{transaction.description}</p>
                      <p className="text-sm text-slate-400">{new Date(transaction.transaction_date).toLocaleDateString('sv-SE')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className={`text-lg font-bold ${transaction.transaction_type === 'income' ? 'text-green-500' : 'text-red-400'}`}>
                    {transaction.transaction_type === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)} kr
                  </span>
                  <button onClick={() => handleDelete(transaction.id)} className="text-red-400 hover:text-red-500 transition-colors p-2" title="Ta bort">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center mb-6">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-400">Inga transaktioner tillagda än. Lägg till dina första transaktioner ovan.</p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mr-4" style={{ backgroundColor: `${NAV_BG}10` }}>
            <svg className="w-5 h-5" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold mb-2" style={{ color: NAV_BG }}>Om transaktioner</h3>
            <p className="text-sm text-slate-600">
              Här kan du lägga till transaktioner som inte syns i ditt kontoutdrag, till exempel
              kontantbetalningar eller andra transaktioner som behöver rapporteras. Detta är helt valfritt och kan hoppas över om du inte har några sådana
              transaktioner.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <button
          onClick={() => router.back()}
          className="text-slate-500 hover:text-slate-800 font-semibold transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>

        <div className="flex gap-3">
          <button onClick={handleContinue} className="px-6 py-3 text-slate-500 hover:text-slate-800 font-semibold transition-colors">
            Hoppa över
          </button>
          <button
            onClick={handleContinue}
            className="px-8 py-3 text-white rounded-xl font-bold transition-all duration-200 hover:opacity-90"
            style={{ backgroundColor: NAV_BG }}
          >
            Fortsätt →
          </button>
        </div>
      </div>
    </FlowContainer>
  );
}
