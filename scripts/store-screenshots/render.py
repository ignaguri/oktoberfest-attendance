#!/usr/bin/env python3
"""Frame raw simulator captures for the stores: headline on brand yellow, phone below.

Usage: python3 scripts/store-screenshots/render.py [locale] [target]   (defaults: en appstore)
Reads screenshots/iphone-6.9/raw/<id>.png and copy.json. Targets:
  appstore   1320x2868 (App Store 6.9")  -> screenshots/iphone-6.9/framed/<locale>/
  play       1080x1920 (Play, 9:16)      -> fastlane/metadata/android/<play locale>/images/phoneScreenshots/
  instagram  1080x1350 (feed, 4:5, whole phone) -> screenshots/instagram/<locale>/
"""
import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RAW = ROOT / "screenshots/iphone-6.9/raw"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PLAY_LOCALES = {"en": "en-US", "de": "de-DE", "es": "es-ES"}

# Pixel sizes per target. phone = outer width, pad = bezel, radius = outer corner radius.
TARGETS = {
    "appstore": dict(width=1320, height=2868, font=124, top=200, head=268, gap=80, phone=990, pad=20, radius=150),
    "play": dict(width=1080, height=1920, font=92, top=110, head=210, gap=60, phone=700, pad=14, radius=106),
    "instagram": dict(width=1080, height=1350, font=64, top=50, head=110, gap=25, phone=500, pad=11, radius=76),
}


def output_dir(target: str, locale: str) -> Path:
    if target == "play":
        return ROOT / "fastlane/metadata/android" / PLAY_LOCALES[locale] / "images/phoneScreenshots"
    if target == "instagram":
        return ROOT / "screenshots/instagram" / locale
    return ROOT / "screenshots/iphone-6.9/framed" / locale


def fill_top_band(src: Path, dst: Path) -> None:
    """Wrapped hides the status bar and leaves a black band; paint it with the slide colour."""
    img = Image.open(src).convert("RGB")
    band = 0
    while band < img.height // 4 and sum(img.getpixel((img.width // 2, band))) < 15:
        band += 1
    if band:
        colour = img.getpixel((img.width // 2, band + 4))
        img.paste(colour, (0, 0, img.width, band))
    img.save(dst)


def page(headline: str, shot: Path, t: dict) -> str:
    screen_radius = t["radius"] - t["pad"]
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Calistoga; src: url('{(HERE / "fonts/Calistoga-Regular.ttf").as_uri()}'); }}
html, body {{ margin: 0; width: {t['width']}px; height: {t['height']}px; overflow: hidden; }}
body {{
  background: linear-gradient(170deg, #fde047 0%, #facc15 40%, #f59e0b 100%);
  display: flex; flex-direction: column; align-items: center;
}}
h1 {{
  font-family: Calistoga, serif; font-weight: 400; color: #431407;
  font-size: {t['font']}px; line-height: 1.08; letter-spacing: -1px; text-align: center; text-wrap: balance;
  width: 85%; margin: {t['top']}px 0 0; height: {t['head']}px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}}
.phone {{
  margin-top: {t['gap']}px; width: {t['phone']}px; padding: {t['pad']}px; border-radius: {t['radius']}px; background: #1c1917; flex-shrink: 0;
  box-shadow: 0 40px 90px rgba(67, 20, 7, .35), 0 0 0 3px rgba(255, 255, 255, .25) inset;
}}
.phone img {{ display: block; width: 100%; border-radius: {screen_radius}px; }}
</style></head><body>
<h1>{html.escape(headline)}</h1>
<div class="phone"><img src="{shot.as_uri()}"></div>
</body></html>"""


def main() -> None:
    locale = sys.argv[1] if len(sys.argv) > 1 else "en"
    target = sys.argv[2] if len(sys.argv) > 2 else "appstore"
    t = TARGETS[target]
    copy = json.loads((HERE / "copy.json").read_text())[locale]
    out = output_dir(target, locale)
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for shot_id, headline in copy.items():
            shot = Path(tmp) / f"{shot_id}.png"
            fill_top_band(RAW / f"{shot_id}.png", shot)
            page_file = Path(tmp) / f"{shot_id}.html"
            page_file.write_text(page(headline, shot, t))
            subprocess.run(
                [CHROME, "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
                 f"--window-size={t['width']},{t['height']}", f"--screenshot={out / f'{shot_id}.png'}",
                 "--allow-file-access-from-files", page_file.as_uri()],
                check=True, capture_output=True,
            )
            print(out / f"{shot_id}.png")


if __name__ == "__main__":
    main()
