'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase';

interface AccountingDocument {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  year: number | null;
  created_at: string;
}

export default function RedovisningPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<AccountingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supabase = createClient();

  // Question form state
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionForm, setQuestionForm] = useState({ message: '' });
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [questionSent, setQuestionSent] = useState(false);
  const [questionError, setQuestionError] = useState('');

  // Protect route - require authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/account/redovisning');
    }
  }, [user, authLoading, router]);

  // Fetch user's accounting documents
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_accounting_documents')
          .select('*')
          .eq('user_id', user.id)
          .order('year', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching documents:', error);
          setError('Kunde inte hämta dokument');
        } else {
          setDocuments(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Ett fel uppstod');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDocuments();
    }
  }, [user, supabase]);

  const handleSendQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.message.trim()) return;

    setSendingQuestion(true);
    setQuestionError('');

    try {
      const response = await fetch('/api/send-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile?.full_name || user?.email || 'Okänd användare',
          email: user?.email || '',
          message: questionForm.message,
        }),
      });

      if (!response.ok) {
        throw new Error('Kunde inte skicka frågan');
      }

      setQuestionSent(true);
      setQuestionForm({ message: '' });
    } catch (err) {
      console.error('Error sending question:', err);
      setQuestionError('Kunde inte skicka frågan. Försök igen senare.');
    } finally {
      setSendingQuestion(false);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-navy-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/account"
            className="text-warm-400 hover:text-white text-sm inline-flex items-center mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Tillbaka till konto
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Min redovisning
          </h1>
          <p className="text-warm-300">
            Här hittar du dina färdiga bokslut och NE-bilagor
          </p>
        </div>

        {/* Documents */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
            <p className="text-warm-300">Laddar dokument...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-2xl p-8 sm:p-12 text-center">
            <div className="w-20 h-20 bg-navy-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-3">
              Inga dokument ännu
            </h2>
            <p className="text-warm-300 mb-6 max-w-md mx-auto">
              När vi har färdigställt din redovisning kommer den att visas här.
              Du får ett meddelande när den är klar.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40"
            >
              Gå till startsidan
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6 hover:border-gold-500/30 transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gold-500/10 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        {doc.title}
                      </h3>
                      {doc.description && (
                        <p className="text-sm text-warm-300 mb-2">{doc.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-warm-400">
                        {doc.year && (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {doc.year}
                          </span>
                        )}
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(doc.created_at).toLocaleDateString('sv-SE')}
                        </span>
                        <span className="text-warm-500">{doc.file_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:flex-shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 bg-navy-600 hover:bg-navy-500 text-white rounded-lg font-semibold transition-all duration-200"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Visa
                    </a>
                    <a
                      href={doc.file_url}
                      download={doc.file_name}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-lg font-bold transition-all duration-200"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Ladda ner
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-gold-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">
                Hur fungerar det?
              </h3>
              <p className="text-sm text-warm-300">
                När vi har färdigställt din redovisning laddar vi upp den här så att du enkelt kan komma åt den.
                Du får ett e-postmeddelande med en direktlänk till denna sida när din redovisning är klar.
                Alla dokument sparas säkert och är endast tillgängliga för dig.
              </p>
            </div>
          </div>
        </div>

        {/* Question Section */}
        <div className="mt-8 bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl overflow-hidden">
          <button
            onClick={() => {
              setShowQuestionForm(!showQuestionForm);
              if (questionSent) {
                setQuestionSent(false);
              }
            }}
            className="w-full p-6 flex items-center justify-between hover:bg-navy-600/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gold-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-bold text-white">
                  Har du en fråga?
                </h3>
                <p className="text-sm text-warm-300">
                  Skicka en fråga direkt till oss
                </p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-warm-400 transition-transform duration-200 ${showQuestionForm ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showQuestionForm && (
            <div className="px-6 pb-6 border-t border-navy-600">
              {questionSent ? (
                <div className="pt-6 text-center">
                  <div className="w-12 h-12 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-white mb-2">Tack för din fråga!</h4>
                  <p className="text-sm text-warm-300 mb-4">
                    Vi återkommer till dig så snart som möjligt.
                  </p>
                  <button
                    onClick={() => setQuestionSent(false)}
                    className="text-gold-500 hover:text-gold-400 font-semibold text-sm"
                  >
                    Skicka en ny fråga
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendQuestion} className="pt-6 space-y-4">
                  <div>
                    <label htmlFor="question-message" className="block text-sm font-medium text-warm-300 mb-2">
                      Din fråga
                    </label>
                    <textarea
                      id="question-message"
                      rows={4}
                      value={questionForm.message}
                      onChange={(e) => setQuestionForm({ message: e.target.value })}
                      placeholder="Skriv din fråga här..."
                      className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition resize-none placeholder-warm-500"
                      required
                    />
                  </div>

                  {questionError && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                      <p className="text-sm text-red-400">{questionError}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-warm-400">
                      Vi svarar till: {user?.email}
                    </p>
                    <button
                      type="submit"
                      disabled={sendingQuestion || !questionForm.message.trim()}
                      className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-200 ${
                        sendingQuestion || !questionForm.message.trim()
                          ? 'bg-navy-600 text-navy-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40'
                      }`}
                    >
                      {sendingQuestion ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Skickar...
                        </span>
                      ) : (
                        'Skicka fråga'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
