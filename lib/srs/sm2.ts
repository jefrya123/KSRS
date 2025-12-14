// Types
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface CardState {
  easeFactor: number;    // Default 2.5, min 1.3
  intervalDays: number;  // Days until next review
  repetitions: number;   // Successful reviews in a row
  dueAt: Date;
}

export interface ReviewResult {
  newState: CardState;
  nextReviewDate: Date;
}

// Main function
export function calculateNextReview(
  currentState: CardState,
  rating: Rating,
  reviewedAt?: Date
): ReviewResult {
  const now = reviewedAt || new Date();
  const newEaseFactor = calculateNewEaseFactor(currentState.easeFactor, rating);
  const newInterval = calculateNextInterval(currentState, rating);

  let newRepetitions: number;
  if (rating === 1) {
    // Reset to learning phase
    newRepetitions = 0;
  } else {
    // Increment successful reviews
    newRepetitions = currentState.repetitions + 1;
  }

  // Calculate next review date
  const nextReviewDate = new Date(now);
  nextReviewDate.setTime(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  const newState: CardState = {
    easeFactor: newEaseFactor,
    intervalDays: newInterval,
    repetitions: newRepetitions,
    dueAt: nextReviewDate,
  };

  return {
    newState,
    nextReviewDate,
  };
}

// Helper functions
export function getInitialState(): CardState {
  return {
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: new Date(),
  };
}

export function calculateNewEaseFactor(current: number, rating: Rating): number {
  let newEase = current;

  switch (rating) {
    case 1: // Again
      newEase -= 0.2;
      break;
    case 2: // Hard
      newEase -= 0.15;
      break;
    case 3: // Good
      // No change
      break;
    case 4: // Easy
      newEase += 0.15;
      break;
  }

  // Minimum ease factor is 1.3
  return Math.max(1.3, newEase);
}

export function calculateNextInterval(state: CardState, rating: Rating): number {
  const { intervalDays, repetitions, easeFactor } = state;

  // Rating 1 (Again): Reset to 1 minute
  if (rating === 1) {
    return 1 / (24 * 60); // 1 minute as fraction of day
  }

  // First successful review
  if (repetitions === 0) {
    if (rating === 4) {
      // Easy on first review: 4 days
      return 4;
    }
    // Good or Hard on first review: 1 day
    return 1;
  }

  // Second successful review
  if (repetitions === 1) {
    if (rating === 4) {
      // Easy on second review: 6 × 1.3 = 7.8 days
      return 6 * 1.3;
    } else if (rating === 2) {
      // Hard on second review: 6 × 1.2 = 7.2 days
      return 6 * 1.2;
    }
    // Good on second review: 6 days
    return 6;
  }

  // Subsequent reviews: apply SM-2 algorithm
  switch (rating) {
    case 2: // Hard
      return intervalDays * 1.2;
    case 3: // Good
      return intervalDays * easeFactor;
    case 4: // Easy
      return intervalDays * easeFactor * 1.3;
    default:
      return intervalDays;
  }
}

export function isCardDue(state: CardState, now?: Date): boolean {
  const currentTime = now || new Date();
  return state.dueAt <= currentTime;
}

export function getIntervalDisplay(days: number): string {
  // Less than 1 day: show minutes or hours
  if (days < 1) {
    const minutes = Math.round(days * 24 * 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }

  // Less than 14 days: show days
  if (days < 14) {
    return `${Math.round(days)}d`;
  }

  // Less than 60 days: show weeks
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${weeks}w`;
  }

  // 60 days or more: show months
  const months = Math.round(days / 30);
  return `${months}m`;
}
