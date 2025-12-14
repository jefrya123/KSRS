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

interface SessionStats {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

interface CharDiff {
  char: string;
  type: 'correct' | 'wrong' | 'missing' | 'extra';
}

// Fuzzy matching utilities
function normalizeKorean(text: string): string {
  // Remove spaces, punctuation, and normalize
  return text
    .replace(/\s+/g, '')
    .replace(/[!?,\.。、]/g, '')
    .trim()
    .toLowerCase();
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeKorean(str1);
  const s2 = normalizeKorean(str2);

  if (s1 === s2) return 100;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;

  // Levenshtein distance
  const editDistance = levenshteinDistance(s1, s2);
  const similarity = ((longer.length - editDistance) / longer.length) * 100;

  return Math.round(similarity);
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function generateCharDiff(userAnswer: string, correctAnswer: string): CharDiff[] {
  const user = normalizeKorean(userAnswer);
  const correct = normalizeKorean(correctAnswer);
  const diffs: CharDiff[] = [];

  const maxLen = Math.max(user.length, correct.length);

  for (let i = 0; i < maxLen; i++) {
    const userChar = user[i];
    const correctChar = correct[i];

    if (userChar && correctChar) {
      if (userChar === correctChar) {
        diffs.push({ char: userChar, type: 'correct' });
      } else {
        diffs.push({ char: `${userChar}→${correctChar}`, type: 'wrong' });
      }
    } else if (correctChar) {
      diffs.push({ char: correctChar, type: 'missing' });
    } else if (userChar) {
      diffs.push({ char: userChar, type: 'extra' });
    }
  }

  return diffs;
}

export default function TypingReviewPage({
  params,
}: {
  params: { deckId: string };
}) {
  const router = useRouter();
  const [cards, setCards] = useState<CardWithProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [similarity, setSimilarity] = useState(0);
  const [charDiff, setCharDiff] = useState<CharDiff[]>([]);
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

      if (e.key === 'Enter' && !checked && userAnswer.trim()) {
        e.preventDefault();
        handleCheck();
      } else if (checked && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const rating = parseInt(e.key) as 1 | 2 | 3 | 4;
        handleRating(rating);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [checked, userAnswer, sessionComplete, currentIndex]);

  // Calculate predicted intervals when checked
  useEffect(() => {
    if (checked && cards[currentIndex]) {
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
  }, [checked, currentIndex, cards]);

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

  const handleCheck = () => {
    if (!userAnswer.trim() || !cards[currentIndex]) return;

    const correctAnswer = cards[currentIndex].korean;
    const sim = calculateSimilarity(userAnswer, correctAnswer);
    const diff = generateCharDiff(userAnswer, correctAnswer);

    setSimilarity(sim);
    setCharDiff(diff);
    setIsCorrect(sim >= 95); // 95% similarity threshold for "correct"
    setChecked(true);
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
          reviewMode: 'typing',
          responseTimeMs,
          userAnswer,
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
        setUserAnswer('');
        setChecked(false);
        setIsCorrect(false);
        setSimilarity(0);
        setCharDiff([]);
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
          {/* Prompt */}
          <div className="p-8">
            <div className="text-center mb-8">
              <p className="text-gray-600 text-sm mb-4">Translate to Korean:</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-6">{currentCard.english}</h1>
            </div>

            {/* Input */}
            {!checked ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full px-4 py-3 text-2xl text-center border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  autoFocus
                  disabled={checked}
                />
                <button
                  onClick={handleCheck}
                  disabled={!userAnswer.trim()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Check Answer
                </button>
                <p className="text-sm text-gray-500 text-center">Press Enter to check</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Result */}
                <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center justify-center mb-2">
                    {isCorrect ? (
                      <>
                        <svg className="w-6 h-6 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-900 font-semibold">Correct!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-red-900 font-semibold">Not quite ({similarity}% match)</span>
                      </>
                    )}
                  </div>

                  {/* Comparison */}
                  <div className="space-y-2 text-center">
                    <div>
                      <span className="text-xs text-gray-600">Your answer:</span>
                      <p className="text-lg font-medium text-gray-900">{userAnswer}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Expected:</span>
                      <p className="text-lg font-medium text-gray-900">{currentCard.korean}</p>
                    </div>
                  </div>

                  {/* Character diff */}
                  {!isCorrect && charDiff.length > 0 && (
                    <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-600 mb-2">Differences:</p>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {charDiff.map((diff, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded text-sm font-mono ${
                              diff.type === 'correct'
                                ? 'bg-green-100 text-green-800'
                                : diff.type === 'wrong'
                                ? 'bg-red-100 text-red-800'
                                : diff.type === 'missing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {diff.char}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional info */}
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
          {checked && (
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
