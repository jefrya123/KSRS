import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    lastReviewedAt: Date | null;
  } | null;
}

interface ReviewCardsResponse {
  dueCards: CardWithProgress[];
  newCards: CardWithProgress[];
  totalDue: number;
}

interface ReviewSubmitRequest {
  cardId: string;
  rating: 1 | 2 | 3 | 4;
  reviewMode: 'recognition' | 'typing';
  responseTimeMs: number;
  userAnswer?: string;
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

// SM-2 Algorithm Implementation
function calculateSM2(
  rating: 1 | 2 | 3 | 4,
  easeFactor: number,
  intervalDays: number,
  repetitions: number
): { easeFactor: number; intervalDays: number; repetitions: number } {
  let newEaseFactor = easeFactor;
  let newIntervalDays = intervalDays;
  let newRepetitions = repetitions;

  // Adjust ease factor based on rating
  if (rating === 1) {
    // Again - Reset card
    newEaseFactor = Math.max(1.3, easeFactor - 0.2);
    newIntervalDays = 0;
    newRepetitions = 0;
  } else if (rating === 2) {
    // Hard - Slight decrease in ease, modest interval increase
    newEaseFactor = Math.max(1.3, easeFactor - 0.15);
    newIntervalDays = Math.max(1, Math.round(intervalDays * 1.2));
    newRepetitions = repetitions + 1;
  } else if (rating === 3) {
    // Good - Standard SM-2
    newEaseFactor = easeFactor;
    newRepetitions = repetitions + 1;

    if (newRepetitions === 1) {
      newIntervalDays = 1;
    } else if (newRepetitions === 2) {
      newIntervalDays = 6;
    } else {
      newIntervalDays = Math.round(intervalDays * easeFactor);
    }
  } else if (rating === 4) {
    // Easy - Increase ease factor, longer interval
    newEaseFactor = easeFactor + 0.15;
    newRepetitions = repetitions + 1;

    if (newRepetitions === 1) {
      newIntervalDays = 4;
    } else if (newRepetitions === 2) {
      newIntervalDays = 10;
    } else {
      newIntervalDays = Math.round(intervalDays * easeFactor * 1.3);
    }
  }

  return {
    easeFactor: newEaseFactor,
    intervalDays: newIntervalDays,
    repetitions: newRepetitions,
  };
}

// GET: Fetch cards due for review + new cards
export async function GET(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    // Auth check
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { deckId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify deck ownership
    const deck = await prisma.deck.findFirst({
      where: {
        id: deckId,
        userId: user.id,
      },
    });

    if (!deck) {
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Fetch due cards (cards with progress that are due)
    const dueCardsData = await prisma.card.findMany({
      where: {
        deckId,
        cardProgress: {
          some: {
            userId: user.id,
            dueAt: {
              lte: now,
            },
          },
        },
      },
      include: {
        cardProgress: {
          where: {
            userId: user.id,
          },
        },
      },
      orderBy: {
        cardProgress: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    // Transform due cards
    const dueCards: CardWithProgress[] = dueCardsData.map((card) => ({
      id: card.id,
      korean: card.korean,
      english: card.english,
      notes: card.notes,
      exampleKorean: card.exampleKorean,
      exampleEnglish: card.exampleEnglish,
      romanization: card.romanization,
      usefulnessScore: card.usefulnessScore,
      cardProgress: card.cardProgress[0] || null,
    }));

    // Fetch new cards (cards without progress for this user)
    const remainingSlots = limit - dueCards.length;
    let newCardsData: typeof dueCardsData = [];

    if (remainingSlots > 0) {
      newCardsData = await prisma.card.findMany({
        where: {
          deckId,
          cardProgress: {
            none: {
              userId: user.id,
            },
          },
        },
        include: {
          cardProgress: {
            where: {
              userId: user.id,
            },
          },
        },
        orderBy: {
          usefulnessScore: 'desc',
        },
        take: remainingSlots,
      });
    }

    // Transform new cards
    const newCards: CardWithProgress[] = newCardsData.map((card) => ({
      id: card.id,
      korean: card.korean,
      english: card.english,
      notes: card.notes,
      exampleKorean: card.exampleKorean,
      exampleEnglish: card.exampleEnglish,
      romanization: card.romanization,
      usefulnessScore: card.usefulnessScore,
      cardProgress: null,
    }));

    // Get total due count
    const totalDue = await prisma.cardProgress.count({
      where: {
        userId: user.id,
        dueAt: {
          lte: now,
        },
        card: {
          deckId,
        },
      },
    });

    const response: ReviewCardsResponse = {
      dueCards,
      newCards,
      totalDue,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching review cards:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Submit a review
export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    // Auth check
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { deckId } = params;
    const body: ReviewSubmitRequest = await request.json();
    const { cardId, rating, reviewMode, responseTimeMs, userAnswer } = body;

    // Validate rating
    if (![1, 2, 3, 4].includes(rating)) {
      return NextResponse.json(
        { error: 'Invalid rating. Must be 1-4' },
        { status: 400 }
      );
    }

    // Validate review mode
    if (!['recognition', 'typing'].includes(reviewMode)) {
      return NextResponse.json(
        { error: 'Invalid review mode' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify card belongs to deck
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        deckId,
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found in deck' },
        { status: 404 }
      );
    }

    // Get or create card progress
    let cardProgress = await prisma.cardProgress.findUnique({
      where: {
        cardId_userId: {
          cardId,
          userId: user.id,
        },
      },
    });

    const isNewCard = !cardProgress;

    if (!cardProgress) {
      // Create new progress record
      cardProgress = await prisma.cardProgress.create({
        data: {
          cardId,
          userId: user.id,
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions: 0,
          dueAt: new Date(),
        },
      });
    }

    // Calculate new SM-2 values
    const sm2Result = calculateSM2(
      rating,
      cardProgress.easeFactor,
      cardProgress.intervalDays,
      cardProgress.repetitions
    );

    // Calculate next due date
    const now = new Date();
    const dueAt = new Date(now);
    if (sm2Result.intervalDays === 0) {
      // Due in 1 minute for "Again" cards
      dueAt.setMinutes(dueAt.getMinutes() + 1);
    } else {
      dueAt.setDate(dueAt.getDate() + sm2Result.intervalDays);
    }

    // Update card progress
    const updatedProgress = await prisma.cardProgress.update({
      where: {
        id: cardProgress.id,
      },
      data: {
        easeFactor: sm2Result.easeFactor,
        intervalDays: sm2Result.intervalDays,
        repetitions: sm2Result.repetitions,
        dueAt,
        lastReviewedAt: now,
      },
    });

    // Create review log
    await prisma.reviewLog.create({
      data: {
        cardProgressId: cardProgress.id,
        rating,
        reviewMode: reviewMode === 'recognition' ? 'FLASHCARD' : 'TYPING',
        responseTimeMs,
        userAnswer,
      },
    });

    const response: ReviewSubmitResponse = {
      success: true,
      nextReview: {
        intervalDays: sm2Result.intervalDays,
        dueAt,
      },
      cardState: {
        easeFactor: sm2Result.easeFactor,
        repetitions: sm2Result.repetitions,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
