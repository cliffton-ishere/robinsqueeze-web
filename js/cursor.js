/* ================================================================
   cursor.js — the inverting circle cursor.

   Why it feels the way it does, in four parts:

   1. INVERSION. The disc is plain white with `mix-blend-mode:
      difference`. Over white it computes to black, over black to
      white, over a photo to that photo's inverse. One element, always
      legible, zero per-section theming. The blend has to live on the
      element that gets the transform — wrap it in another transformed
      div and the stacking context isolates and the blend dies.

   2. EASING. The disc lerps toward the pointer at 0.3 per frame, so it
      trails very slightly. That lag is the whole personality: it reads
      as weight.

   3. VELOCITY SWELL. Shaking the mouse puffs the disc up. Attack is
      fast (0.25) and decay is slow (0.08), so it inflates instantly
      and settles lazily — the asymmetry is what makes it feel physical
      rather than linear.

   4. THE SNAP. When the pointer crosses into a new hoverable, the disc
      is teleported to the pointer instead of easing. Without this, the
      disc is still painted over the OLD surface while the new one has
      already started inverting under :hover, and it visibly sweeps
      black -> white -> black as it glides in. The snap is only ever the
      distance travelled in the last frame or two, so nobody sees it.

   Configure via the CONFIG block. Mark extra hover targets with
   [data-cursor="grow"], and label targets with [data-cursor-label].
   ================================================================ */

(() => {
  // fine pointers only — touch has no cursor to replace
  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const CONFIG = {
    ease: 0.3,          // lerp per frame toward the pointer
    attack: 0.25,       // how fast velocity ramps up
    decay: 0.08,        // how slowly it falls back
    swellFloor: 6,      // px/frame of movement before swelling starts
    swellDivisor: 35,   // higher = needs more speed for the same swell
    swellCap: 1.5,      // max extra scale in normal state
    swellCapGate: 0.1,  // 2.5x of a 14px dot is playful; of a 136px disc it
                        // would fill a third of the screen. Clamp it hard.
  };

  // anything that should grow the disc
  const HOVERABLE =
    'a, button, input, textarea, select, label, [role="button"], [data-cursor="grow"]';

  const cur = document.createElement("div");
  cur.className = "cursor-dot";
  cur.setAttribute("aria-hidden", "true");
  cur.appendChild(document.createElement("i"));
  document.body.appendChild(cur);
  document.documentElement.classList.add("has-cursor-dot");

  // The label layer is a SIBLING, not a child. White text inside a
  // difference-blended white disc composites to the same white and comes
  // out invisible. It gets handed the identical transform each frame.
  const tag = document.createElement("div");
  tag.className = "cursor-tag";
  tag.setAttribute("aria-hidden", "true");
  tag.innerHTML =
    '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="6" y1="18" x2="18" y2="6"/><polyline points="9 6 18 6 18 15"/></svg>' +
    '<em class="cursor-label" style="font-style:normal"></em></span>';
  document.body.appendChild(tag);
  const labelEl = tag.querySelector(".cursor-label");

  /** Swell the disc into the big labelled state. */
  const setGate = (on, label) => {
    if (on && label) labelEl.textContent = label;
    cur.classList.toggle("gate", on);
    tag.classList.toggle("gate", on);
  };
  // exposed so page code (e.g. the hero gate) can drive it
  window.__cursorGate = setGate;

  // ---------- Declarative label targets ----------
  // <a data-cursor-label="Coming soon"> gets the big disc automatically.
  // Elements marked [data-cursor-managed] are skipped: their own code drives
  // the gate (the hero gate, for one, must not swell mid-intro) and binding
  // here too would race that guard.
  document.querySelectorAll("[data-cursor-label]:not([data-cursor-managed])").forEach((el) => {
    el.addEventListener("mouseenter", () => setGate(true, el.dataset.cursorLabel));
    el.addEventListener("mouseleave", () => setGate(false));
  });
  // a resize can hide a target out from under the pointer, and mouseleave
  // never fires for an element that simply stops being displayed
  addEventListener("resize", () => setGate(false), { passive: true });

  let tx = -100, ty = -100;   // target — the real pointer
  let cx = -100, cy = -100;   // eased — where the disc actually is
  let hoverT = null;

  document.addEventListener(
    "mousemove",
    (e) => {
      tx = e.clientX;
      ty = e.clientY;

      // first move: place it, don't fly it in from the corner
      if (!cur.classList.contains("on")) {
        cx = tx; cy = ty;
        cur.classList.add("on");
      }

      const t = e.target instanceof Element ? e.target.closest(HOVERABLE) : null;
      if (t !== hoverT) {
        hoverT = t;
        cx = tx; cy = ty;   // the snap — see note 4 in the header
      }
      cur.classList.toggle("grow", !!t);
    },
    { passive: true }
  );

  document.documentElement.addEventListener("mouseleave", () =>
    cur.classList.remove("on")
  );

  // ---------- The follow loop ----------
  let ptx = tx, pty = ty, vel = 0;
  const follow = () => {
    cx += (tx - cx) * CONFIG.ease;
    cy += (ty - cy) * CONFIG.ease;

    const speed = Math.hypot(tx - ptx, ty - pty);   // px this frame
    ptx = tx; pty = ty;
    // asymmetric smoothing: snap up, drift down
    vel += (speed - vel) * (speed > vel ? CONFIG.attack : CONFIG.decay);

    const cap = cur.classList.contains("gate") ? CONFIG.swellCapGate : CONFIG.swellCap;
    const swell =
      1 + Math.min(Math.max(0, vel - CONFIG.swellFloor) / CONFIG.swellDivisor, cap);

    const tf =
      "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0) scale(" +
      swell.toFixed(3) + ")";
    cur.style.transform = tf;
    tag.style.transform = tf;   // the label rides the disc exactly

    requestAnimationFrame(follow);
  };
  follow();
})();
