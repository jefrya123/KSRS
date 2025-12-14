import { describe, it, expect } from 'vitest';
import {
  normalizeKorean,
  fuzzyMatch,
  levenshteinDistance,
  calculateSimilarity,
  findDifferences,
  generateDiffHtml,
  getConfusionTip,
} from './match';

describe('normalizeKorean', () => {
  it('removes whitespace', () => {
    expect(normalizeKorean('안녕 하세요')).toBe('안녕하세요');
    expect(normalizeKorean('감사  합니다')).toBe('감사합니다');
  });

  it('removes punctuation', () => {
    expect(normalizeKorean('안녕하세요!')).toBe('안녕하세요');
    expect(normalizeKorean('뭐예요?')).toBe('뭐예요');
    expect(normalizeKorean('네, 맞아요.')).toBe('네맞아요');
  });

  it('removes emoji and other symbols', () => {
    expect(normalizeKorean('안녕😀!')).toBe('안녕');
    expect(normalizeKorean('안녕—(테스트)')).toBe('안녕테스트');
  });

  it('handles Korean quotation marks', () => {
    expect(normalizeKorean('「안녕」')).toBe('안녕');
    expect(normalizeKorean('"감사합니다"')).toBe('감사합니다');
  });

  it('converts to lowercase for mixed content', () => {
    expect(normalizeKorean('Hello안녕')).toBe('hello안녕');
  });

  it('handles empty string', () => {
    expect(normalizeKorean('')).toBe('');
  });
});

describe('fuzzyMatch', () => {
  it('returns exact match for identical strings', () => {
    const result = fuzzyMatch('안녕하세요', '안녕하세요');
    expect(result.isMatch).toBe(true);
    expect(result.similarity).toBe(1);
    expect(result.differences).toHaveLength(0);
  });

  it('matches strings with different whitespace', () => {
    const result = fuzzyMatch('안녕하세요', '안녕 하세요');
    expect(result.isMatch).toBe(true);
    expect(result.similarity).toBe(1);
  });

  it('matches strings with different punctuation', () => {
    const result = fuzzyMatch('감사합니다!', '감사합니다');
    expect(result.isMatch).toBe(true);
  });

  it('identifies non-matching strings', () => {
    const result = fuzzyMatch('안녕하세요', '감사합니다');
    expect(result.isMatch).toBe(false);
    expect(result.similarity).toBeLessThan(0.5);
  });

  it('handles single character difference with high similarity', () => {
    const result = fuzzyMatch('감사합니다', '감사함니다'); // ㅂ vs ㅁ
    expect(result.similarity).toBeGreaterThan(0.8);
  });

  it('provides differences array', () => {
    const result = fuzzyMatch('감사합니다', '감사함니다');
    expect(result.differences.length).toBeGreaterThan(0);
  });
});

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('안녕', '안녕')).toBe(0);
  });

  it('returns correct distance for single insertion', () => {
    expect(levenshteinDistance('안녕', '안녕요')).toBe(1);
  });

  it('returns correct distance for single deletion', () => {
    expect(levenshteinDistance('안녕하세요', '안녕하세')).toBe(1);
  });

  it('returns correct distance for single substitution', () => {
    expect(levenshteinDistance('감사', '감자')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(levenshteinDistance('', '안녕')).toBe(2);
    expect(levenshteinDistance('안녕', '')).toBe(2);
    expect(levenshteinDistance('', '')).toBe(0);
  });
});

describe('calculateSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(calculateSimilarity('안녕하세요', '안녕하세요')).toBe(1);
  });

  it('returns 0 when one string is empty', () => {
    expect(calculateSimilarity('', '안녕')).toBe(0);
    expect(calculateSimilarity('안녕', '')).toBe(0);
  });

  it('returns high similarity for similar strings', () => {
    const similarity = calculateSimilarity('감사합니다', '감사함니다');
    expect(similarity).toBeGreaterThan(0.8);
  });

  it('returns low similarity for different strings', () => {
    const similarity = calculateSimilarity('안녕', '감사합니다');
    expect(similarity).toBeLessThan(0.5);
  });
});

describe('findDifferences', () => {
  it('returns empty array for identical strings', () => {
    const diffs = findDifferences('안녕', '안녕');
    expect(diffs).toHaveLength(0);
  });

  it('identifies insertions', () => {
    const diffs = findDifferences('안녕', '안녕요');
    expect(diffs.some((d) => d.type === 'insert')).toBe(true);
  });

  it('identifies deletions', () => {
    const diffs = findDifferences('안녕요', '안녕');
    expect(diffs.some((d) => d.type === 'delete')).toBe(true);
  });

  it('identifies replacements', () => {
    const diffs = findDifferences('감사', '감자');
    expect(diffs.some((d) => d.type === 'replace')).toBe(true);
  });
});

describe('generateDiffHtml', () => {
  it('returns plain text for matching strings', () => {
    const result = generateDiffHtml('안녕하세요', '안녕하세요');
    expect(result.expectedHtml).toBe('안녕하세요');
    expect(result.actualHtml).toBe('안녕하세요');
  });

  it('adds diff classes for differences', () => {
    const result = generateDiffHtml('감사', '감자');
    expect(result.actualHtml).toContain('class="diff-');
  });
});

describe('getConfusionTip', () => {
  it('returns tip for ㅔ/ㅐ confusion', () => {
    const tip = getConfusionTip('네', '내');
    expect(tip).toContain('confusion');
  });

  it('returns null when no common confusion', () => {
    const tip = getConfusionTip('가', '나');
    expect(tip).toBeNull();
  });
});
