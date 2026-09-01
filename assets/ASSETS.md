# Robinsqueeze — art direction & Midjourney brief

Everything ships with CSS gradient placeholders so the build looks right
before art exists. This is what replaces them.

---

## 1. The visual thesis

**Contained pressure.** Not explosion — *containment*. Something enormous is
being held, and the holding is what you can see. A reservoir behind a dam. A
sealed door. Fog packed against a ridge. The tension is in the restraint,
never in the release.

That is a legal constraint as much as an aesthetic one: the protocol promises
no squeeze. **Held, not launching.** Which is also why nothing here contains a
rocket, a moon, or an arrow.

The lineage is **hyperreal pastoral / corporate surrealism** — the Windows XP
*Bliss* bloodline: impossibly saturated landscape, one clean man-made object
placed where it doesn't belong, midday clarity, nobody around. Robinsqueeze
shifts that palette from blue to **deep green** and adds weight.

### Three composition rules, non-negotiable

1. **Centre stays clear.** The two wedges frame the middle of the hero and the
   headline sits across it. Subject small and central, or on a third — never
   filling the frame.
2. **Horizon at 58–62% down.** Matches the placeholder gradient and keeps both
   headline lines in open space. A real horizon line, not a vignette.
3. **No text, no logos, no signage.** Ever. All type is live HTML.

---

## 2. The style spine

Append to *every* prompt. This is what makes eight separate generations look
like one photographer's afternoon.

```
shot on Hasselblad X2D, 38mm, f/8, deep depth of field, natural midday light
with slight overcast diffusion, cool green colour grade, muted highlights,
rich shadow detail, fine 35mm grain, subtle atmospheric haze receding to the
horizon, no people, no text, no signage, photographic realism
--style raw --chaos 8 --ar <SLOT> --v 7
```

| Fragment | What it buys you |
|---|---|
| `Hasselblad X2D, 38mm` | Medium-format look, wide but undistorted. Stops MJ defaulting to a cinematic 24mm bulge. |
| `f/8, deep depth of field` | Kills the shallow-focus bokeh MJ loves. Landscape needs everything sharp. |
| `slight overcast diffusion` | Prevents blown highlights — the main tell of a fake landscape. |
| `cool green colour grade` | Locks to `--accent`. |
| `fine 35mm grain` | Pre-matches the site's CSS grain so the two don't fight. |
| `atmospheric haze receding` | Real depth cues. The single strongest "this is a photograph" signal. |
| `--style raw` | Turns off MJ's beautification. Essential. |
| `--chaos 8` | Low. You want four near-identical options, not four ideas. |

### Locking consistency

1. Generate the **hero** first. Iterate until it's right.
2. Upscale, copy its URL.
3. Add `--sref <url> --sw 80` to every later prompt.

`--sw 80` carries grade and grain while letting composition still respond.
Too samey? Drop to `--sw 50`.

### Negative prompt — append to everything

```
--no text, watermark, logo, signage, people, crowds, rockets, moon, arrows,
charts, graphs, stock tickers, neon, cyberpunk, lens flare, tilt-shift,
oversaturation, HDR halo, fisheye, vignette
```

---

## 3. Twitter

The reference is Waypoint's: a wide calm landscape, the wordmark centred in
white, two small rainbow arcs flanking it, and a mark-on-gradient avatar. What
makes it work is **restraint** — one landscape, one word, one accent gesture,
enormous negative space. Copy the discipline, not the picture.

### 3.1 Header — 1500 × 500 (`--ar 3:1`)

Critical: **the avatar covers the lower-left**, roughly x 0–260, y 190–500 on a
1500×500 canvas. Keep that corner empty. Put nothing there you'd miss.

**A — The reservoir (recommended).** Most on-theme, most distinctive.

```
An immense still reservoir held behind a low concrete dam, water glass-flat and
mirror-calm, dark green forested hills falling away on both sides, thin morning
mist on the surface, dam crest cutting one clean horizontal line across the
lower third, vast empty sky above, symmetrical, serene, enormous negative space
in the upper half --ar 3:1
```

