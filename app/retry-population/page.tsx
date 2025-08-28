'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RetryPopulationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check authorization
  useEffect(() => {
    if (status === 'loading') return; // Still loading session
    
    if (status === 'unauthenticated') {
      // Not logged in, redirect to sign in
      router.push('/auth/signin');
      return;
    }
    
    if (session?.user?.email === 'drensokoli@gmail.com') {
      setIsAuthorized(true);
    } else {
      // Not authorized, redirect to home
      router.push('/');
    }
  }, [session, status, router]);

  // Show loading while checking authorization
  if (status === 'loading' || !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Checking authorization...</p>
        </div>
      </div>
    );
  }

  // Show unauthorized message if somehow we get here
  if (!isAuthorized) {
    return null; // Will redirect
  }

  const retryPopulation = async (action: string) => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`✅ ${data.message}`);
      } else {
        setError(`❌ ${data.error || 'Unknown error occurred'}`);
      }
    } catch (err) {
      setError(`❌ Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const actions = [
    { key: 'populate-movies', label: '🔄 Retry Movies Population', color: 'bg-red-600 hover:bg-red-700' },
    { key: 'populate-tvshows', label: '🔄 Retry TV Shows Population', color: 'bg-red-600 hover:bg-red-700' },
    { key: 'populate-books', label: '🔄 Retry Books Population', color: 'bg-red-600 hover:bg-red-700' },
    { key: 'populate-all', label: '🚀 Retry All Media Types', color: 'bg-green-600 hover:bg-green-700' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              ClickNotes Population Retry
            </h1>
            <p className="text-gray-600">
              Use these buttons to manually retry failed Redis population operations
            </p>
          </div>

          <div className="space-y-4">
            {actions.map((action) => (
              <button
                key={action.key}
                onClick={() => retryPopulation(action.key)}
                disabled={isLoading}
                className={`w-full ${action.color} text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? '⏳ Processing...' : action.label}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="mt-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Processing your request...</p>
            </div>
          )}

          {result && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">{result}</p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-blue-800 font-medium mb-2">How it works:</h3>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Click any button above to retry the corresponding operation</li>
              <li>• The system will attempt to populate Redis with fresh data</li>
              <li>• Check the console logs for detailed progress information</li>
              <li>• You&apos;ll receive another email if the retry also fails</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
