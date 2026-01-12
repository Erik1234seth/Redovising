'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;

  const [orderId, setOrderId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [formError, setFormError] = useState('');

  const totalSteps = 7;

  // Get order ID from sessionStorage
  useEffect(() => {
    const id = sessionStorage.getItem('tempOrderId');
    if (id) {
      setOrderId(id);
      fetchTransactions(id);
    }
  }, []);

  const fetchTransactions = async (orderId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions?orderId=${orderId}`);
      const data = await response.json();
      if (response.ok) {
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validate form
    if (!date || !description || !amount) {
      setFormError('Alla fält måste fyllas i');
      return;
    }

    if (parseFloat(amount) <= 0) {
      setFormError('Beloppet måste vara större än 0');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          userId: user?.id || null,
          guestEmail: null,
          guestName: null,
          transactionDate: date,
          description,
          amount: parseFloat(amount),
          transactionType,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Add new transaction to list
        setTransactions([data.transaction, ...transactions]);
        // Reset form
        setDate('');
        setDescription('');
        setAmount('');
        setTransactionType('expense');
      } else {
        setFormError(data.error || 'Ett fel uppstod');
      }
    } catch (error) {
      setFormError('Ett oväntat fel uppstod');
      console.error('Error creating transaction:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna transaktion?')) {
      return;
    }

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      });

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
    if (packageType === 'ne-bilaga') {
      router.push(`/flow/${packageType}/upload-previous?bank=${bankId}`);
    } else {
      router.push(`/flow/${packageType}/delegation-guide?bank=${bankId}`);
    }
  };

  const handleSkip = () => {
    handleContinue();
  };

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <FlowContainer
      title="Lägg till utgifter och inkomster"
      description="Lägg till manuella transaktioner som inte syns i ditt kontoutdrag (valfritt)."
      currentStep={4}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      {/* Add Transaction Form */}
      <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-4 sm:p-6 mb-6">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
          Lägg till transaktion
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-semibold text-warm-300 mb-2">
              Datum
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded-xl text-white placeholder-warm-500 focus:outline-none focus:border-gold-500 transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-warm-300 mb-2">
              Beskrivning
            </label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="T.ex. Kontorsmaterial, Konsultarvode..."
              className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded-xl text-white placeholder-warm-500 focus:outline-none focus:border-gold-500 transition-colors"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-semibold text-warm-300 mb-2">
              Belopp (kr)
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded-xl text-white placeholder-warm-500 focus:outline-none focus:border-gold-500 transition-colors"
              required
            />
          </div>

          {/* Transaction Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-semibold text-warm-300 mb-2">
              Typ
            </label>
            <select
              id="type"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as 'income' | 'expense')}
              className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded-xl text-white focus:outline-none focus:border-gold-500 transition-colors"
            >
              <option value="expense">Utgift</option>
              <option value="income">Inkomst</option>
            </select>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3">
              <p className="text-sm text-red-400">{formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full px-6 py-3 rounded-xl font-bold transition-all duration-200 ${
              submitting
                ? 'bg-navy-600 text-navy-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40'
            }`}
          >
            {submitting ? 'Lägger till...' : '+ Lägg till transaktion'}
          </button>
        </form>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
          <p className="text-warm-300">Laddar transaktioner...</p>
        </div>
      ) : transactions.length > 0 ? (
        <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-0">
              Tillagda transaktioner ({transactions.length})
            </h3>
            <div className="flex gap-3 text-sm">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1">
                <span className="text-green-400 font-semibold">
                  Inkomst: {totalIncome.toFixed(2)} kr
                </span>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1">
                <span className="text-red-400 font-semibold">
                  Utgift: {totalExpense.toFixed(2)} kr
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-navy-700/50 border border-navy-600 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        transaction.transaction_type === 'income'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
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
                      <p className="font-semibold text-white truncate">
                        {transaction.description}
                      </p>
                      <p className="text-sm text-warm-400">
                        {new Date(transaction.transaction_date).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  <span
                    className={`text-lg font-bold ${
                      transaction.transaction_type === 'income' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {transaction.transaction_type === 'income' ? '+' : '-'}
                    {transaction.amount.toFixed(2)} kr
                  </span>
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    className="text-red-400 hover:text-red-300 transition-colors p-2"
                    title="Ta bort"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-8 text-center mb-6">
          <svg
            className="w-16 h-16 text-warm-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-warm-400">
            Inga transaktioner tillagda än. Lägg till dina första transaktioner ovan.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-4 sm:p-6 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 bg-gold-500/10 rounded-lg flex items-center justify-center mr-4">
            <svg className="w-5 h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-white mb-2">Om manuella transaktioner</h3>
            <p className="text-sm text-warm-300">
              Här kan du lägga till transaktioner som inte syns i ditt kontoutdrag, till exempel
              kontantbetalningar, fakturor som inte betalats än, eller andra transaktioner som behöver
              rapporteras. Detta är helt valfritt och kan hoppas över om du inte har några sådana
              transaktioner.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t border-navy-600">
        <button
          onClick={() => router.back()}
          className="text-warm-300 hover:text-white font-semibold transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="px-6 py-3 text-warm-300 hover:text-white font-semibold transition-colors"
          >
            Hoppa över
          </button>
          <button
            onClick={handleContinue}
            className="px-8 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105"
          >
            Fortsätt →
          </button>
        </div>
      </div>
    </FlowContainer>
  );
}
