/**
 * AI Client Abstraction for Card Generation
 * Supports OpenAI, Anthropic, and Google providers
 */

export interface CardDraft {
  korean: string;
  english: string;
  notes: string;
  example_korean: string;
  example_english: string;
  tags: string[];
  usefulness_score: number;
  usefulness_reasons: string[];
  is_pattern: boolean;
}

export interface GenerateCardsInput {
  topic?: string;           // e.g., "ordering food at a restaurant"
  koreanText?: string;      // User-pasted Korean text to create cards from
  count?: number;           // Max cards to generate (default 10)
  targetLevel?: 'beginner' | 'intermediate' | 'advanced';
  prioritizePatterns?: boolean;
}

export interface GenerateCardsResult {
  cards: CardDraft[];
  provider: string;
  tokensUsed?: number;
}

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface LLMClientConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-1.5-flash',
};

export class LLMClient {
  private provider: AIProvider;
  private apiKey: string;
  private model: string;

  constructor(config: LLMClientConfig) {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODELS[config.provider];
  }

  static fromEnv(): LLMClient | null {
    const provider = process.env.AI_PROVIDER as AIProvider;
    const apiKey = process.env.AI_API_KEY;

    if (!provider || !apiKey || process.env.AI_ENABLED !== 'true') {
      return null;
    }

    return new LLMClient({ provider, apiKey });
  }

  async generateCards(input: GenerateCardsInput): Promise<GenerateCardsResult> {
    const prompt = this.buildPrompt(input);
    const response = await this.callProvider(prompt);
    const cards = this.parseResponse(response);

    return {
      cards: this.deduplicateCards(cards),
      provider: this.provider,
    };
  }

  private buildPrompt(input: GenerateCardsInput): string {
    const count = input.count || 10;
    const level = input.targetLevel || 'beginner';

    let contextPart = '';
    if (input.topic) {
      contextPart = `Topic: "${input.topic}"`;
    } else if (input.koreanText) {
      contextPart = `Extract vocabulary and phrases from this Korean text:\n"${input.koreanText}"`;
    }

    return `You are a Korean language teaching expert. Create ${count} flashcards for ${level} learners.

${contextPart}

Rules:
1. Prioritize high-frequency, practical phrases over rare vocabulary
2. ${input.prioritizePatterns ? 'Focus on grammar patterns that can generate many sentences' : 'Mix vocabulary and patterns'}
3. Include natural example sentences
4. Score usefulness 0-100 based on real-world utility
5. Avoid obscure words unless specifically requested
6. Keep notes concise and helpful

Return ONLY valid JSON array with this exact structure:
[
  {
    "korean": "phrase in Korean",
    "english": "English translation",
    "notes": "Brief usage notes",
    "example_korean": "Example sentence in Korean",
    "example_english": "Example sentence translation",
    "tags": ["tag1", "tag2"],
    "usefulness_score": 85,
    "usefulness_reasons": ["reason1", "reason2"],
    "is_pattern": false
  }
]

For patterns (grammar structures), set is_pattern: true and include the pattern structure in notes.
Tags should include: level (beginner/intermediate/advanced), category (greeting, food, travel, etc.), and type (pattern, vocab, phrase).`;
  }

  private async callProvider(prompt: string): Promise<string> {
    switch (this.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      case 'google':
        return this.callGoogle(prompt);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private async callGoogle(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private parseResponse(response: string): CardDraft[] {
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);
      const cards = Array.isArray(parsed) ? parsed : parsed.cards || [];

      // Validate and sanitize each card
      return cards.map((card: any) => this.validateCard(card)).filter(Boolean);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return [];
    }
  }

  private validateCard(card: any): CardDraft | null {
    if (!card.korean || !card.english) {
      return null;
    }

    return {
      korean: String(card.korean).trim(),
      english: String(card.english).trim(),
      notes: String(card.notes || '').trim(),
      example_korean: String(card.example_korean || '').trim(),
      example_english: String(card.example_english || '').trim(),
      tags: Array.isArray(card.tags) ? card.tags.map(String) : [],
      usefulness_score: Math.min(100, Math.max(0, Number(card.usefulness_score) || 50)),
      usefulness_reasons: Array.isArray(card.usefulness_reasons)
        ? card.usefulness_reasons.map(String)
        : [],
      is_pattern: Boolean(card.is_pattern),
    };
  }

  private deduplicateCards(cards: CardDraft[]): CardDraft[] {
    const seen = new Set<string>();
    return cards.filter((card) => {
      const key = card.korean.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

// Convenience function for API routes
export async function generateCardsWithAI(
  input: GenerateCardsInput
): Promise<GenerateCardsResult | null> {
  const client = LLMClient.fromEnv();
  if (!client) {
    return null;
  }
  return client.generateCards(input);
}
