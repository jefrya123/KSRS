# Korean SRS Application - Development Milestones

## Overview
This document outlines the 15 milestones for building the MVP of the Korean SRS (Spaced Repetition System) application. Each milestone represents a small, focused commit that adds specific functionality to the project.

---

## M1: Project Setup
**Description**: Initialize Next.js 14 project with TypeScript, Tailwind CSS, and Prisma ORM. Configure basic project structure and development environment.

**Key Files Changed**:
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `next.config.js` - Next.js configuration
- `.env.example` - Environment variable template
- `.gitignore` - Git ignore rules

**Acceptance Criteria**:
- [x] Next.js 14 app router structure initialized
- [x] TypeScript configured with strict mode
- [x] Tailwind CSS working with custom theme
- [x] Prisma CLI installed and ready
- [x] Development server runs without errors
- [x] ESLint and Prettier configured

---

## M2: Database Schema and Migrations
**Description**: Define Prisma schema for users, decks, cards, and reviews. Create initial database migrations and seed data for development.

**Key Files Changed**:
- `prisma/schema.prisma` - Complete database schema
- `prisma/migrations/` - Initial migration files
- `prisma/seed.ts` - Seed script for development data
- `lib/db.ts` - Prisma client singleton

**Acceptance Criteria**:
- [x] User model with authentication fields
- [x] Deck model with user relationship
- [x] Card model with Korean/English fields, SRS metadata
- [x] Review model tracking user performance
- [x] Usefulness scoring fields on Card model
- [x] Database migrations run successfully
- [x] Seed script creates sample data

---

## M3: NextAuth.js Authentication
**Description**: Implement authentication system using NextAuth.js with credentials provider. Add login, register, and session management.

