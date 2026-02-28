#!/usr/bin/env python3
"""
KSRS Anki Deck Builder
Reads cards.json -> generates TTS audio -> builds .apkg file
"""

import json
import os
import asyncio
import hashlib
import genanki
import edge_tts

VOICE = "ko-KR-SunHiNeural"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
AUDIO_DIR = os.path.join(OUTPUT_DIR, "audio")

VOCAB_MODEL = genanki.Model(
    1607392319,
    "KSRS Vocab",
    fields=[
        {"name": "Korean"},
        {"name": "English"},
        {"name": "Romanization"},
        {"name": "Audio"},
        {"name": "Tags"},
    ],
    templates=[
        {
            "name": "Korean to English",
            "qfmt": '<div style="font-size:48px;text-align:center;">{{Korean}}</div>'
                    '<div style="font-size:14px;color:#888;text-align:center;">{{Romanization}}</div>'
                    "{{Audio}}",
            "afmt": '{{FrontSide}}<hr id="answer">'
                    '<div style="font-size:32px;text-align:center;">{{English}}</div>',
        },
    ],
    css=".card { font-family: 'Noto Sans KR', Arial, sans-serif; background: #1a1a2e; color: #eee; }"
)

SENTENCE_MODEL = genanki.Model(
    1607392320,
    "KSRS Sentence",
    fields=[
        {"name": "KoreanSentence"},
        {"name": "EnglishSentence"},
        {"name": "Audio"},
        {"name": "RelatedVocab"},
    ],
    templates=[
        {
            "name": "Sentence to Translation",
            "qfmt": '<div style="font-size:32px;text-align:center;">{{KoreanSentence}}</div>'
                    "{{Audio}}",
            "afmt": '{{FrontSide}}<hr id="answer">'
                    '<div style="font-size:24px;text-align:center;">{{EnglishSentence}}</div>'
                    '<div style="font-size:14px;color:#888;text-align:center;">Vocab: {{RelatedVocab}}</div>',
        },
    ],
    css=".card { font-family: 'Noto Sans KR', Arial, sans-serif; background: #1a1a2e; color: #eee; }"
)

DECK_ID = 2059400110


async def generate_audio(text, filename):
    filepath = os.path.join(AUDIO_DIR, filename)
    if os.path.exists(filepath):
        return filepath
    try:
        communicate = edge_tts.Communicate(text, VOICE)
        await communicate.save(filepath)
        return filepath
    except Exception as e:
        print(f"TTS failed for '{text}': {e}")
        return None


def make_audio_filename(text):
    h = hashlib.md5(text.encode()).hexdigest()[:8]
    return f"ko_{h}.mp3"


async def build_deck():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(os.path.join(DATA_DIR, "cards.json"), "r", encoding="utf-8") as f:
        data = json.load(f)

    deck = genanki.Deck(DECK_ID, data["deck_name"])
    media_files = []

    for card in data["cards"]:
        vocab_audio_file = make_audio_filename(card["korean"])
        audio_path = await generate_audio(card["korean"], vocab_audio_file)
        if audio_path:
            media_files.append(audio_path)

        vocab_note = genanki.Note(
            model=VOCAB_MODEL,
            fields=[
                card["korean"],
                card["english"],
                card.get("romanization", ""),
                f"[sound:{vocab_audio_file}]" if audio_path else "",
                ", ".join(card.get("tags", [])),
            ],
            guid=genanki.guid_for(str(card["id"]) + "_vocab"),
            tags=card.get("tags", []),
        )
        deck.add_note(vocab_note)

        if "sentence" in card:
            sent = card["sentence"]
            sent_audio_file = make_audio_filename(sent["korean"])
            audio_path = await generate_audio(sent["korean"], sent_audio_file)
            if audio_path:
                media_files.append(audio_path)

            sent_note = genanki.Note(
                model=SENTENCE_MODEL,
                fields=[
                    sent["korean"],
                    sent["english"],
                    f"[sound:{sent_audio_file}]" if audio_path else "",
                    card["korean"],
                ],
                guid=genanki.guid_for(str(card["id"]) + "_sentence"),
                tags=card.get("tags", []) + ["sentence"],
            )
            deck.add_note(sent_note)

    output_path = os.path.join(OUTPUT_DIR, "KSRS.apkg")
    package = genanki.Package(deck)
    package.media_files = media_files
    package.write_to_file(output_path)

    print(f"Built {output_path}")
    print(f"  {len(data['cards'])} vocab cards + sentence cards")
    print(f"  {len(media_files)} audio files")
    return output_path


if __name__ == "__main__":
    asyncio.run(build_deck())