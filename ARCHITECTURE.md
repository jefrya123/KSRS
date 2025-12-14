# KSRS Architecture

## Overview

KSRS (Korean Spaced Repetition System) is a Next.js application optimized for learning practical Korean through spaced repetition. The system prioritizes high-frequency phrases and grammar patterns over rare vocabulary.

## Tech Stack

### Frontend
- **Next.js 14** (App Router) - Server components, streaming, and excellent Vercel integration
- **TypeScript** - Type safety across the stack
- **Tailwind CSS** - Rapid UI development with consistent design
- **React Query** - Server state management for reviews and deck data

### Backend
- **Next.js Route Handlers** - API endpoints colocated with app
- **Prisma** - Type-safe ORM with excellent migration support
- **Neon Postgres** - Serverless Postgres, scales to zero, branches for dev

### Authentication
- **NextAuth.js v5** - Flexible auth with credentials, OAuth providers
- Session strategy: JWT (stateless, Vercel-friendly)

### AI Integration
- Abstracted `LLMClient` interface supporting:
  - OpenAI (gpt-4o-mini for cost efficiency)
  - Anthropic (claude-3-haiku)
  - Google (gemini-1.5-flash)
- Toggle via `AI_ENABLED` env var

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel Edge                              │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App Router                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   /app       │  │  /api        │  │  /lib        │          │
│  │  - pages     │  │  - cards     │  │  - srs/sm2   │          │
│  │  - layouts   │  │  - decks     │  │  - usefulness│          │
│  │  - review    │  │  - review    │  │  - ai/client │          │
│  └──────────────┘  │  - ai/gen    │  │  - fuzzy     │          │
│                    └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                      Prisma ORM                                  │
├─────────────────────────────────────────────────────────────────┤
│                    Neon Postgres                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐           │
│  │  User   │ │  Deck   │ │  Card   │ │ CardProgress│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   LLM Provider   │
                    │ (OpenAI/Claude/  │
                    │     Gemini)      │
                    └──────────────────┘
```

## Deployment Architecture (Vercel + Neon)

### Production
```
vercel.com (Production)
├── Edge Runtime: Middleware (auth checks)
├── Node Runtime: API routes, SSR
├── Static: Marketing pages
└── ISR: Deck browse pages

neon.tech (Postgres)
├── Main branch: Production
├── Preview branches: Auto-created per PR
└── Connection pooling: Enabled (serverless)
```

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..." # For migrations

# Auth
NEXTAUTH_URL="https://ksrs.vercel.app"
NEXTAUTH_SECRET="..."

# AI (optional)
AI_ENABLED="true"
AI_PROVIDER="openai"  # openai | anthropic | google
AI_API_KEY="sk-..."

# Feature flags
VOICE_MODE_ENABLED="false"
```

## Key Design Decisions

### 1. SM-2 First, FSRS Ready
SM-2 is well-understood and proven. Schema includes all fields needed for FSRS upgrade:
- `ease_factor` → FSRS stability
- `interval_days` → FSRS interval
- `repetitions` → FSRS reps
- `difficulty` (new) → FSRS difficulty

### 2. Usefulness Scoring
Cards have `usefulness_score` (0-100) computed from:
- Tag weights (beginner, travel, business)
- Pattern vs vocabulary flag
- Frequency data
- Manual override support

New cards served in usefulness_score DESC order, ensuring high-utility content first.

### 3. Review Modes as URL Routes
```
/review/[deckId]/recognition  → Show/reveal/rate
/review/[deckId]/typing       → Type answer, fuzzy match
/review/[deckId]/speaking     → (Phase 2) Voice input
```

### 4. Serverless-Friendly Design
- No long-running processes
- Stateless JWT auth
- Postgres connection pooling via Neon
- AI calls are isolated API routes (can timeout independently)

## Data Flow

### Review Session
```
1. GET /api/review/[deckId]/cards
   → Fetch due cards (due_at <= now) + new cards (by usefulness)
   → Return batch of 20 cards max

2. User reviews card
   → Local state updates immediately (optimistic)

3. POST /api/review/submit
   → { cardId, rating, reviewMode, responseTime }
   → SM-2 calculation
   → Update CardProgress
   → Return next interval for UI feedback

4. Session complete
   → Summary stats displayed
   → Sync any offline reviews
```

### AI Card Generation
```
1. POST /api/ai/generate
   → { topic: "ordering food", count: 10 }

2. LLMClient.generateCards()
   → Structured output (JSON mode)
   → Validates against CardDraft schema

3. Response
   → CardDraft[] with usefulness_score + reasons
   → User reviews/edits before saving
```

## Security Considerations

- All API routes require authentication (middleware)
- User can only access own decks/cards (RLS-style checks in queries)
- AI API keys stored in env, never exposed to client
- Rate limiting on AI generation endpoints
- Input sanitization for Korean text (prevent injection)

## Performance Targets

| Metric | Target |
|--------|--------|
| TTFB (review page) | < 200ms |
| Card flip animation | 60fps |
| API response (review submit) | < 100ms |
| AI generation (10 cards) | < 5s |

## Scaling Strategy

### Phase 1 (MVP)
- Single Neon database
- Vercel Pro plan
- ~1000 users capacity

### Phase 2
- Neon read replicas
- Redis for session cache (Upstash)
- CDN for audio files (Vercel Blob)

### Phase 3
- Dedicated Postgres (if needed)
- Worker queues for AI generation (Inngest)
- Multi-region deployment
