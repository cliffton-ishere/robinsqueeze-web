/* ================================================================
   intro.js — the load sequence.

   The trick worth stealing: the hero's chevrons are ALREADY sitting at
   their final position, hidden behind the preloader's dark cover. The
   preloader's own chevrons animate until they land on exactly the same
   coordinates (both read --hero-span and --bracket-h from tokens.css),
   and then the cover simply wipes away. Nothing "transitions into" the
   hero — there is no hand-off to get wrong, because the two marks are
   already congruent when the cover leaves.

   Timeline (ms):
        0   folded diamond, dark cover, 0%
      500   .spin    chevrons rotate upright
     1500   .unfold  they spread to the hero span; the name reveals
     4300   .swipe   cover wipes right-to-left; hero lines start rising
     4720   .gone    preloader removed, scroll unlocked

   The hold between 1500 and 4300 is deliberate: it is when a hero video
   buffers. If you ship a static hero image you can cut SWIPE_AT to
   ~2600 and the whole thing still reads.

   The intro plays ONCE per visitor. A year-long cookie remembers it, so
   a returning visitor lands straight on the hero. Clearing cookies (or
   a fresh browser) brings it back — which is how you demo it.
   ================================================================ */

(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // always begin at the top, whatever the browser remembers
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const SWIPE_AT = 4300;
  const GONE_AT = 4720;
  const SEEN_KEY = "rsq_intro_seen";

  const pre = document.getElementById("preloader");
  const heroMedia = document.querySelector("video.hero-media");

  const startHero = () => {
    window.__introDone = true;
    if (heroMedia) heroMedia.play().catch(() => {});
    document.dispatchEvent(new CustomEvent("intro:done"));
  };

  const introSeen = document.cookie
    .split("; ")
    .some((c) => c.startsWith(SEEN_KEY + "="));

  if (!pre) { startHero(); return; }

  if (reduceMotion || introSeen) {
    pre.classList.add("gone");
    document.documentElement.classList.remove("lock");
    startHero();
    return;
  }

  document.cookie = SEEN_KEY + "=1; max-age=31536000; path=/; SameSite=Lax";
  document.documentElement.classList.add("lock");

  // ---------- The percentage ----------
  // Honest-ish: it counts real elapsed time against the known hold, so it
  // always reaches 100% exactly as the cover leaves. A loader that stalls
  // at 94% and then jumps is worse than one that is simply a clock.
  const pctNum = document.getElementById("pre-num");
  const t0 = performance.now();
  const tick = () => {
    if (pre.classList.contains("swipe")) return;
    const p = Math.min(100, Math.round(((performance.now() - t0) / SWIPE_AT) * 100));
    if (pctNum) pctNum.textContent = p + "%";
    if (p < 100) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  setTimeout(() => pre.classList.add("spin"), 500);
  setTimeout(() => pre.classList.add("unfold"), 1500);
  setTimeout(() => {
    if (pctNum) pctNum.textContent = "100%";
    pre.classList.add("swipe");
    startHero();
  }, SWIPE_AT);
  setTimeout(() => {
    pre.classList.add("gone");
    document.documentElement.classList.remove("lock");
  }, GONE_AT);
})();
