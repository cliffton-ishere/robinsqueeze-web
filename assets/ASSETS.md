# Robinsqueeze — art direction & Midjourney brief

Everything ships with CSS gradient placeholders so the build looks right
before art exists. This is what replaces them.

---

## 1. The visual thesis

**Contained pressure.** Not explosion — *containment*. Something enormous is
being held, and the holding is what you can see. A reservoir behind a dam. A
sealed door. Fog packed against a ridge line. The tension is in the restraint,
never in the release.

This matters legally as much as aesthetically: the protocol makes no claim that
anything will "pop". The imagery must never promise a squeeze. Held, not
launching.

The lineage is **hyperreal pastoral / corporate surrealism** — the Windows XP
*Bliss* bloodline: impossibly saturated landscape, one clean man-made object
placed where it doesn't belong, midday clarity, nobody around. Robinsqueeze
shifts that palette from blue to **deep green**, and adds weight.

### Three composition rules, non-negotiable

1. **Centre stays clear.** The two wedges frame the middle of the hero and the
   headline sits across it. Put your subject small and central, or off to one
   third — never filling the frame.
2. **Horizon at 58–62% down.** It matches the placeholder gradient and keeps
   both headline lines in open space. Give me a real horizon line, not a
   vignette.
3. **No text, no logos, no signage.** Ever. All type is live HTML.

---

## 2. The style spine

Append this to *every* prompt. It is what makes eight separate generations look
like one photographer's afternoon.

```
shot on Hasselblad X2D, 38mm, f/8, deep depth of field, natural midday light
with a slight overcast diffusion, cool green colour grade, muted highlights,
rich shadow detail, fine 35mm grain, subtle atmospheric haze receding to the
horizon, no people, no text, no signage, photographic realism
--style raw --chaos 8 --ar <SLOT> --v 7
```

**Why each part earns its place**

| Fragment | What it buys you |
|---|---|
| `Hasselblad X2D, 38mm` | Medium-format look, wide but not distorted. Stops MJ defaulting to a cinematic 24mm bulge. |
| `f/8, deep depth of field` | Kills the shallow-focus bokeh MJ loves. Landscape needs everything sharp. |
| `slight overcast diffusion` | Prevents blown highlights, which is what makes AI landscapes look fake. |
| `cool green colour grade` | Locks the palette to `--accent`. |
| `fine 35mm grain` | Pre-matches the site's CSS grain overlay so the two don't fight. |
| `atmospheric haze receding` | Gives real depth cues; the single biggest "this is a photograph" tell. |
| `--style raw` | Turns off Midjourney's default beautification. Essential. |
| `--chaos 8` | Low. You want four near-identical variations to pick from, not four ideas. |

### Locking consistency across the set

1. Generate the **hero first**. Iterate until it's right.
2. Upscale it, copy its URL.
3. Add `--sref <that-url> --sw 80` to every subsequent prompt.

`--sw 80` is the sweet spot — strong enough to carry grade and grain, loose
enough that composition still responds to your prompt. If later images come out
too samey, drop to `--sw 50`.

### Negative prompt

Append to everything:

```
--no text, watermark, logo, signage, people, crowds, rockets, moon, arrows,
charts, graphs, stock tickers, neon, cyberpunk, lens flare, tilt-shift,
oversaturation, HDR halo, fisheye, vignette
```

`rockets, moon, arrows, charts` are excluded on purpose — that visual language
implies a price prediction the protocol explicitly does not make.

---

## 3. Slot-by-slot

### 3.1 Hero — `assets/videos/hero.mp4` · `--ar 16:9`

The single most important asset. Three directions; generate all three, pick by
how the headline sits on it.

**A — The reservoir (recommended).** Most on-theme: visible containment.

```
An immense still reservoir held behind a monumental concrete dam, water level
impossibly high and glass-flat, dark green forested hills falling away on both
sides, thin mist sitting on the surface, viewed head-on from a low distance so
the dam crest cuts a clean horizontal line across the lower third
```

**B — The held fog.** Quieter, more abstract, ages well.

```
A vast sea of dense white cloud pressed against a long green ridge line, the
cloud held back as if by an invisible wall, one dark treeline cresting above it,
early morning, absolute stillness
```

**C — The lone door.** Surreal, closest to the Bliss lineage.

```
A single closed steel door standing upright and alone in the centre of an
endless bright green meadow, no frame, no building, casting one long shadow,
vast empty sky above
```

**Then animate it.** A still works; the drift is most of the magic. Run the
upscale through MJ's animate, Runway Gen-3, or Kling with:

> *very slow forward push, 6 seconds, seamless loop, no camera shake, no zoom
> punch, subtle water/cloud movement only*

Encode:

```bash
ffmpeg -i in.mp4 -an -vf "scale=1920:-2,fps=30" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart assets/videos/hero.mp4
```

