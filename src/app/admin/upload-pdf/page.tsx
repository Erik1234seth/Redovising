'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  full_name: string | null;
}

export default function AdminUploadPDFPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();

        if (data.error) {
          console.error('Error fetching users:', data.error);
          setError('Kunde inte hämta användare');
        } else {
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Kunde inte hämta användare');
      }
    };

    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!selectedUserId || !title || !file) {
      setError('Fyll i alla obligatoriska fält');
      return;
    }

    // Validate PDF
    if (file.type !== 'application/pdf') {
      setError('Endast PDF-filer är tillåtna');
      return;
    }

    setUploading(true);

    try {
      // Create FormData and send to API
      const formData = new FormData();
      formData.append('userId', selectedUserId);
      formData.append('title', title);
      if (description) formData.append('description', description);
      if (year) formData.append('year', year);
      formData.append('file', file);

      const response = await fetch('/api/admin/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ett fel uppstod vid uppladdning');
      }

      setMessage('✅ PDF uppladdad! Användaren kan nu se den på sin sida.');

      // Reset form
      setSelectedUserId('');
      setTitle('');
      setDescription('');
      setYear(new Date().getFullYear().toString());
      setFile(null);
      (document.getElementById('file-input') as HTMLInputElement).value = '';

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Ett fel uppstod vid uppladdning');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-warm-400 hover:text-white text-sm inline-flex items-center mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Tillbaka till admin
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Ladda upp PDF till användare
          </h1>
          <p className="text-warm-300">
            PDF:en kommer synas på användarens sida: /account/redovisning
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6 space-y-6">
          {/* User selection */}
          <div>
            <label htmlFor="user" className="block text-sm font-medium text-warm-300 mb-2">
              Välj användare *
            </label>
            <select
              id="user"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition"
              required
            >
              <option value="">-- Välj användare --</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email} {user.full_name ? `(${user.full_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-warm-300 mb-2">
              Titel *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="T.ex. NE-bilaga 2024"
              className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-warm-300 mb-2">
              Beskrivning (valfritt)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="T.ex. Din färdiga NE-bilaga för skatteåret 2024"
              className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition resize-none placeholder-warm-500"
            />
          </div>

          {/* Year */}
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-warm-300 mb-2">
              År (valfritt)
            </label>
            <input
              type="number"
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition placeholder-warm-500"
            />
          </div>

          {/* File input */}
          <div>
            <label htmlFor="file-input" className="block text-sm font-medium text-warm-300 mb-2">
              PDF-fil *
            </label>
            <input
              type="file"
              id="file-input"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 bg-navy-800 border border-navy-600 text-white rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold-500 file:text-navy-900 hover:file:bg-gold-600 file:cursor-pointer"
              required
            />
            {file && (
              <p className="mt-2 text-sm text-warm-400">
                Vald fil: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Messages */}
          {message && (
            <div className="bg-green-500/10 border border-green-500/50 rounded-xl p-4">
              <p className="text-green-400 text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={uploading}
            className={`w-full py-3 rounded-xl font-bold transition-all duration-200 ${
              uploading
                ? 'bg-navy-600 text-navy-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40'
            }`}
          >
            {uploading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Laddar upp...
              </span>
            ) : (
              'Ladda upp PDF'
            )}
          </button>
        </form>

        {/* Info box */}
        <div className="mt-6 bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-gold-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-warm-300">
                När du laddar upp en PDF här så syns den automatiskt på användarens redovisningssida.
                Användaren kommer INTE att få ett mail, så glöm inte att meddela dem manuellt att filen är uppladdad.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
