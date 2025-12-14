import { describe, it, expect } from 'vitest';
import {
  calculateUsefulness,
  getTagScore,
  getFrequencyScore,
  getPatternScore,
  normalizeScore,
  DEFAULT_CONFIG,
  type CardInput,
  type ScoringConfig,
} from './score';

describe('calculateUsefulness', () => {
  it('should score basic card with no special features around 50', () => {
    const card: CardInput = {
      korean: '사과',
      english: 'apple',
      tags: [],
    };

    const result = calculateUsefulness(card);
    expect(result.score).toBe(50);
    expect(result.reasons).toContain('base score: 50');
  });

  it('should increase score for beginner + travel tags', () => {
    const card: CardInput = {
      korean: '안녕하세요',
      english: 'hello',
      tags: ['beginner', 'travel'],
    };

    const result = calculateUsefulness(card);
    // Base: 50, beginner: +10, travel: +8 = 68
    expect(result.score).toBe(68);
    expect(result.reasons).toContain("+10 for 'beginner' tag");
    expect(result.reasons).toContain("+8 for 'travel' tag");
  });

  it('should score pattern cards higher than vocab', () => {
    const vocabCard: CardInput = {
      korean: '학교',
      english: 'school',
      tags: [],
    };

    const patternCard: CardInput = {
      korean: '~고 싶다',
      english: 'want to',
      tags: [],
      isPattern: true,
    };

    const vocabResult = calculateUsefulness(vocabCard);
    const patternResult = calculateUsefulness(patternCard);

    // Pattern should be +15 higher
    expect(patternResult.score).toBe(vocabResult.score + 15);
    expect(patternResult.reasons).toContain('+15 grammar pattern bonus');
  });

  it('should boost score for high frequency rank', () => {
    const highFreqCard: CardInput = {
      korean: '이',
      english: 'this',
      tags: [],
      frequencyRank: 500,
    };

    const result = calculateUsefulness(highFreqCard);
    // Base: 50, frequency: +20 = 70
    expect(result.score).toBe(70);
    expect(result.reasons).toContain('high-frequency word (rank 1-1000)');
  });

  it('should give medium boost for medium frequency rank', () => {
    const medFreqCard: CardInput = {
      korean: '커피',
      english: 'coffee',
      tags: [],
      frequencyRank: 3000,
    };

    const result = calculateUsefulness(medFreqCard);
    // Base: 50, frequency: +10 = 60
    expect(result.score).toBe(60);
    expect(result.reasons).toContain('medium-frequency word (rank 1000-5000)');
  });

  it('should give no boost for low frequency rank', () => {
    const lowFreqCard: CardInput = {
      korean: '얼룩말',
      english: 'zebra',
      tags: [],
      frequencyRank: 8000,
    };

    const result = calculateUsefulness(lowFreqCard);
    // Base: 50, frequency: +0 = 50
    expect(result.score).toBe(50);
    expect(result.reasons).toContain('low-frequency word (rank 5000+)');
  });

  it('should use manual override when provided', () => {
    const card: CardInput = {
      korean: '테스트',
      english: 'test',
      tags: ['beginner'],
      manualScore: 95,
    };

    const result = calculateUsefulness(card);
    expect(result.score).toBe(95);
    expect(result.reasons).toEqual(['manual score override']);
  });

  it('should penalize score for rare tag', () => {
    const card: CardInput = {
      korean: '희귀한',
      english: 'rare thing',
      tags: ['rare'],
    };

    const result = calculateUsefulness(card);
    // Base: 50, rare: -5 = 45
    expect(result.score).toBe(45);
    expect(result.reasons).toContain("-5 for 'rare' tag");
  });

  it('should always keep score within 0-100 range', () => {
    const highCard: CardInput = {
      korean: '안녕하세요',
      english: 'hello',
      tags: ['beginner', 'essential', 'greeting', 'travel', 'food'],
      isPattern: true,
      frequencyRank: 100,
    };

    const lowCard: CardInput = {
      korean: '희귀',
      english: 'extremely rare',
      tags: ['rare', 'rare', 'rare'],
      frequencyRank: 9999,
    };

    const highResult = calculateUsefulness(highCard);
    const lowResult = calculateUsefulness(lowCard);

    expect(highResult.score).toBeGreaterThanOrEqual(0);
    expect(highResult.score).toBeLessThanOrEqual(100);
    expect(lowResult.score).toBeGreaterThanOrEqual(0);
    expect(lowResult.score).toBeLessThanOrEqual(100);
  });

  it('should provide reasons array that explains the score', () => {
    const card: CardInput = {
      korean: '감사합니다',
      english: 'thank you',
      tags: ['beginner', 'greeting'],
      isPattern: false,
      frequencyRank: 200,
    };

    const result = calculateUsefulness(card);
    expect(result.reasons).toBeInstanceOf(Array);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons).toContain('base score: 50');
    expect(result.reasons).toContain("+10 for 'beginner' tag");
    expect(result.reasons).toContain("+9 for 'greeting' tag");
    expect(result.reasons).toContain('high-frequency word (rank 1-1000)');
  });

  it('should combine multiple tags correctly', () => {
    const card: CardInput = {
      korean: '맥주 주세요',
      english: 'beer please',
      tags: ['food', 'travel', 'beginner'],
    };

    const result = calculateUsefulness(card);
    // Base: 50, food: +7, travel: +8, beginner: +10 = 75
    expect(result.score).toBe(75);
    expect(result.reasons).toContain("+7 for 'food' tag");
    expect(result.reasons).toContain("+8 for 'travel' tag");
    expect(result.reasons).toContain("+10 for 'beginner' tag");
  });

  it('should allow custom tag weights in config', () => {
    const card: CardInput = {
      korean: '의학',
      english: 'medicine',
      tags: ['medical'],
    };

    const customConfig: Partial<ScoringConfig> = {
      tagWeights: {
        medical: 15,
      },
    };

    const result = calculateUsefulness(card, customConfig);
    // Base: 50, medical: +15 = 65
    expect(result.score).toBe(65);
    expect(result.reasons).toContain("+15 for 'medical' tag");
  });

  it('should respect custom pattern bonus', () => {
    const card: CardInput = {
      korean: '~아/어야 하다',
      english: 'must/have to',
      tags: [],
      isPattern: true,
    };

    const customConfig: Partial<ScoringConfig> = {
      patternBonus: 25,
    };

    const result = calculateUsefulness(card, customConfig);
    // Base: 50, pattern: +25 = 75
    expect(result.score).toBe(75);
    expect(result.reasons).toContain('+25 grammar pattern bonus');
  });

  it('should handle combination of all scoring factors', () => {
    const card: CardInput = {
      korean: '~고 싶어요',
      english: 'I want to',
      tags: ['beginner', 'essential', 'pattern'],
      isPattern: true,
      frequencyRank: 50,
    };

    const result = calculateUsefulness(card);
    // Base: 50, beginner: +10, essential: +10, pattern: +8, isPattern: +15, frequency: +20
    // But tag impact is capped at ±30, so: 50 + 28 (capped) + 15 + 20 = 113 -> clamped to 100
    // Actually: beginner(10) + essential(10) + pattern(8) = 28, not capped
    // Total: 50 + 28 + 15 + 20 = 113 -> 100
    expect(result.score).toBe(100);
    expect(result.reasons).toContain('base score: 50');
    expect(result.reasons).toContain('high-frequency word (rank 1-1000)');
    expect(result.reasons).toContain('+15 grammar pattern bonus');
  });

  it('should handle empty tags array', () => {
    const card: CardInput = {
      korean: '단어',
      english: 'word',
      tags: [],
    };

    const result = calculateUsefulness(card);
    expect(result.score).toBe(50);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should ignore unknown tags', () => {
    const card: CardInput = {
      korean: '테스트',
      english: 'test',
      tags: ['unknown-tag', 'another-unknown'],
    };

    const result = calculateUsefulness(card);
    expect(result.score).toBe(50);
    expect(result.reasons).toContain('base score: 50');
  });

  it('should cap tag contribution at max impact', () => {
    const card: CardInput = {
      korean: '초보자용',
      english: 'for beginners',
      tags: ['beginner', 'essential', 'greeting', 'travel', 'food', 'pattern', 'business'],
    };

    const result = calculateUsefulness(card);
    // beginner(10) + essential(10) + greeting(9) + travel(8) + food(7) + pattern(8) + business(6) = 58
    // Capped at 30
    // Base: 50, tags: +30 = 80
    expect(result.score).toBe(80);
    expect(result.reasons).toContain('tag score capped at ±30');
  });

  it('should handle negative tag scores exceeding minimum', () => {
    const card: CardInput = {
      korean: '희귀한',
      english: 'very rare',
      tags: ['rare', 'rare', 'rare', 'rare', 'rare', 'rare', 'rare'],
    };

    const result = calculateUsefulness(card);
    // 7 rare tags * -5 = -35, capped at -30
    // Base: 50, tags: -30 = 20
    expect(result.score).toBe(20);
    expect(result.reasons).toContain('tag score capped at ±30');
  });
});

