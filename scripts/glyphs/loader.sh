#!/usr/bin/env bash
# Export the filling-mug loader's two layers into both apps.
#
# The full mug is the committed masskrug glyph, and the empty mug is derived from
# it by mug-empty.py, so the pair stays pixel aligned. No generation step: nothing
# here needs the model or the work dir.
set -euo pipefail
cd "$(dirname "$0")"
SRC="../../apps/web/public/achievements/glyphs/masskrug.png"
MOBILE="../../apps/mobile/assets/loading"
WEB="../../apps/web/public/loading"
mkdir -p "$MOBILE" "$WEB"

magick "$SRC" -strip "$MOBILE/mug-full.png"
uv run --with pillow python mug-empty.py "$MOBILE/mug-full.png" "$MOBILE/mug-empty.png"
magick "$MOBILE/mug-empty.png" -strip "$MOBILE/mug-empty.png"
cp "$MOBILE/mug-full.png" "$MOBILE/mug-empty.png" "$WEB/"
echo "exported loader mug to both apps"
du -sh "$MOBILE" "$WEB"