`-an` strips audio (it can never play). `-pix_fmt yuv420p` is required or Safari
shows a black frame. Keep it **under 6 MB** — the intro holds ~2.8s to buffer.

Also export frame 1 as `assets/images/hero-poster.jpg` (1920×1080, q82). It's
what slow connections and `prefers-reduced-motion` users see.

Then in `index.html` swap the placeholder `<div class="hero-media">` for:

```html
<video class="hero-media" muted loop playsinline preload="auto"
       poster="assets/images/hero-poster.jpg">
  <source src="assets/videos/hero.mp4" type="video/mp4">
</video>
```

### 3.2 Vault — `assets/images/vault.jpg` · `--ar 16:9`

Sits beside "GME goes in. Nothing comes out." Must feel **sealed**, not secure —
no bank imagery, no gold, no crypto clichés.

```
A single monolithic steel door set flush into a smooth concrete wall in an
empty green field, no handle, no hinges, no markings, overcast sky, the wall
extending beyond frame on both sides, cold grey against saturated green
```

### 3.3 Carousel cards ×4 — `assets/images/card-1…4.jpg` · `--ar 4:3`

A gradient scrim and text cover the **bottom third**, so keep that area simple —
water, grass, sky, road surface. No detail there.

Vary the vantage so the set has rhythm — one aerial, one ground-level, one
interior, one looking up:

```
1  Aerial directly above a narrow service road cutting through dense green
   forest, single pale line through the canopy, morning haze

2  Ground level at the foot of a concrete spillway, wet surface, green algae
   at the waterline, looking up the slope

3  Interior of an empty concrete pump house, one shaft of daylight from a high
   window, green light reflecting off standing water on the floor

4  Looking straight up through tall green canopy into an overcast bright sky,
   symmetrical, calm
```

### 3.4 Footer underlay — `assets/images/footer.jpg` · `--ar 16:9`

Seen through the contracting page, behind the giant white wordmark. Needs a
**calm mid-tone centre** or the wordmark disappears into it.

```
Wide aerial over rolling deep green hills at first light, long soft shadows,
low mist collecting in the valleys, no landmarks, no roads, gentle horizon
high in the frame
```

Then in `css/app.css`, replace `.underlay`'s gradient with:

```css
background: url("../assets/images/footer.jpg") center / cover no-repeat;
```

### 3.5 Menu drawer clip — `assets/videos/menu.mp4` · `--ar 16:10`

3–5s, silent, looping, **under 2 MB**. It's small and behind a drawer, so
encode hard (`-crf 30`). Slow water movement is ideal.

```bash
ffmpeg -i in.mp4 -an -vf "scale=720:-2" -c:v libx264 -crf 30 -pix_fmt yuv420p -movflags +faststart assets/videos/menu.mp4
```

Add inside `.panel-media`:

```html
<video muted loop playsinline preload="none"><source src="assets/videos/menu.mp4" type="video/mp4"></video>
```

`preload="none"` is deliberate — `ui.js` delays playback 460ms so the fetch and
first decode don't land on top of the drawer opening.

### 3.6 Share image — `assets/og-banner.jpg` · 2400×1260

Use the hero still, cropped wide, with the wordmark composited in **afterwards**
in a real editor. Don't ask Midjourney for text.

---

## 4. What must never be generated

Not stylistic preferences — these carry real risk:

| Never | Why |
|---|---|
| GameStop trade dress, storefronts, red/white branding, the logo | Trademark. Robinsqueeze is explicitly unaffiliated. |
| NVIDIA, Robinhood or any real company's marks | Same. |
| Rockets, moons, arrows, candlestick charts, "to the moon" language | Implies a price prediction the protocol expressly disclaims. |
| Crowds, protest imagery, Reddit/WSB visual references | Implies coordinated trading. Legally the worst thing on this page. |
| Vaults full of gold, coins, bullion | Suggests the vault holds value you can claim. It doesn't. |
| Anything depicting a person as an investor/trader | Invites "investment advice" reading. |

---

## 5. Budget & optimisation

```bash
# stills → WebP at q82 is visually identical and roughly half the size
ffmpeg -i in.jpg -q:v 82 out.webp
```

| Asset | Ceiling |
|---|---|
| Hero video | 6 MB |
| Hero poster | 300 KB |
| Any still | 400 KB |
| Menu clip | 2 MB |

The site has no JS framework — images and video **are** the entire payload.
That's the trade, and it's worth protecting.

---

## 6. Colour matching

Once the hero lands, sample its dominant mid-green and set `--accent` in
`css/tokens.css` to it (currently `#00c805`). The UI and the photography must
share a hue or the art reads as pasted on. This single step does more than any
amount of per-component tweaking.

If the sampled green is much darker than `#00c805`, keep the accent bright and
set `--accent-dim` to the sampled value instead — the accent needs to stay
legible as a small UI colour.
