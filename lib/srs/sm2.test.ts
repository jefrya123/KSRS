import { describe, it, expect } from 'vitest';
import {
  getInitialState,
  calculateNextReview,
  calculateNewEaseFactor,
  calculateNextInterval,
  isCardDue,
  getIntervalDisplay,
  type CardState,
  type Rating,
} from './sm2';

describe('SM-2 Spaced Repetition Algorithm', () => {
  describe('getInitialState', () => {
    it('should return correct default values', () => {
      const state = getInitialState();

      expect(state.easeFactor).toBe(2.5);
      expect(state.intervalDays).toBe(0);
      expect(state.repetitions).toBe(0);
      expect(state.dueAt).toBeInstanceOf(Date);
    });
  });

  describe('calculateNewEaseFactor', () => {
    it('should decrease ease factor for Again rating', () => {
      const result = calculateNewEaseFactor(2.5, 1);
      expect(result).toBe(2.3);
    });

    it('should decrease ease factor for Hard rating', () => {
      const result = calculateNewEaseFactor(2.5, 2);
      expect(result).toBe(2.35);
    });

    it('should not change ease factor for Good rating', () => {
      const result = calculateNewEaseFactor(2.5, 3);
      expect(result).toBe(2.5);
    });

    it('should increase ease factor for Easy rating', () => {
      const result = calculateNewEaseFactor(2.5, 4);
      expect(result).toBe(2.65);
    });

    it('should never go below 1.3', () => {
      let ease = 1.4;
      ease = calculateNewEaseFactor(ease, 1); // 1.2, clamped to 1.3
      expect(ease).toBe(1.3);

      ease = calculateNewEaseFactor(ease, 1); // Still 1.3
      expect(ease).toBe(1.3);
    });

    it('should allow ease factor to increase from minimum', () => {
      const result = calculateNewEaseFactor(1.3, 4);
      expect(result).toBe(1.45);
    });
  });

  describe('calculateNextInterval', () => {
    it('should return 1 minute for Again rating', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 10,
        repetitions: 5,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 1);
      expect(interval).toBe(1 / (24 * 60)); // 1 minute as fraction of day
    });

    it('should return 1 day for first Good review', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 3);
      expect(interval).toBe(1);
    });

    it('should return 1 day for first Hard review', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 2);
      expect(interval).toBe(1);
    });

    it('should return 4 days for first Easy review', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 4);
      expect(interval).toBe(4);
    });

    it('should return 6 days for second Good review', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 3);
      expect(interval).toBe(6);
    });

    it('should return 6 × 1.2 days for second Hard review', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 2);
      expect(interval).toBe(7.2);
    });

    it('should return 6 × 1.3 days for second Easy review', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 4);
      expect(interval).toBe(7.8);
    });

    it('should multiply by ease factor for subsequent Good reviews', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 6,
        repetitions: 2,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 3);
      expect(interval).toBe(15); // 6 × 2.5
    });

    it('should multiply by 1.2 for subsequent Hard reviews', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 15,
        repetitions: 3,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 2);
      expect(interval).toBe(18); // 15 × 1.2
    });

    it('should multiply by ease × 1.3 for subsequent Easy reviews', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 15,
        repetitions: 3,
        dueAt: new Date(),
      };

      const interval = calculateNextInterval(state, 4);
      expect(interval).toBe(48.75); // 15 × 2.5 × 1.3
    });
  });

  describe('calculateNextReview', () => {
    it('should reset repetitions to 0 for Again rating', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 15,
        repetitions: 5,
        dueAt: new Date(),
      };

      const result = calculateNextReview(state, 1);
      expect(result.newState.repetitions).toBe(0);
      expect(result.newState.intervalDays).toBe(1 / (24 * 60));
    });

    it('should increment repetitions for successful reviews', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 0,
        dueAt: new Date(),
      };

      const result = calculateNextReview(state, 3);
      expect(result.newState.repetitions).toBe(1);
    });

    it('should calculate correct next review date', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: now,
      };

      const result = calculateNextReview(state, 3, now);
      const expected = new Date('2025-01-02T12:00:00Z'); // 1 day later

      expect(result.nextReviewDate.getTime()).toBe(expected.getTime());
      expect(result.newState.dueAt.getTime()).toBe(expected.getTime());
    });

    it('should handle full review lifecycle correctly', () => {
      let state = getInitialState();

      // First review: Good (1 day)
      let result = calculateNextReview(state, 3);
      expect(result.newState.intervalDays).toBe(1);
      expect(result.newState.repetitions).toBe(1);
      expect(result.newState.easeFactor).toBe(2.5);

      // Second review: Good (6 days)
      state = result.newState;
      result = calculateNextReview(state, 3);
      expect(result.newState.intervalDays).toBe(6);
      expect(result.newState.repetitions).toBe(2);
      expect(result.newState.easeFactor).toBe(2.5);

      // Third review: Good (15 days = 6 × 2.5)
      state = result.newState;
      result = calculateNextReview(state, 3);
      expect(result.newState.intervalDays).toBe(15);
      expect(result.newState.repetitions).toBe(3);
      expect(result.newState.easeFactor).toBe(2.5);

      // Fourth review: Easy (48.75 days = 15 × 2.5 × 1.3, ease +0.15)
      state = result.newState;
      result = calculateNextReview(state, 4);
      expect(result.newState.intervalDays).toBe(48.75);
      expect(result.newState.repetitions).toBe(4);
      expect(result.newState.easeFactor).toBe(2.65);

      // Fifth review: Hard (58.5 days = 48.75 × 1.2, ease -0.15)
      state = result.newState;
      result = calculateNextReview(state, 2);
      expect(result.newState.intervalDays).toBe(58.5);
      expect(result.newState.repetitions).toBe(5);
      expect(result.newState.easeFactor).toBe(2.5);

      // Sixth review: Again (reset)
      state = result.newState;
      result = calculateNextReview(state, 1);
      expect(result.newState.intervalDays).toBe(1 / (24 * 60));
      expect(result.newState.repetitions).toBe(0);
      expect(result.newState.easeFactor).toBe(2.3); // 2.5 - 0.2
    });
  });

  describe('isCardDue', () => {
    it('should return true when card is due', () => {
      const past = new Date('2025-01-01T12:00:00Z');
      const now = new Date('2025-01-05T12:00:00Z');

      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueAt: past,
      };

      expect(isCardDue(state, now)).toBe(true);
    });

    it('should return true when card is due exactly now', () => {
      const now = new Date('2025-01-05T12:00:00Z');

      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueAt: now,
      };

      expect(isCardDue(state, now)).toBe(true);
    });

    it('should return false when card is not due yet', () => {
      const future = new Date('2025-01-10T12:00:00Z');
      const now = new Date('2025-01-05T12:00:00Z');

      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueAt: future,
      };

      expect(isCardDue(state, now)).toBe(false);
    });

    it('should use current date when now is not provided', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueAt: past,
      };

      expect(isCardDue(state)).toBe(true);
    });
  });

  describe('getIntervalDisplay', () => {
    it('should format minutes correctly', () => {
      expect(getIntervalDisplay(1 / (24 * 60))).toBe('1m');
      expect(getIntervalDisplay(10 / (24 * 60))).toBe('10m');
      expect(getIntervalDisplay(30 / (24 * 60))).toBe('30m');
    });

    it('should format hours correctly', () => {
      expect(getIntervalDisplay(1 / 24)).toBe('1h');
      expect(getIntervalDisplay(2 / 24)).toBe('2h');
      expect(getIntervalDisplay(12 / 24)).toBe('12h');
    });

    it('should format days correctly', () => {
      expect(getIntervalDisplay(1)).toBe('1d');
      expect(getIntervalDisplay(5)).toBe('5d');
      expect(getIntervalDisplay(13)).toBe('13d');
    });

    it('should format weeks correctly', () => {
      expect(getIntervalDisplay(14)).toBe('2w');
      expect(getIntervalDisplay(21)).toBe('3w');
      expect(getIntervalDisplay(28)).toBe('4w');
      expect(getIntervalDisplay(56)).toBe('8w');
    });

    it('should format months correctly', () => {
      expect(getIntervalDisplay(60)).toBe('2m');
      expect(getIntervalDisplay(90)).toBe('3m');
      expect(getIntervalDisplay(180)).toBe('6m');
      expect(getIntervalDisplay(365)).toBe('12m');
    });

    it('should round to nearest unit', () => {
      expect(getIntervalDisplay(1.4)).toBe('1d');
      expect(getIntervalDisplay(1.6)).toBe('2d');
      expect(getIntervalDisplay(15.5)).toBe('2w'); // 2.2 weeks rounds to 2
      expect(getIntervalDisplay(17.5)).toBe('3w'); // 2.5 weeks rounds to 3
    });
  });

  describe('Edge cases', () => {
    it('should handle ease factor at minimum with multiple Again ratings', () => {
      let state: CardState = {
        easeFactor: 1.3,
        intervalDays: 10,
        repetitions: 5,
        dueAt: new Date(),
      };

      // Multiple Again ratings should keep ease at 1.3
      for (let i = 0; i < 5; i++) {
        const result = calculateNextReview(state, 1);
        expect(result.newState.easeFactor).toBe(1.3);
        state = result.newState;
      }
    });

    it('should handle alternating Hard and Easy ratings', () => {
      let state = getInitialState();

      // Good review
      let result = calculateNextReview(state, 3);
      expect(result.newState.easeFactor).toBe(2.5);

      // Easy review (ease +0.15)
      state = result.newState;
      result = calculateNextReview(state, 4);
      expect(result.newState.easeFactor).toBe(2.65);

      // Hard review (ease -0.15)
      state = result.newState;
      result = calculateNextReview(state, 2);
      expect(result.newState.easeFactor).toBe(2.5);

      // Hard review again (ease -0.15)
      state = result.newState;
      result = calculateNextReview(state, 2);
      expect(result.newState.easeFactor).toBe(2.35);
    });

    it('should handle very long intervals', () => {
      const state: CardState = {
        easeFactor: 2.5,
        intervalDays: 365,
        repetitions: 10,
        dueAt: new Date(),
      };

      const result = calculateNextReview(state, 3);
      expect(result.newState.intervalDays).toBe(912.5); // 365 × 2.5
      expect(getIntervalDisplay(912.5)).toBe('30m'); // ~30 months
    });

    it('should handle first review with Easy rating bonus', () => {
      const state = getInitialState();

      const result = calculateNextReview(state, 4);
      expect(result.newState.intervalDays).toBe(4); // 4 days instead of 1
      expect(result.newState.easeFactor).toBe(2.65); // 2.5 + 0.15
      expect(result.newState.repetitions).toBe(1);
    });

    it('should handle recovery from Again rating', () => {
      let state: CardState = {
        easeFactor: 2.5,
        intervalDays: 30,
        repetitions: 5,
        dueAt: new Date(),
      };

      // Again rating resets
      let result = calculateNextReview(state, 1);
      expect(result.newState.repetitions).toBe(0);
      expect(result.newState.easeFactor).toBe(2.3);

      // Good review starts over at 1 day
      state = result.newState;
      result = calculateNextReview(state, 3);
      expect(result.newState.intervalDays).toBe(1);
      expect(result.newState.repetitions).toBe(1);

      // Second Good review goes to 6 days
      state = result.newState;
      result = calculateNextReview(state, 3);
      expect(result.newState.intervalDays).toBe(6);
      expect(result.newState.repetitions).toBe(2);

      // Third review uses ease factor (6 × 2.3 = 13.8)
      state = result.newState;
      result = calculateNextReview(state, 3);
      expect(result.newState.intervalDays).toBe(13.8);
      expect(result.newState.repetitions).toBe(3);
    });
  });
});
