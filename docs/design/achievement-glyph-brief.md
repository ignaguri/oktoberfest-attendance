# Achievement Glyph Art Brief

This document is source material for generating 30 achievement glyph images by hand,
one at a time, in an external AI image-generation tool. Paste the shared style/context
section (or a condensed form of it) alongside each individual glyph prompt when
generating that glyph, since each generation is a separate, independent request with
no memory of the others.

Once a render exists, **[scripts/glyphs/README.md](../../scripts/glyphs/README.md)**
covers turning it into a shipped asset: `pnpm glyphs:build` strips the baked-in
transparency checkerboard, recovers real alpha, and writes the 256px PNG into both
apps. Do not hand-clean a render; the checkerboard has traps in it that the pipeline
already knows about.

## Shared style & context

Apply this to every glyph, regardless of category:

- **Canvas**: 48×48, with all artwork kept inside a 40×40 safe area (4px margin on
  every side).
- **Grid**: build on a 24px construction grid scaled 2× to the 48×48 canvas, so major
  shape edges land on whole-pixel boundaries.
- **Style**: solid-fill silhouette. No outlines, no interior linework, no shading or
  gradients used to imply depth or texture — the recognizable shape is the entire
  drawing. Must stay legible as a shape at 32px, since that's the render size used in
  the achievement grid and the unlock toast.
- **Colour**: full-color raster art rather than a flat monochrome vector path. Keep a
  clear, uncluttered silhouette that reads at 32px, exactly one clear subject per
  glyph, no background scene or environment behind the subject, and a style consistent
  across all 30 (same rendering treatment, same level of detail, same implied
  light/material handling) so the full set reads as one family rather than 30
  unrelated pieces.
- **Framing**: each glyph sits inside a category-coloured ring in its finished badge —
  so the glyph art itself should be self-contained and centered, without its own
  border, background plate, or frame.
- **Subject count**: one clear subject per glyph. Where a glyph description mentions
  multiple small elements (three glasses, three figures, four tents), those elements
  together form a single readable composition, not a scene.

## Per-glyph prompts

Prompts are grouped by category, matching how the achievements themselves are
grouped: the 20 tiered series first, then the 10 one-off achievements. The line under
each heading names the achievement(s) that glyph illustrates, for context — it is not
part of the prompt itself.

### Drinking

#### masskrug

*Total drinks logged this festival, from First Round to Legendary Thirst.*

masskrug is a one-litre stein with a hinged lid seen three-quarter on, its handle
facing right and a slight forward tilt as if it's mid-raise for a toast.

#### sunburst-stein

*Most drinks logged in a single day, from Solid Session to Unstoppable.*

sunburst-stein is a shorter, wider dimpled beer mug viewed straight-on, with short
triangular rays fanning out symmetrically behind its rim like a single day's session
caught in one bright burst.

#### three-glasses

*Number of distinct drink types tried, from Sampler to Full Menu.*

three-glasses is a lineup of three differently shaped drinking vessels — a tall
pilsner glass, a squat dimpled stein, and a stemmed glass — standing shoulder to
shoulder at slightly staggered heights.

#### measuring-jug

*Total litres consumed this festival, from First Litres to Century Litres.*

measuring-jug is a glass pitcher with a pouring spout at the upper left and three
short horizontal gradation marks etched across its belly, reading as a vessel for
measuring volume rather than one for drinking directly from.

#### coin-hand

*Total tip amount given this festival, from Generous Start to Legendary Tipper.*

coin-hand is an open palm seen from above with a single large coin balanced just
above it mid-drop, a thin crescent highlight along the coin's upper edge.

#### purse

*Total money spent this festival, from Opening the Wallet to No Limits.*

purse is a round drawstring pouch cinched tight at the neck, the two drawstring ends
splaying outward and the body bulging slightly to read as full rather than empty.

### Attendance

#### calendar-check

*Number of distinct festival days attended, from Showed Up to Festival Fixture.*

calendar-check is a single calendar page with a spiral-bound top edge and a bold
checkmark stamped diagonally across its date grid, corner to corner.

#### chain-links

*Longest run of consecutive days attended, from Two in a Row to Unbroken Chain.*

chain-links is three oval links interlocked in a straight horizontal row, the center
link drawn slightly larger than its neighbours to lead the eye along the sequence.

### Explorer

#### tent-peaks

*Number of distinct tents visited this festival, from Tent Curious to Tent Master.*

tent-peaks is two overlapping tent-triangle peaks with a small dotted arc arcing
between their tips, tracing a path from one tent over to the next.

#### ferris-wheel

*Number of distinct festivals attended, lifetime, from First Festival to Festival Legend.*

ferris-wheel is a spoked wheel silhouette on a single support strut, with four small
cabin shapes hanging off the rim at the top, bottom, left, and right like stops on a
repeating circuit.