**B — The held ridge.** Closest to the Waypoint feel; safest.

```
A vast sea of dense white cloud pressed against a long green ridge line, the
cloud held back as if by an invisible wall, one dark treeline cresting above
it, first light, absolute stillness, wide panoramic, generous empty sky --ar 3:1
```

**C — The sealed door.** Surreal, highest-risk/highest-reward.

```
A single monolithic steel door standing alone in an endless bright green
meadow, no frame, no building, one long shadow, overcast sky, the door small
and centred with vast open field on both sides --ar 3:1
```

**Then composite in a real editor — do not ask MJ for text:**
- `Robinsqueeze` in **Inter Medium**, white, centred, tracking `-0.03em`,
  cap-height ≈ 11% of canvas height, sitting slightly above centre.
- Flank it with the two wedges (`▶ ◀`) from `assets/favicon.svg`, white, at
  ~0.6× the wordmark cap height, pressing inward — that's the brand gesture and
  it's the equivalent of Waypoint's rainbow arcs.
- Add a 6–10% black scrim behind the type if the landscape is bright, or the
  wordmark will fight the background.

### 3.2 Avatar — 400 × 400 (`--ar 1:1`)

You already have the mark. For a Waypoint-style gradient version:

```
A smooth vertical gradient from deep forest green to bright spring green,
subtle soft grain, no objects, no text, perfectly even lighting, minimal
abstract background --ar 1:1
```

Then composite the **white hourglass** from `assets/favicon.svg` centred at
~46% of the canvas width. Keep enormous margin — Twitter crops to a circle and
a tight mark looks cramped at 48px.

**Simplest strong option:** ship `assets/icon-512.png` as-is. The black square
with the white hourglass is already sharp, high-contrast and unmistakable in a
timeline. The gradient version is a nice-to-have, not an upgrade.

---

## 4. "God UI" — read this before generating any interface art

**Do not generate UI in Midjourney.** Fake dashboards are the single fastest
way to make a protocol look fraudulent: the numbers are invented, the labels
are gibberish at full size, and on this project specifically it would violate
the no-fake-data rule the entire build is organised around.

The site's product surfaces are **real and already live**:

- the trade panel, with the 90/8/2 allocation computed by the same maths the
  contract runs
- the stat tiles, reading the live GME price, pool depth and multiplier from
  Robinhood Chain
- the terminal panel showing actual `cast call` output and real passing tests

**So: screenshot them.** Real UI at 2× DPI beats any generated mockup, and
every figure in it is true.

```bash
# 2x device pixel ratio, transparent-free, cropped to the panel
# (Chrome DevTools → Device Toolbar → set DPR 2 → Capture node screenshot)
```

Where you want a *frame* around a real screenshot, generate the environment and
composite the screenshot in:

```
A matte-black slab monitor standing alone on short green grass, screen off and
perfectly black, overcast daylight, front-on, centred, no reflections, no
branding, generous empty field around it --ar 16:10
```

Then paste the real screenshot into the black screen area. That gives the
surreal-object look with none of the dishonesty.

---

## 5. Site slots

### 5.1 Hero — `assets/videos/hero.mp4` (`--ar 16:9`)

Use the same three directions as the Twitter header (§3.1) — reusing the scene
is a feature: the header and the site should feel like one place.

**Animate it.** A still works; drift is most of the magic. MJ animate, Runway
Gen-3 or Kling:

> *very slow forward push, 6 seconds, seamless loop, no camera shake, no zoom
> punch, subtle water/cloud movement only*

```bash
ffmpeg -i in.mp4 -an -vf "scale=1920:-2,fps=30" -c:v libx264 -crf 24 \
  -preset slow -pix_fmt yuv420p -movflags +faststart assets/videos/hero.mp4
```

`-an` strips audio (it can never play). `-pix_fmt yuv420p` is **required** or
Safari shows a black frame. Keep under **6 MB** — the intro holds ~2.8s.

Export frame 1 as `assets/images/hero-poster.jpg` (1920×1080, q82) — it's what
slow connections and `prefers-reduced-motion` users see.

