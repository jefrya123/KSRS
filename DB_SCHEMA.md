# Database Schema Documentation

## Overview

This database schema supports a Korean Spaced Repetition System (SRS) with the following features:
- SM-2 algorithm implementation with FSRS compatibility planning
- Usefulness scoring for vocabulary prioritization
- Multiple review modes (flashcard, typing, listening)
- Tag-based organization
- Voice mode support (planned feature)

## Tables

### User

Stores user accounts and preferences.

**Fields:**
- `id` (String, UUID): Primary key
- `email` (String, unique): User's email address
- `name` (String, optional): User's display name
- `settings` (JSON): User preferences and configuration
  - Example: `{ "daily_goal": 20, "theme": "dark", "audio_autoplay": true }`
- `created_at` (DateTime): Account creation timestamp
- `updated_at` (DateTime): Last modification timestamp

**Relationships:**
- One-to-many with Deck (user owns multiple decks)
- One-to-many with CardProgress (user has progress for multiple cards)

---

### Deck

Organizes cards into collections (e.g., "TOPIK I Vocabulary", "Common Verbs").

**Fields:**
- `id` (String, UUID): Primary key
- `user_id` (String): Foreign key to User
- `name` (String): Deck name
- `description` (String, optional): Deck description
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last modification timestamp

**Relationships:**
- Many-to-one with User
- One-to-many with Card (deck contains multiple cards)

**Indexes:**
- `user_id` for efficient deck lookup by user

---

### Card

Stores vocabulary cards with Korean-English translations and metadata.

**Fields:**
- `id` (String, UUID): Primary key
- `deck_id` (String): Foreign key to Deck
- `korean` (String): Korean text (e.g., "안녕하세요")
- `english` (String): English translation
- `notes` (String, optional): Additional notes or mnemonics
- `example_korean` (String, optional): Example sentence in Korean
- `example_english` (String, optional): Example sentence translation
- `romanization` (String, optional): Romanized Korean (e.g., "annyeonghaseyo")
- `usefulness_score` (Int, 0-100): Calculated usefulness score for prioritization
- `usefulness_reasons` (String[]): Array of reasons for usefulness scoring
  - Examples: "high_frequency", "topik_essential", "daily_conversation", "business_common"
- `is_pattern` (Boolean): Whether this card represents a grammar pattern vs vocabulary
- `image_url` (String, optional): URL to associated image
- `audio_url` (String, optional): URL to pronunciation audio
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last modification timestamp

**Relationships:**
- Many-to-one with Deck
- One-to-many with CardProgress (multiple users can study the same card)
- Many-to-many with Tag via CardTag

**Indexes:**
- `deck_id` for efficient card lookup by deck
- `usefulness_score` for prioritized card selection

**Usefulness Scoring:**
The usefulness score (0-100) helps prioritize which cards users should learn first. Higher scores indicate more essential vocabulary. The scoring considers:
- Frequency in everyday conversation
- TOPIK level requirements
- Grammar pattern importance
- Domain-specific relevance (business, travel, etc.)

---

### CardProgress

Tracks individual user progress for each card using the SM-2 algorithm.

**Fields:**
- `id` (String, UUID): Primary key
- `card_id` (String): Foreign key to Card
- `user_id` (String): Foreign key to User
- `ease_factor` (Float, default 2.5): SM-2 ease factor (difficulty multiplier)
  - Range: typically 1.3 to 2.5+
  - Increases with successful reviews, decreases with failures
- `interval_days` (Int, default 0): Days until next review
  - Starts at 0 for new cards
  - Grows exponentially with successful reviews
- `repetitions` (Int, default 0): Consecutive successful reviews
  - Resets to 0 on failed review
- `due_at` (DateTime): When the card is due for review
- `last_reviewed_at` (DateTime, optional): Last review timestamp
- `difficulty` (Float, optional): FSRS difficulty parameter (for future migration)
  - Reserved for Free Spaced Repetition Scheduler algorithm
- `created_at` (DateTime): First study timestamp
- `updated_at` (DateTime): Last modification timestamp

**Relationships:**
- Many-to-one with Card
- Many-to-one with User
- One-to-many with ReviewLog (history of all reviews)

**Indexes:**
- `card_id, user_id` (unique composite): One progress record per user per card
- `due_at` for efficient due card queries
- `user_id, due_at` for user-specific due card queries

**SM-2 Algorithm Overview:**
The SuperMemo 2 algorithm adjusts scheduling based on user performance:
1. New cards start with ease_factor=2.5, interval=0, repetitions=0
2. After each review, the algorithm updates these values based on rating (1-4)
3. Successful reviews increase interval exponentially
4. Failed reviews reset the card to short intervals

**FSRS Compatibility:**
The `difficulty` field is reserved for future migration to the Free Spaced Repetition Scheduler (FSRS) algorithm, which uses machine learning for more accurate scheduling. This allows graceful migration without schema changes.

---

### Tag

Categorical labels for organizing cards (e.g., "food", "verbs", "polite-speech").

**Fields:**
- `id` (String, UUID): Primary key
- `name` (String, unique): Tag name
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last modification timestamp

**Relationships:**
- Many-to-many with Card via CardTag

---

### CardTag

Junction table for many-to-many relationship between Cards and Tags.

