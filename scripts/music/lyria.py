# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.0"]
# ///
"""Stream one take from Google Lyria RealTime into a 48 kHz stereo WAV.

Run through uv so the dependency installs itself:
    uv run lyria.py --output out.wav --duration 25 --seed 1 --bpm 120 --prompt "..."
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import wave

SAMPLE_RATE = 48000
CHANNELS = 2
SAMPLE_WIDTH = 2  # 16-bit PCM


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--output", required=True)
    p.add_argument("--duration", type=float, required=True)
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--bpm", type=int, required=True)
    p.add_argument("--brightness", type=float, required=True)
    p.add_argument("--density", type=float, required=True)
    p.add_argument("--prompt", required=True)
    p.add_argument("--negative-prompt")
    return p.parse_args()


async def generate(args: argparse.Namespace) -> None:
    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=os.environ["GEMINI_API_KEY"],
        http_options={"api_version": "v1alpha"},
    )
    target_bytes = int(args.duration * SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH)
    prompts = [types.WeightedPrompt(text=args.prompt, weight=1.0)]
    if args.negative_prompt:
        prompts.append(types.WeightedPrompt(text=args.negative_prompt, weight=-1.0))

    buf = bytearray()
    async with client.aio.live.music.connect(model="models/lyria-realtime-exp") as session:
        await session.set_weighted_prompts(prompts=prompts)
        await session.set_music_generation_config(
            config=types.LiveMusicGenerationConfig(
                seed=args.seed,
                bpm=args.bpm,
                brightness=args.brightness,
                density=args.density,
                temperature=1.0,
            ),
        )
        await session.play()

        async def collect() -> None:
            async for msg in session.receive():
                content = msg.server_content
                if content and content.audio_chunks:
                    for chunk in content.audio_chunks:
                        buf.extend(chunk.data)
                if len(buf) >= target_bytes:
                    return

        await asyncio.wait_for(collect(), timeout=args.duration + 15)

    with wave.open(args.output, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(bytes(buf[:target_bytes]))


def main() -> None:
    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("GEMINI_API_KEY is not set (gen.sh reads it from ~/.config/gemini.env)")
    asyncio.run(generate(parse_args()))


if __name__ == "__main__":
    main()
