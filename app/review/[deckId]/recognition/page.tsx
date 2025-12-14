'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Types
interface CardWithProgress {
  id: string;
  korean: string;
  english: string;
  notes: string | null;
  exampleKorean: string | null;
  exampleEnglish: string | null;
  romanization: string | null;
  usefulnessScore: number;
  cardProgress?: {
    id: string;
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
    dueAt: Date;
  } | null;
}

interface ReviewCardsResponse {
  dueCards: CardWithProgress[];
  newCards: CardWithProgress[];
  totalDue: number;
}

interface ReviewSubmitResponse {
  success: boolean;
  nextReview: {
    intervalDays: number;
    dueAt: Date;
  };
  cardState: {
    easeFactor: number;
    repetitions: number;
  };
}

interface SessionStats {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export default function RecognitionReviewPage({
  params,
}: {
  params: { deckId: string };
}) {
  const router = useRouter();
  const [cards, setCards] = useState<CardWithProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [sessionComplete, setSessionComplete] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());
  const [nextIntervals, setNextIntervals] = useState({
    again: '< 1m',
    hard: '< 10m',
    good: '1d',
    easy: '4d',
  });

  // Fetch cards on mount
  useEffect(() => {
    fetchCards();
  }, [params.deckId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (sessionComplete) return;

      if (e.key === ' ' && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const rating = parseInt(e.key) as 1 | 2 | 3 | 4;
        handleRating(rating);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [revealed, sessionComplete, currentIndex]);

  // Calculate predicted intervals when card is revealed
  useEffect(() => {
    if (revealed && cards[currentIndex]) {
      const card = cards[currentIndex];
      const currentInterval = card.cardProgress?.intervalDays || 0;
      const easeFactor = card.cardProgress?.easeFactor || 2.5;
      const repetitions = card.cardProgress?.repetitions || 0;

      const formatInterval = (days: number): string => {
        if (days === 0) return '< 1m';
        if (days < 1) return '< 10m';
        if (days === 1) return '1d';
        if (days < 30) return `${days}d`;
        if (days < 365) return `${Math.round(days / 30)}mo`;
        return `${Math.round(days / 365)}y`;
      };

      // Calculate intervals for each rating
      const againInterval = 0;
      const hardInterval = Math.max(1, Math.round(currentInterval * 1.2));

      let goodInterval: number;
      if (repetitions === 0) goodInterval = 1;
      else if (repetitions === 1) goodInterval = 6;
      else goodInterval = Math.round(currentInterval * easeFactor);

      let easyInterval: number;
      if (repetitions === 0) easyInterval = 4;
      else if (repetitions === 1) easyInterval = 10;
      else easyInterval = Math.round(currentInterval * easeFactor * 1.3);

      setNextIntervals({
        again: formatInterval(againInterval),
        hard: formatInterval(hardInterval),
        good: formatInterval(goodInterval),
        easy: formatInterval(easyInterval),
      });
    }
  }, [revealed, currentIndex, cards]);

  const fetchCards = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/review/${params.deckId}?limit=20`);

      if (!response.ok) {
        throw new Error('Failed to fetch cards');
      }

      const data: ReviewCardsResponse = await response.json();
      const allCards = [...data.dueCards, ...data.newCards];

      if (allCards.length === 0) {
        setSessionComplete(true);
      } else {
        setCards(allCards);
        setCardStartTime(Date.now());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleRating = async (rating: 1 | 2 | 3 | 4) => {
    if (submitting || !cards[currentIndex]) return;

    const card = cards[currentIndex];
    const responseTimeMs = Date.now() - cardStartTime;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/review/${params.deckId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: card.id,
          rating,
          reviewMode: 'recognition',
          responseTimeMs,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit review');
      }

      // Update session stats
      const ratingKey = ['again', 'hard', 'good', 'easy'][rating - 1] as keyof SessionStats;
      setSessionStats((prev) => ({
        ...prev,
        [ratingKey]: prev[ratingKey] + 1,
      }));

      // Move to next card or complete session
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setRevealed(false);
        setCardStartTime(Date.now());
      } else {
        setSessionComplete(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSessionTime = (): string => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Error</h2>
          <p className="text-gray-600 mb-4 text-center">{error}</p>
          <button
            onClick={() => router.back()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const totalReviewed = sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-green-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Complete</h2>
            <p className="text-gray-600 text-lg mb-1">{totalReviewed} cards reviewed</p>
            <p className="text-gray-500">{formatSessionTime()}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-red-800 text-sm font-medium mb-1">Again</p>
              <p className="text-red-900 text-2xl font-bold">{sessionStats.again}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-yellow-800 text-sm font-medium mb-1">Hard</p>
              <p className="text-yellow-900 text-2xl font-bold">{sessionStats.hard}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-green-800 text-sm font-medium mb-1">Good</p>
              <p className="text-green-900 text-2xl font-bold">{sessionStats.good}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-800 text-sm font-medium mb-1">Easy</p>
              <p className="text-blue-900 text-2xl font-bold">{sessionStats.easy}</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Cards Due</h2>
          <p className="text-gray-600 mb-6">You're all caught up! Come back later for more reviews.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progress = currentIndex + 1;
  const total = cards.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">
          {progress}/{total}
        </div>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to exit? Your progress will be saved.')) {
              router.push('/');
            }
          }}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-blue-600 h-1" style={{ width: `${(progress / total) * 100}%` }}></div>

      {/* Card content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Card front (Korean) */}
          <div
            onClick={!revealed ? handleReveal : undefined}
            className={`p-8 min-h-[400px] flex flex-col items-center justify-center ${
              !revealed ? 'cursor-pointer hover:bg-gray-50' : ''
            } transition-colors`}
          >
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold text-gray-900 mb-4">{currentCard.korean}</h1>
              {!revealed && (
                <p className="text-gray-500 text-sm">Tap to reveal or press Space</p>
              )}
            </div>

            {/* Revealed content */}
            {revealed && (
              <div className="w-full space-y-6 animate-fade-in">
                <div className="border-t border-gray-200 pt-6">
                  <p className="text-2xl text-gray-800 text-center font-medium mb-2">
                    {currentCard.english}
                  </p>
                </div>

                {currentCard.exampleKorean && currentCard.exampleEnglish && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Example:</p>
                    <p className="text-gray-900 mb-2">{currentCard.exampleKorean}</p>
                    <p className="text-gray-600 italic">{currentCard.exampleEnglish}</p>
                  </div>
                )}

                {currentCard.notes && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-1">Notes:</p>
                    <p className="text-blue-800">{currentCard.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rating buttons */}
          {revealed && (
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleRating(1)}
                  disabled={submitting}
                  className="flex flex-col items-center justify-center p-4 bg-white border-2 border-red-500 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold mb-1">Again</span>
                  <span className="text-xs text-gray-600">{nextIntervals.again}</span>
                  <span className="text-xs text-gray-400 mt-1">Press 1</span>
                </button>
                <button
                  onClick={() => handleRating(2)}
                  disabled={submitting}
                  className="flex flex-col items-center justify-center p-4 bg-white border-2 border-yellow-500 text-yellow-700 rounded-lg hover:bg-yellow-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold mb-1">Hard</span>
                  <span className="text-xs text-gray-600">{nextIntervals.hard}</span>
                  <span className="text-xs text-gray-400 mt-1">Press 2</span>
                </button>
                <button
                  onClick={() => handleRating(3)}
                  disabled={submitting}
                  className="flex flex-col items-center justify-center p-4 bg-white border-2 border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold mb-1">Good</span>
                  <span className="text-xs text-gray-600">{nextIntervals.good}</span>
                  <span className="text-xs text-gray-400 mt-1">Press 3</span>
                </button>
                <button
                  onClick={() => handleRating(4)}
                  disabled={submitting}
                  className="flex flex-col items-center justify-center p-4 bg-white border-2 border-blue-500 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold mb-1">Easy</span>
                  <span className="text-xs text-gray-600">{nextIntervals.easy}</span>
                  <span className="text-xs text-gray-400 mt-1">Press 4</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