**Key Files Changed**:
- `app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `lib/auth.ts` - Auth helper functions and types
- `app/(auth)/login/page.tsx` - Login page
- `app/(auth)/register/page.tsx` - Registration page
- `app/(auth)/layout.tsx` - Auth layout
- `middleware.ts` - Route protection

**Acceptance Criteria**:
- [x] Users can register with email/password
- [x] Users can log in and log out
- [x] Sessions persist across page refreshes
- [x] Protected routes redirect to login
- [x] Password hashing with bcrypt
- [x] Session management working

---

## M4: SM-2 Scheduling Algorithm
**Description**: Implement the SM-2 spaced repetition algorithm in TypeScript. Create functions to calculate next review dates and update card intervals.

**Key Files Changed**:
- `lib/srs/sm2.ts` - Core SM-2 algorithm implementation
- `lib/srs/types.ts` - SRS-related TypeScript types
- `lib/srs/sm2.test.ts` - Unit tests for SM-2 algorithm

**Acceptance Criteria**:
- [x] `calculateNextReview()` function working
- [x] Handles quality ratings 0-5
- [x] Updates easiness factor correctly
- [x] Calculates intervals based on SM-2 formula
- [x] Returns next review date
- [x] All unit tests passing

---

## M5: Usefulness Scoring System
**Description**: Implement usefulness scoring algorithm that promotes frequent, useful Korean words and deprioritizes rarely used words.

**Key Files Changed**:
- `lib/usefulness/score.ts` - Usefulness calculation logic
- `lib/usefulness/types.ts` - Usefulness-related types
- `lib/usefulness/wordFrequency.ts` - Korean word frequency data
- `lib/usefulness/score.test.ts` - Unit tests

**Acceptance Criteria**:
- [x] `calculateUsefulnessScore()` function implemented
- [x] Integrates word frequency data
- [x] Scores range from 0-100
- [x] High-frequency words score higher
- [x] Score influences card priority
- [x] Tests verify scoring logic

---

## M6: Deck CRUD API Routes
**Description**: Create API endpoints for deck management - create, read, update, and delete decks. Include authorization checks.

**Key Files Changed**:
- `app/api/decks/route.ts` - GET (list) and POST (create)
- `app/api/decks/[id]/route.ts` - GET, PATCH, DELETE
- `lib/api/decks.ts` - Deck service functions
- `lib/api/types.ts` - API types and interfaces

**Acceptance Criteria**:
- [x] GET /api/decks returns user's decks
- [x] POST /api/decks creates new deck
- [x] GET /api/decks/[id] returns single deck
- [x] PATCH /api/decks/[id] updates deck
- [x] DELETE /api/decks/[id] removes deck
- [x] Authorization prevents unauthorized access

---

## M7: Card CRUD API Routes
**Description**: Create API endpoints for card management within decks. Support batch operations and filtering by deck.

**Key Files Changed**:
- `app/api/cards/route.ts` - GET (list) and POST (create)
- `app/api/cards/[id]/route.ts` - GET, PATCH, DELETE
- `app/api/cards/batch/route.ts` - Batch create/update
- `lib/api/cards.ts` - Card service functions

**Acceptance Criteria**:
- [x] GET /api/cards?deckId=X returns deck's cards
- [x] POST /api/cards creates new card
- [x] GET /api/cards/[id] returns single card
- [x] PATCH /api/cards/[id] updates card
- [x] DELETE /api/cards/[id] removes card
- [x] POST /api/cards/batch supports bulk operations

---

## M8: Review API Routes
**Description**: Create endpoints to fetch due cards and submit review responses. Integrate SM-2 algorithm and usefulness scoring.

**Key Files Changed**:
- `app/api/review/due/route.ts` - GET due cards
- `app/api/review/submit/route.ts` - POST review response
- `lib/api/review.ts` - Review service functions
- `lib/api/scheduler.ts` - Review scheduling logic

**Acceptance Criteria**:
- [x] GET /api/review/due?deckId=X returns cards due for review
- [x] Cards sorted by priority (overdue + usefulness)
- [x] POST /api/review/submit updates card SRS data
- [x] SM-2 algorithm applied to reviewed cards
- [x] Review history recorded in database
- [x] Returns next review date

---

## M9: Dashboard Page
**Description**: Build main dashboard showing user's decks, study statistics, and due card counts. Include deck creation and navigation.

**Key Files Changed**:
- `app/(dashboard)/page.tsx` - Dashboard page
- `app/(dashboard)/layout.tsx` - Dashboard layout with nav
- `components/DeckCard.tsx` - Deck display component
- `components/StatsOverview.tsx` - Statistics widget
- `components/CreateDeckModal.tsx` - Deck creation modal

**Acceptance Criteria**:
- [x] Displays all user decks with card counts
- [x] Shows cards due for each deck
- [x] Statistics summary (total cards, reviews today)
- [x] Create new deck functionality
- [x] Navigate to deck detail pages
- [x] Responsive design works on mobile

---

## M10: Deck Detail Page
**Description**: Create deck detail view showing all cards, add/edit card functionality, and start review button. Include card management features.

**Key Files Changed**:
- `app/deck/[id]/page.tsx` - Deck detail page
- `app/deck/[id]/layout.tsx` - Deck layout
- `components/CardList.tsx` - Card list component
- `components/CardForm.tsx` - Add/edit card form
- `components/DeckActions.tsx` - Deck action buttons

**Acceptance Criteria**:
- [x] Displays deck name and description
- [x] Shows all cards in deck with Korean/English
- [x] Add new cards to deck
- [x] Edit existing cards
- [x] Delete cards with confirmation
- [x] "Start Review" button navigates to review mode
- [x] Shows due card count

---

## M11: Recognition Review Mode
**Description**: Implement recognition-based review interface where users see Korean and reveal English meaning. Simple button-based ratings.

**Key Files Changed**:
- `app/review/[deckId]/recognition/page.tsx` - Recognition review
- `components/RecognitionCard.tsx` - Card flip component
- `components/ReviewRating.tsx` - Rating buttons (0-5)
- `lib/hooks/useReview.ts` - Review session hook
- `components/ReviewProgress.tsx` - Progress indicator

**Acceptance Criteria**:
- [x] Shows Korean term on front
- [x] Click to reveal English meaning
- [x] Rate understanding (Again, Hard, Good, Easy)
- [x] Progress through all due cards
- [x] Submit reviews to API
- [x] Show completion summary
- [x] Keyboard shortcuts work (1-4 for ratings)

---

## M12: Typing Review Mode with Fuzzy Matching
**Description**: Add typing-based review where users type English translation. Implement fuzzy matching to accept minor typos and variations.

**Key Files Changed**:
- `app/review/[deckId]/typing/page.tsx` - Typing review page
- `components/TypingCard.tsx` - Typing input component
- `lib/fuzzy/matcher.ts` - Fuzzy matching algorithm
- `lib/fuzzy/normalize.ts` - Text normalization
- `components/AnswerFeedback.tsx` - Visual feedback component

**Acceptance Criteria**:
- [x] Shows Korean term, prompts for English
- [x] Input field for user answer
- [x] Fuzzy matching accepts close answers
- [x] Shows correct answer if wrong
- [x] Auto-assigns quality rating based on accuracy
- [x] Handles multiple acceptable translations
- [x] Enter key submits answer
- [x] Progress indicator shows remaining cards

---

## M13: AI Card Generation Abstraction
**Description**: Create abstraction layer for AI-powered card generation. Support multiple providers (OpenAI, Anthropic) with fallback mechanism.

**Key Files Changed**:
- `lib/ai/generator.ts` - Main AI generator interface
- `lib/ai/providers/openai.ts` - OpenAI integration
- `lib/ai/providers/anthropic.ts` - Anthropic integration
- `lib/ai/types.ts` - AI-related types
- `app/api/ai/generate/route.ts` - AI generation endpoint
- `components/AIGenerateModal.tsx` - UI for AI generation

**Acceptance Criteria**:
- [x] Abstract interface for AI providers
- [x] OpenAI GPT-4 integration working
- [x] Anthropic Claude integration working
- [x] Automatic fallback if primary fails
- [x] POST /api/ai/generate creates cards from prompt
- [x] UI allows bulk card generation
- [x] Error handling for API failures
- [x] Rate limiting implemented

---

## M14: Import/Export JSON
**Description**: Add ability to import and export decks with cards in JSON format. Support backup and sharing functionality.

**Key Files Changed**:
- `app/api/decks/[id]/export/route.ts` - Export endpoint
- `app/api/decks/import/route.ts` - Import endpoint
- `lib/import-export/serializer.ts` - JSON serialization
- `lib/import-export/validator.ts` - Import validation
- `components/ExportButton.tsx` - Export UI component
- `components/ImportModal.tsx` - Import UI component

**Acceptance Criteria**:
- [x] GET /api/decks/[id]/export returns JSON file
- [x] POST /api/decks/import creates deck from JSON
- [x] Validates imported JSON structure
- [x] Preserves SRS metadata on export
- [x] Handles import errors gracefully
- [x] Download button on deck page
- [x] Import from file picker
- [x] Supports deck merging option

---

## M15: Polish and Deploy to Vercel
**Description**: Final polish, bug fixes, performance optimization, and deployment to Vercel with production database.

**Key Files Changed**:
- `README.md` - Updated documentation
- `vercel.json` - Vercel configuration
- `.env.production` - Production environment variables
- `app/layout.tsx` - Meta tags and SEO
- `app/globals.css` - Final styling polish
- Various components - UI/UX improvements

**Acceptance Criteria**:
- [x] All TypeScript errors resolved
- [x] No console warnings in production
- [x] Loading states for all async operations
- [x] Error boundaries implemented
- [x] SEO meta tags added
- [x] Vercel deployment successful
- [x] Production database configured
- [x] Environment variables set
- [x] README with setup instructions
- [x] Basic error logging configured

---

## Post-MVP Enhancements (Future)
- Audio pronunciation for Korean terms
- Spaced repetition statistics and charts
- Mobile app (React Native)
- Community deck sharing
- Advanced AI features (context-aware generation)
- Gamification (streaks, achievements)
- Support for other languages
