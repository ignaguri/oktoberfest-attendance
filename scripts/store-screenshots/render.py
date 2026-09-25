#!/usr/bin/env python3
"""Frame raw simulator captures for the stores: headline on brand yellow, phone below.

Usage: python3 scripts/store-screenshots/render.py [locale]   (default: en)
Reads  screenshots/iphone-6.9/raw/<id>.png and copy.json, writes
       screenshots/iphone-6.9/framed/<locale>/<id>.png at 1320x2868 (App Store 6.9").
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
WIDTH, HEIGHT = 1320, 2868


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


def page(headline: str, shot: Path) -> str:
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Calistoga; src: url('{(HERE / "fonts/Calistoga-Regular.ttf").as_uri()}'); }}
html, body {{ margin: 0; width: {WIDTH}px; height: {HEIGHT}px; overflow: hidden; }}
body {{
  background: linear-gradient(170deg, #fde047 0%, #facc15 40%, #f59e0b 100%);
  display: flex; flex-direction: column; align-items: center;
}}
h1 {{
  font-family: Calistoga, serif; font-weight: 400; color: #431407;
  font-size: 124px; line-height: 1.08; letter-spacing: -1px; text-align: center; text-wrap: balance;
  width: 1120px; margin: 200px 0 0; height: 268px;
  display: flex; align-items: center; justify-content: center;
}}
.phone {{
  margin-top: 80px; width: 990px; padding: 20px; border-radius: 150px; background: #1c1917;
  box-shadow: 0 40px 90px rgba(67, 20, 7, .35), 0 0 0 3px rgba(255, 255, 255, .25) inset;
}}
.phone img {{ display: block; width: 100%; border-radius: 130px; }}
</style></head><body>
<h1>{html.escape(headline)}</h1>
<div class="phone"><img src="{shot.as_uri()}"></div>
</body></html>"""


def main() -> None:
    locale = sys.argv[1] if len(sys.argv) > 1 else "en"
    copy = json.loads((HERE / "copy.json").read_text())[locale]
    out = ROOT / "screenshots/iphone-6.9/framed" / locale
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for shot_id, headline in copy.items():
            shot = Path(tmp) / f"{shot_id}.png"
            fill_top_band(RAW / f"{shot_id}.png", shot)
            page_file = Path(tmp) / f"{shot_id}.html"
            page_file.write_text(page(headline, shot))
            subprocess.run(
                [CHROME, "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
                 f"--window-size={WIDTH},{HEIGHT}", f"--screenshot={out / f'{shot_id}.png'}",
                 "--allow-file-access-from-files", page_file.as_uri()],
                check=True, capture_output=True,
            )
            print(out / f"{shot_id}.png")


if __name__ == "__main__":
    main()
