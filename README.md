# KSRS - Korean Spaced Repetition System

Anki flashcard deck builder for Korean language learning with native TTS audio.

## How It Works

1. `data/cards.json` - All vocab and sentences live here
2. `scripts/build_anki.py` - Builds .apkg with Korean TTS audio
3. `output/KSRS.apkg` - Import this into Anki

## Card Types

- **Vocab Card** - Korean word on front with audio, English on back
- **Sentence Card** - Full Korean sentence with audio, English translation on back

## Setup

`
pip install -r requirements.txt
python scripts/build_anki.py
`

Then import `output/KSRS.apkg` into Anki. Re-importing updates cards without losing progress.

## Adding Cards

Add entries to `data/cards.json` following the existing format, then rebuild.