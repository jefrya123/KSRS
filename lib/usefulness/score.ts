// Types
export interface CardInput {
  korean: string;
  english: string;
  tags: string[];
  isPattern?: boolean;      // Grammar patterns score higher
  manualScore?: number;     // User override
  frequencyRank?: number;   // 1-10000, lower is more common
}

export interface ScoringConfig {
  tagWeights: Record<string, number>;  // e.g., { beginner: 10, travel: 8 }
  patternBonus: number;                 // Points for grammar patterns
  frequencyWeight: number;              // How much frequency matters
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ScoreResult {
  score: number;           // 0-100
  reasons: string[];       // Explanations like "high-frequency greeting"
}

// Default config
export const DEFAULT_CONFIG: ScoringConfig = {
  tagWeights: {
    beginner: 10,
    essential: 10,
    travel: 8,
    food: 7,
    greeting: 9,
    pattern: 8,
    business: 6,
    formal: 5,
    slang: 3,
    rare: -5,
  },
  patternBonus: 15,
  frequencyWeight: 0.25,
};

const BASE_SCORE = 50;
const MAX_TAG_IMPACT = 30;

/**
 * Get score contribution from tags
 */
export function getTagScore(
  tags: string[],
  weights: Record<string, number>
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let rawScore = 0;

  for (const tag of tags) {
    const weight = weights[tag];
    if (weight !== undefined) {
      rawScore += weight;
      if (weight > 0) {
        reasons.push(`+${weight} for '${tag}' tag`);
      } else if (weight < 0) {
        reasons.push(`${weight} for '${tag}' tag`);
      }
    }
  }

  // Clamp tag impact to max range
  const clampedScore = Math.max(-MAX_TAG_IMPACT, Math.min(MAX_TAG_IMPACT, rawScore));

  if (rawScore !== clampedScore) {
    reasons.push(`tag score capped at ±${MAX_TAG_IMPACT}`);
  }

  return { score: clampedScore, reasons };
}

/**
 * Get score contribution from frequency rank
 */
export function getFrequencyScore(rank?: number): { score: number; reason?: string } {
  if (rank === undefined) {
    return { score: 0 };
  }

  if (rank <= 1000) {
    return { score: 20, reason: 'high-frequency word (rank 1-1000)' };
  } else if (rank <= 5000) {
    return { score: 10, reason: 'medium-frequency word (rank 1000-5000)' };
  } else {
    return { score: 0, reason: 'low-frequency word (rank 5000+)' };
  }
}

/**
 * Get score contribution from pattern status
 */
export function getPatternScore(
  isPattern: boolean,
  bonus: number
): { score: number; reason?: string } {
  if (isPattern) {
    return { score: bonus, reason: `+${bonus} grammar pattern bonus` };
  }
  return { score: 0 };
}

/**
 * Normalize score to 0-100 range
 */
export function normalizeScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Calculate usefulness score for a flashcard
 */
export function calculateUsefulness(
  card: CardInput,
  config?: Partial<ScoringConfig>
): ScoreResult {
  // Handle manual override
  if (card.manualScore !== undefined) {
    return {
      score: normalizeScore(card.manualScore),
      reasons: ['manual score override'],
    };
  }

  // Merge config with defaults
  const finalConfig: ScoringConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    tagWeights: {
      ...DEFAULT_CONFIG.tagWeights,
      ...config?.tagWeights,
    },
  };

  const reasons: string[] = [];
  let totalScore = BASE_SCORE;
  reasons.push(`base score: ${BASE_SCORE}`);

  // Add tag contributions
  const tagResult = getTagScore(card.tags, finalConfig.tagWeights);
  totalScore += tagResult.score;
  reasons.push(...tagResult.reasons);

  // Add pattern bonus
  const patternResult = getPatternScore(card.isPattern ?? false, finalConfig.patternBonus);
  totalScore += patternResult.score;
  if (patternResult.reason) {
    reasons.push(patternResult.reason);
  }

  // Add frequency contribution
  const frequencyResult = getFrequencyScore(card.frequencyRank);
  totalScore += frequencyResult.score;
  if (frequencyResult.reason) {
    reasons.push(frequencyResult.reason);
  }

  return {
    score: normalizeScore(totalScore),
    reasons,
  };
}