describe('getTagScore', () => {
  it('should return zero score for empty tags', () => {
    const result = getTagScore([], DEFAULT_CONFIG.tagWeights);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('should calculate score for single tag', () => {
    const result = getTagScore(['beginner'], DEFAULT_CONFIG.tagWeights);
    expect(result.score).toBe(10);
    expect(result.reasons).toContain("+10 for 'beginner' tag");
  });

  it('should sum multiple tag scores', () => {
    const result = getTagScore(['beginner', 'travel'], DEFAULT_CONFIG.tagWeights);
    expect(result.score).toBe(18); // 10 + 8
    expect(result.reasons).toHaveLength(2);
  });

  it('should handle negative weights', () => {
    const result = getTagScore(['rare'], DEFAULT_CONFIG.tagWeights);
    expect(result.score).toBe(-5);
    expect(result.reasons).toContain("-5 for 'rare' tag");
  });

  it('should ignore tags not in weights', () => {
    const result = getTagScore(['unknown'], DEFAULT_CONFIG.tagWeights);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });
});

describe('getFrequencyScore', () => {
  it('should return 20 for rank 1-1000', () => {
    expect(getFrequencyScore(1).score).toBe(20);
    expect(getFrequencyScore(500).score).toBe(20);
    expect(getFrequencyScore(1000).score).toBe(20);
  });

  it('should return 10 for rank 1000-5000', () => {
    expect(getFrequencyScore(1001).score).toBe(10);
    expect(getFrequencyScore(3000).score).toBe(10);
    expect(getFrequencyScore(5000).score).toBe(10);
  });

  it('should return 0 for rank above 5000', () => {
    expect(getFrequencyScore(5001).score).toBe(0);
    expect(getFrequencyScore(10000).score).toBe(0);
  });

  it('should return 0 for undefined rank', () => {
    const result = getFrequencyScore(undefined);
    expect(result.score).toBe(0);
    expect(result.reason).toBeUndefined();
  });

  it('should provide appropriate reasons', () => {
    expect(getFrequencyScore(100).reason).toBe('high-frequency word (rank 1-1000)');
    expect(getFrequencyScore(2000).reason).toBe('medium-frequency word (rank 1000-5000)');
    expect(getFrequencyScore(8000).reason).toBe('low-frequency word (rank 5000+)');
  });
});

describe('getPatternScore', () => {
  it('should return bonus for pattern cards', () => {
    const result = getPatternScore(true, 15);
    expect(result.score).toBe(15);
    expect(result.reason).toBe('+15 grammar pattern bonus');
  });

  it('should return zero for non-pattern cards', () => {
    const result = getPatternScore(false, 15);
    expect(result.score).toBe(0);
    expect(result.reason).toBeUndefined();
  });

  it('should respect custom bonus amount', () => {
    const result = getPatternScore(true, 25);
    expect(result.score).toBe(25);
    expect(result.reason).toBe('+25 grammar pattern bonus');
  });
});

describe('normalizeScore', () => {
  it('should clamp negative scores to 0', () => {
    expect(normalizeScore(-10)).toBe(0);
    expect(normalizeScore(-100)).toBe(0);
  });

  it('should clamp scores above 100', () => {
    expect(normalizeScore(110)).toBe(100);
    expect(normalizeScore(200)).toBe(100);
  });

  it('should keep valid scores unchanged', () => {
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(50)).toBe(50);
    expect(normalizeScore(100)).toBe(100);
  });

  it('should round decimal scores', () => {
    expect(normalizeScore(50.4)).toBe(50);
    expect(normalizeScore(50.6)).toBe(51);
  });
});
