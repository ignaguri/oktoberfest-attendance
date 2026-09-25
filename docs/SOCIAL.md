# Social

ProstCounter's own social accounts, what's been posted, and how the assets are made.
Campaign graphics from Google Labs live in [POMELLI.md](./POMELLI.md).

## Instagram: [@prostcounter](https://www.instagram.com/prostcounter/)

Professional account, public. Managed from the web (instagram.com, Spanish UI).

**Profile**

- Name: `ProstCounter · Oktoberfest App`
- Bio:
  ```
  🍺 Count every Prost at the Wiesn & beer fests
  🏆 Compete with your crew, unlock badges, get your Wrapped
  📲 Free on iOS & Android ↓
  ```
- Links: Website `www.prostcounter.fun`, App download `www.prostcounter.fun/download`
- Avatar: the app icon

**Linked from the apps** (`INSTAGRAM_URL` in `packages/shared/src/constants/app.ts`):

- Web app footer (`apps/web/components/Footer.tsx`)
- Marketing footer, bottom row (`apps/web/components/marketing/MarketingFooter.tsx`)
- Mobile Profile > About & Support (`apps/mobile/components/profile/about-section.tsx`).
  Opens with `Linking`, not the in-app browser, so the Instagram app takes it when installed.

Copy key is `followInstagram` under `footer`, `marketing.footer` and `profile.about`.

### Posts

| Date       | Type     | What                                                                   | Source                                             |
| ---------- | -------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| 2026-09-25 | Carousel | 8 app screenshots, 4:5, alt text per slide                             | `screenshots/instagram/en/`                        |
| 2026-09-25 | Reel     | 20s promo remix: Maß counter hook, two-tap log, leaderboard, 90 badges | `brags/2026-09-25-162342/brag.mp4` (main checkout) |

Links: [carousel](https://www.instagram.com/prostcounter/p/Ddt5T5tCGEQ/),
[reel](https://www.instagram.com/prostcounter/reel/Ddt9ydwPRPC/).

### Where assets come from

- **Screenshot carousels**: `python3 scripts/store-screenshots/render.py en instagram`
  renders the store screenshots into a 1080x1350 (4:5) frame with the whole phone visible.
  See [scripts/store-screenshots/README.md](../scripts/store-screenshots/README.md).
- **Promo videos**: `brags/` in the main checkout (gitignored, not on any branch). Each run
  folder has `brag.mp4` (1080x1920), `share-copy.txt` (the caption written for that cut),
  `brag-plan.md` and the `composition/`. `share-copy.txt` wins over the caption in
  `brag-plan.md`, which is only the first draft. As of 2026-09-25, `155717` is the unposted
  original, and the four `164442-*` runs are still work in progress.

### Posting from the web

- Feed images max out at 4:5. Pick the 4:5 crop ("Seleccionar recorte"), or Instagram
  squares them.
- Every video post becomes a Reel. Pick "Original" in the crop step to keep 9:16.
- The cover defaults to the first frame. The brag renders open on a poster frame, so the
  default is fine.
- Alt text is per image, under "Accesibilidad" in the caption step. There is no visible
  per-slide caption on the web.
- Leave the AI label off for screenshots and motion-graphics renders of the real UI.
- Captions: English, no em-dashes, `prostcounter.fun` spelled out (caption links aren't
  clickable), hashtags `#oktoberfest #wiesn #oktoberfest2026 #munich #prost`.