**Fields:**
- `card_id` (String): Foreign key to Card
- `tag_id` (String): Foreign key to Tag
- `created_at` (DateTime): Association timestamp

**Relationships:**
- Many-to-one with Card
- Many-to-one with Tag

**Indexes:**
- `card_id, tag_id` (unique composite): Prevent duplicate tag assignments

---

### ReviewLog

Audit log of all review sessions for analytics and algorithm tuning.

**Fields:**
- `id` (String, UUID): Primary key
- `card_progress_id` (String): Foreign key to CardProgress
- `rating` (Int, 1-4): User's self-assessment
  - 1: Again (complete failure)
  - 2: Hard (difficult recall)
  - 3: Good (correct with effort)
  - 4: Easy (instant recall)
- `review_mode` (Enum): Type of review performed
  - `FLASHCARD`: Traditional card flip
  - `TYPING`: Type the translation
  - `LISTENING`: Audio-based review
  - `VOICE`: Voice response (future feature)
- `response_time_ms` (Int): Time taken to answer (milliseconds)
- `user_answer` (String, optional): User's typed/voice answer (for typing/voice modes)
- `created_at` (DateTime): Review timestamp

**Relationships:**
- Many-to-one with CardProgress

**Indexes:**
- `card_progress_id` for progress history lookup
- `created_at` for temporal analytics

**Analytics Use Cases:**
- Track learning velocity and retention rates
- Identify difficult cards for content improvement
- Measure effectiveness of different review modes
- Generate progress reports and statistics

---

## Voice Mode Support (Future Feature)

The schema includes placeholders for voice-based learning features:

**Planned Fields (not yet implemented):**
- `Card.recording_url`: URL to user's voice recording for pronunciation practice
- `Card.transcript`: Auto-generated transcript of pronunciation audio
- `ReviewLog.user_answer`: Will store voice-to-text transcript for voice mode reviews

**Use Cases:**
- Pronunciation practice with speech recognition
- Speaking drills with automated feedback
- Conversation simulation exercises

---

## Query Optimization

**Critical Indexes:**
1. `CardProgress.due_at`: Fast retrieval of cards due for review
2. `CardProgress (user_id, due_at)`: Optimized user-specific review queries
3. `Card.usefulness_score`: Efficient prioritization of new cards
4. `Card.deck_id`: Fast deck browsing
5. `ReviewLog.card_progress_id`: Quick progress history access
6. `CardTag (card_id, tag_id)`: Efficient tag filtering

**Common Query Patterns:**
```sql
-- Get cards due for review (most frequent query)
SELECT * FROM CardProgress
WHERE user_id = ? AND due_at <= NOW()
ORDER BY due_at ASC;

-- Get new cards prioritized by usefulness
SELECT * FROM Card
WHERE deck_id = ? AND id NOT IN (
  SELECT card_id FROM CardProgress WHERE user_id = ?
)
ORDER BY usefulness_score DESC;

-- Get review statistics
SELECT COUNT(*), AVG(rating), AVG(response_time_ms)
FROM ReviewLog
WHERE card_progress_id IN (
  SELECT id FROM CardProgress WHERE user_id = ?
)
AND created_at >= NOW() - INTERVAL '7 days';
```

---

## Migration Path: SM-2 to FSRS

**Current Implementation:**
- SM-2 algorithm using `ease_factor`, `interval_days`, `repetitions`

**Future Migration:**
1. Collect review history in ReviewLog
2. Use historical data to calculate FSRS parameters
3. Populate `CardProgress.difficulty` using ML model
4. Gradually transition scheduling logic to FSRS
5. Maintain SM-2 fields for fallback/comparison

**Advantages of FSRS:**
- More accurate predictions based on forgetting curves
- Adapts to individual learning patterns
- Better handling of inconsistent review schedules
- Reduced review burden with same retention rate

---

## Data Integrity Constraints

1. **Cascade Deletes:**
   - Deleting User cascades to Deck and CardProgress
   - Deleting Deck cascades to Card
   - Deleting Card cascades to CardProgress and CardTag
   - Deleting CardProgress cascades to ReviewLog

2. **Unique Constraints:**
   - `User.email`: One account per email
   - `Tag.name`: No duplicate tag names
   - `CardProgress (card_id, user_id)`: One progress record per user-card pair
   - `CardTag (card_id, tag_id)`: No duplicate tag assignments

3. **Validation:**
   - `rating`: Must be 1, 2, 3, or 4
   - `usefulness_score`: Must be 0-100
   - `ease_factor`: Should be >= 1.3
   - `interval_days`: Must be >= 0
   - `repetitions`: Must be >= 0

---

## Example Data Flow

**New User Journey:**
1. User signs up → `User` record created
2. User creates "TOPIK I Vocab" deck → `Deck` record created
3. User adds "안녕하세요" card → `Card` record created with usefulness_score=95
4. User starts studying → `CardProgress` created with defaults (EF=2.5, interval=0)
5. User reviews and rates "Good" → `ReviewLog` created, CardProgress updated (interval=1)
6. Next day, card becomes due → due_at <= NOW()
7. User reviews again, rates "Easy" → interval increases to ~6 days

**Tag Organization:**
1. Admin creates tags: "verbs", "food", "greetings"
2. Cards are tagged via CardTag junction table
3. Users can filter cards by tag for focused study sessions