Then swap the placeholder in `index.html`:

```html
<video class="hero-media" muted loop playsinline preload="auto"
       poster="assets/images/hero-poster.jpg">
  <source src="assets/videos/hero.mp4" type="video/mp4">
</video>
```

### 5.2 Vault — `assets/images/vault.jpg` (`--ar 16:9`)

Beside "GME goes in. Nothing comes out." Must feel **sealed**, not secure — no
bank imagery, no gold, no crypto clichés.

```
A single monolithic steel door set flush into a smooth concrete wall in an
empty green field, no handle, no hinges, no markings, overcast sky, the wall
extending beyond frame both sides, cold grey against saturated green --ar 16:9
```

### 5.3 Carousel cards ×4 — `assets/images/card-1…4.jpg` (`--ar 4:3`)

A gradient scrim and text cover the **bottom third** — keep it simple there.
Vary the vantage so the set has rhythm:

```
1  Aerial directly above a narrow service road cutting through dense green
   forest, one pale line through the canopy, morning haze

2  Ground level at the foot of a concrete spillway, wet surface, green algae
   at the waterline, looking up the slope

3  Interior of an empty concrete pump house, one shaft of daylight from a high
   window, green light on standing water

4  Looking straight up through tall green canopy into overcast bright sky,
   symmetrical, calm
```

### 5.4 Footer underlay — `assets/images/footer.jpg` (`--ar 16:9`)

Seen through the contracting page behind the giant white wordmark. Needs a
**calm mid-tone centre** or the mark disappears.

```
Wide aerial over rolling deep green hills at first light, long soft shadows,
low mist collecting in the valleys, no landmarks, no roads, gentle horizon high
in the frame --ar 16:9
```

Then in `css/app.css` replace `.underlay`'s gradient:

```css
background: url("../assets/images/footer.jpg") center / cover no-repeat;
```

### 5.5 Menu drawer clip — `assets/videos/menu.mp4` (`--ar 16:10`)

3–5s, silent, looping, **under 2 MB**. Encode hard.

```bash
ffmpeg -i in.mp4 -an -vf "scale=720:-2" -c:v libx264 -crf 30 \
  -pix_fmt yuv420p -movflags +faststart assets/videos/menu.mp4
```

`preload="none"` is deliberate — `ui.js` delays playback 460ms so the fetch and
first decode don't land on top of the drawer opening.

---

## 6. What must never be generated

Not preferences — these carry real risk:

| Never | Why |
|---|---|
| GameStop trade dress, storefronts, red/white branding, the logo | Trademark. Robinsqueeze is explicitly unaffiliated. |
| NVIDIA, Robinhood or any real company's marks | Same. |
| Rockets, moons, arrows, candlestick charts, "to the moon" | Implies a price prediction the protocol expressly disclaims. |
| Crowds, protest imagery, Reddit/WSB references | Implies coordinated trading. Legally the worst thing on this page. |
| Vaults of gold, coins, bullion | Suggests the vault holds value you can claim. It does not. |
| A person depicted as an investor/trader | Invites an "investment advice" reading. |
| Fabricated dashboards, invented numbers, fake charts | Contradicts every honest-state guarantee in the build. |

---

## 7. Budget

| Asset | Ceiling |
|---|---|
| Hero video | 6 MB |
| Hero poster | 300 KB |
| Any still | 400 KB |
| Menu clip | 2 MB |
| Twitter header | 2 MB (Twitter re-encodes anyway) |

```bash
ffmpeg -i in.jpg -q:v 82 out.webp   # ~half the size, visually identical
```

No JS framework ships here — images and video **are** the payload. That's the
trade, and it's worth protecting.

---

## 8. Colour matching

Once the hero lands, sample its dominant mid-green and set `--accent` in
`css/tokens.css` (currently `#00c805`). UI and photography must share a hue or
the art reads as pasted on. This does more than any per-component tweaking.

If the sampled green is much darker than `#00c805`, keep the accent bright and
put the sampled value in `--accent-dim` instead — the accent has to stay
legible as a small UI colour.
