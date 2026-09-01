/* ================================================================
   scroll.js — every scroll-driven effect on the page.

   THE RULE: there is exactly ONE scroll listener, it is passive, and it
   does nothing but schedule a single rAF that runs every updater in
   order. Attaching a listener per effect is how these pages turn to mud
   — you end up with six handlers all reading getBoundingClientRect and
   forcing six separate layout flushes per frame.

   Effects here:
     - hero tuck        the hero media shrinks into a rounded card
     - curtain reveal   a sticky title held at centre; a panel rises over it
     - scroll rail      the dash indicator on the right edge
     - page contraction the white page squeezes to reveal the footer underlay
     - reveal on scroll IntersectionObserver, not scroll maths
     - video gating     videos only play while they are on screen
   ================================================================ */

(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  const isMobile = () => window.innerWidth <= 760;

  /* ---------- Reveal on scroll ----------
     IntersectionObserver, and unobserve on first hit. Never recompute a
     reveal that has already happened. */
  const revealer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        revealer.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
  );
  document.querySelectorAll("[data-reveal], [data-reveal-stagger]").forEach((el) => {
    revealer.observe(el);
    // index the children so the CSS stagger delay has something to read
    if (el.hasAttribute("data-reveal-stagger")) {
      [...el.children].forEach((c, i) => c.style.setProperty("--i", i));
    }
  });

  /* ---------- Play videos only while visible ---------- */
  const player = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target;
        // the hero video stays paused until the intro reveals it
        if (v.classList.contains("hero-media") && !window.__introDone) continue;
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      }
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll("video").forEach((v) => player.observe(v));

  /* ---------- Hero tuck ----------
     Drives a single custom property. All the geometry — inset, size,
     radius, the foot row fading — is expressed in CSS off --p, so this
     function only ever writes one string per frame. */
  const hero = document.getElementById("hero");
  const heroUpdate = () => {
    if (!hero) return;
    if (reduceMotion || isMobile()) { hero.style.setProperty("--p", "0"); return; }
    const p = clamp01(window.scrollY / (window.innerHeight * 0.6));
    hero.style.setProperty("--p", p.toFixed(4));
  };

  /* ---------- Curtain reveal ----------
     While .curtain-pin is stuck, the section's scroll room maps to two
     phases: the title slides to the optical centre, then a panel rises
     from below the fold and settles over it.

     Resting offsets are MEASURED (with the scroll-driven transforms
     zeroed first), never assumed — that is what makes it survive a font
     swap or a copy change. */
  const cSec = document.querySelector(".curtain-sec");
  const cPin = document.querySelector(".curtain-pin");
  const cTitle = document.querySelector(".curtain-title");
  const cPanel = document.querySelector(".curtain-panel");
  let titleShift = 0;

  const curtainMeasure = () => {
    if (!cPin || !cTitle) return;
    cTitle.style.setProperty("--ty", "0px");
    const pinTop = cPin.getBoundingClientRect().top;
    const t = cTitle.getBoundingClientRect();
    // how far the title must travel to sit at the optical centre of the pin
    titleShift = (window.innerHeight - t.height) / 2 - (t.top - pinTop);
  };

  const curtainUpdate = () => {
    if (!cSec || !cPin || !cTitle) return;
    if (reduceMotion || isMobile()) {
      cTitle.style.setProperty("--ty", "0px");
      if (cPanel) cPanel.style.setProperty("--cy", "0px");
      return;
    }
    const rect = cSec.getBoundingClientRect();
    const room = Math.max(1, cSec.offsetHeight - window.innerHeight);
    const p = clamp01(-rect.top / room);

    // phase 1 (0 -> 0.4): centre the title
    const a = clamp01(p / 0.4);
    cTitle.style.setProperty("--ty", (titleShift * a).toFixed(1) + "px");

    // phase 2 (0.35 -> 0.85): the panel rises from below the fold
    if (cPanel) {
      const b = clamp01((p - 0.35) / 0.5);
      // ease-out so it decelerates into place rather than arriving flat
      const eased = 1 - Math.pow(1 - b, 3);
      cPanel.style.setProperty("--cy", ((1 - eased) * 62).toFixed(2) + "vh");
      cPanel.style.opacity = (0.25 + eased * 0.75).toFixed(3);
    }
  };

  /* ---------- Scroll rail ----------
     One dash per [data-rail] section, labelled from the attribute. */
  const rail = document.getElementById("rail");
  const railSections = document.querySelectorAll("[data-rail]");
  const dashes = [];
  if (rail) {
    railSections.forEach((s) => {
      const dash = document.createElement("i");
      dash.title = s.dataset.rail;
      rail.appendChild(dash);
      dashes.push(dash);
    });
  }
  const railUpdate = () => {
    if (!dashes.length) return;
    const mid = window.innerHeight * 0.5;
    let active = 0;
    railSections.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= mid) active = i;
    });
    dashes.forEach((d, i) => d.classList.toggle("on", i === active));
  };

  /* ---------- Page contracts at the footer ----------
     The white page clips inward from both sides and rounds off, sliding
     up to reveal a fixed underlay behind it. Triggered off the PAGE's
     bottom edge — the underlay is position:fixed so its own rect can
     never drive this.

     The underlay is only made visible when it is actually near, or a
     rubber-band overscroll at the top of the document would flash the
     footer art behind the hero. */
  const page = document.getElementById("page");
  const underlay = document.querySelector(".underlay");
  const pageUpdate = () => {
    if (!page || !underlay) return;
    const pb = page.getBoundingClientRect().bottom;
    const p = clamp01((window.innerHeight - pb) / (window.innerHeight * 0.55));

    if (p > 0 && !isMobile() && !reduceMotion) {
      const x = (p * 20).toFixed(2);
      const rad = (p * 28).toFixed(2);
      page.style.clipPath = `inset(0 ${x}px 0 round 0 0 ${rad}px ${rad}px)`;
      // pad the content in by the same amount, so it is squeezed, not cropped
      page.style.setProperty("--sq", `${x}px`);
    } else {
      page.style.clipPath = "none";
      page.style.setProperty("--sq", "0px");
    }
    underlay.classList.toggle("near", pb < window.innerHeight * 1.5);
  };

  /* ---------- The one scroll handler ---------- */
  let rafId = 0;
  const flush = () => {
    rafId = 0;
    heroUpdate();
    curtainUpdate();
    railUpdate();
    pageUpdate();
    if (typeof window.__scrubUpdate === "function") window.__scrubUpdate();
  };
  const onScroll = () => {
    /* Coalesce to one frame. Storing the id rather than a boolean flag
       matters: requestAnimationFrame is SUSPENDED whenever the page is not
       being painted (a background tab, a hidden webview, an offscreen
       iframe). A plain `ticking = true` that is only cleared inside the
       callback latches on for as long as that lasts. Holding the id lets
       us cancel and re-drive it from visibilitychange below. */
    if (rafId) return;
    rafId = requestAnimationFrame(flush);
  };

  /* Coming back to a backgrounded tab: rAF resumes, but the page has been
     scrolled with every update suspended, so it is showing stale state.
     Cancel whatever is queued and re-sync immediately. */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    flush();
  });

  const onResize = () => {
    curtainMeasure();
    if (typeof window.__scrubMeasure === "function") window.__scrubMeasure();
    onScroll();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  // fonts settle layout after first paint — re-measure once they land
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  window.addEventListener("load", onResize);

  curtainMeasure();
  onScroll();

  /* ---------- In-page anchors: smooth scroll, no #hash in the URL ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();   // also swallows placeholder href="#" links
      const id = a.getAttribute("href").slice(1);
      if (!id) return;
      if (id === "top") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      const el = document.getElementById(id);
      if (!el) return;
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY,
        behavior: "smooth",
      });
    });
  });
})();