#### compass-rose

*Number of distinct festival types attended, lifetime, from First Style to Festival Connoisseur.*

compass-rose is a four-pointed star compass with its north point drawn long and
narrow and the other three points shortened, evoking a traveller orienting toward
new, unvisited ground.

### Social

#### three-figures

*Number of groups joined this festival, from Joined Up to Social Hub.*

three-figures is three simplified standing human silhouettes side by side, the outer
two angled slightly inward toward the center one so the trio reads as a huddle
rather than a queue.

#### clasped-hands

*Number of friends added, lifetime, from First Friend to Social Butterfly.*

clasped-hands is two forearms entering from the lower-left and lower-right corners,
meeting and gripping at the center in a single overlapping handshake.

#### camera-shutter

*Number of photos uploaded this festival, from Say Cheese to Memory Keeper.*

camera-shutter is a circular iris built from six overlapping curved blades
converging toward a small open aperture at the center, caught mid-click.

#### spark-heart

*Number of reactions given to others' photos this festival, from Showing Love to Reaction Machine.*

spark-heart is a rounded heart shape with three short spark lines radiating from its
upper-right lobe, as though it just lit up in response to something.

### Competitive

#### laurel-cup

*Number of first-place group finishes, lifetime, from First Win to Dynasty.*

laurel-cup is a two-handled trophy cup on a short stem, with a laurel branch curving
up and inward along each handle to nearly meet above the rim.

#### podium-steps

*Number of top-three group finishes, lifetime, from On the Podium to Podium Legend.*

podium-steps is a three-block winner's podium seen from the front, stepping up left
to right with the tallest block on the right and a small five-point star hovering
just above it.

### Dedication

#### hourglass

*Number of distinct days active in the app, lifetime, from Getting Started to Lifer.*

hourglass is a classic pinched hourglass silhouette with sand piled thick in the
bottom bulb and only a thin remaining layer at the top, reading as accumulated time
rather than time running out.

#### flame-steady

*Longest run of consecutive active days, lifetime, from Warming Up to Unstoppable Streak.*

flame-steady is a single upright teardrop flame with a straight, unwavering left
edge and only a gentle flicker curling off the right side, reading as sustained
rather than guttering.

#### signal-flag

*Number of crowd reports submitted this festival, from First Report to Community Pillar.*

signal-flag is a triangular pennant on a short vertical pole, its trailing edge cut
with a sharp inward notch so it reads as snapping mid-signal rather than hanging
limp.

### One-off achievements

#### first-drop

*"First Drop" — logging your very first drink ever.*

first-drop is a single teardrop-shaped liquid drop frozen mid-fall, with a small
crescent highlight near its top and nothing else in frame, isolated to mark a single
first instance.

#### sunrise-gate

*"Opening Day" — attending the festival's opening day.*

sunrise-gate is a simple arched festival entrance gate with a rising half-sun
directly behind its peak, short rays fanning upward from a low horizon line at the
gate's base.

#### sunset-gate

*"Last Call" — attending the festival's closing day.*

sunset-gate reuses the same arched gate silhouette as sunrise-gate, but the sun now
sits low and sinking behind it — only its upper arc shows above the horizon, and the
rays angle downward instead of up — so the two glyphs read as a clear pair at
opposite ends of the day.

#### double-sun

*"Weekend Warrior" — attending every weekend day of the festival.*

double-sun is two identical sun discs, each with short radiating rays, overlapping
side by side like two consecutive days sharing one sky.

#### wiesn-crown

*"Full Festival" — attending every single day of the festival.*

wiesn-crown is a Bavarian crown with a pretzel where the central cross would be, its
peaks alternating tall and short around the band.

#### tent-ring

*"Grand Tour" — visiting every large tent at the festival.*

tent-ring is four small tent-peak triangles arranged evenly around an implied
circle, each base angled inward so together they enclose a shared center point.

#### polaroid

*"First Snap" — uploading your very first photo ever.*

polaroid is a square instant-photo frame with a thick white border along the bottom
edge and a small rounded nick cut into its top-right corner, the picture area left
blank.

#### banner-pole

*"Group Founder" — creating a group.*

banner-pole is a tall, slightly tapered vertical pole with a rectangular flag
jutting from its upper right, the flag's outer edge cut in a swallowtail notch as if
just run up and still catching the wind.

#### id-card

*"Profile Complete" — setting an avatar, username, and full name.*

id-card is a rounded-rectangle card in portrait orientation with a small circular
portrait cutout in the upper-left corner and two short horizontal bars beside it
standing in for a name and a detail line.

#### ribbon-scroll

*"Year in Review" — viewing your Wrapped summary.*

ribbon-scroll is a horizontal parchment scroll with both ends rolled inward toward
the center, a diagonal ribbon seal draped across its middle as if the year it
records has just been closed and sealed.
