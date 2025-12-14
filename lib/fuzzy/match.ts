/**
 * Fuzzy Matching for Korean Text Input
 * Used in typing review mode to compare user answers
 */

export interface MatchResult {
  isMatch: boolean;
  similarity: number;        // 0-1, 1 = perfect match
  normalizedExpected: string;
  normalizedActual: string;
  differences: Difference[];
}

export interface Difference {
  type: 'insert' | 'delete' | 'replace';
  position: number;
  expected?: string;
  actual?: string;
}

/**
 * Normalize Korean text for comparison
 * - Removes whitespace
 * - Removes punctuation
 * - Converts to lowercase (for any mixed content)
 */
export function normalizeKorean(text: string): string {
  return text
    .replace(/\s+/g, '')                    // Remove all whitespace
    .replace(/[.,!?~…""''「」『』]/g, '')    // Remove punctuation
    .replace(/[.,:;!?'"()[\]{}]/g, '')      // Remove ASCII punctuation
    .toLowerCase()
    .trim();
}

/**
 * Check if two Korean strings match with fuzzy tolerance
 */
export function fuzzyMatch(expected: string, actual: string): MatchResult {
  const normalizedExpected = normalizeKorean(expected);
  const normalizedActual = normalizeKorean(actual);

  // Exact match after normalization
  if (normalizedExpected === normalizedActual) {
    return {
      isMatch: true,
      similarity: 1,
      normalizedExpected,
      normalizedActual,
      differences: [],
    };
  }

  // Calculate similarity and differences
  const differences = findDifferences(normalizedExpected, normalizedActual);
  const similarity = calculateSimilarity(normalizedExpected, normalizedActual);

  // Consider it a match if similarity is very high (typo tolerance)
  const isMatch = similarity >= 0.95;

  return {
    isMatch,
    similarity,
    normalizedExpected,
    normalizedActual,
    differences,
  };
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
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

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity as a ratio (0-1)
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);

  return 1 - distance / maxLength;
}

/**
 * Find specific differences between expected and actual strings
 */
export function findDifferences(expected: string, actual: string): Difference[] {
  const differences: Difference[] = [];
  const maxLen = Math.max(expected.length, actual.length);

  let i = 0;
  let j = 0;

  while (i < expected.length || j < actual.length) {
    if (i >= expected.length) {
      // Extra characters in actual
      differences.push({
        type: 'insert',
        position: j,
        actual: actual[j],
      });
      j++;
    } else if (j >= actual.length) {
      // Missing characters in actual
      differences.push({
        type: 'delete',
        position: i,
        expected: expected[i],
      });
      i++;
    } else if (expected[i] !== actual[j]) {
      // Check if it's a replacement or insertion/deletion
      const lookAheadExpected = expected.indexOf(actual[j], i);
      const lookAheadActual = actual.indexOf(expected[i], j);

      if (lookAheadActual === j + 1) {
        // Character was inserted in actual
        differences.push({
          type: 'insert',
          position: j,
          actual: actual[j],
        });
        j++;
      } else if (lookAheadExpected === i + 1) {
        // Character was deleted from actual
        differences.push({
          type: 'delete',
          position: i,
          expected: expected[i],
        });
        i++;
      } else {
        // Character was replaced
        differences.push({
          type: 'replace',
          position: i,
          expected: expected[i],
          actual: actual[j],
        });
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }

    // Safety valve to prevent infinite loops
    if (differences.length > maxLen * 2) break;
  }

  return differences;
}

/**
 * Generate HTML diff highlighting for display
 */
export function generateDiffHtml(expected: string, actual: string): {
  expectedHtml: string;
  actualHtml: string;
} {
  const result = fuzzyMatch(expected, actual);

  if (result.isMatch && result.similarity === 1) {
    return {
      expectedHtml: expected,
      actualHtml: actual,
    };
  }

  // Simple character-by-character diff display
  let expectedHtml = '';
  let actualHtml = '';

  const normalizedExpected = result.normalizedExpected;
  const normalizedActual = result.normalizedActual;

  // Build expected with highlights for missing/wrong chars
  for (let i = 0; i < normalizedExpected.length; i++) {
    const char = normalizedExpected[i];
    const actualChar = normalizedActual[i];

    if (actualChar === undefined) {
      expectedHtml += `<span class="diff-delete">${char}</span>`;
    } else if (char !== actualChar) {
      expectedHtml += `<span class="diff-change">${char}</span>`;
    } else {
      expectedHtml += char;
    }
  }

  // Build actual with highlights for wrong/extra chars
  for (let i = 0; i < normalizedActual.length; i++) {
    const char = normalizedActual[i];
    const expectedChar = normalizedExpected[i];

    if (expectedChar === undefined) {
      actualHtml += `<span class="diff-insert">${char}</span>`;
    } else if (char !== expectedChar) {
      actualHtml += `<span class="diff-wrong">${char}</span>`;
    } else {
      actualHtml += char;
    }
  }

  return { expectedHtml, actualHtml };
}

/**
 * Common Korean character confusions to provide helpful feedback
 */
export const COMMON_CONFUSIONS: Record<string, string> = {
  'ㅔ': 'ㅐ',  // e vs ae
  'ㅐ': 'ㅔ',
  'ㅖ': 'ㅒ',  // ye vs yae
  'ㅒ': 'ㅖ',
  'ㅚ': 'ㅙ',  // oe vs wae
  'ㅙ': 'ㅚ',
  'ㅝ': 'ㅜ',  // wo vs u
  'ㅜ': 'ㅝ',
};

/**
 * Get helpful tip for a common mistake
 */
export function getConfusionTip(expected: string, actual: string): string | null {
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
    const exp = expected[i];
    const act = actual[i];

    if (exp !== act && COMMON_CONFUSIONS[exp] === act) {
      return `Common confusion: ${act} vs ${exp}. These vowels sound similar but are written differently.`;
    }
  }

  return null;
}
