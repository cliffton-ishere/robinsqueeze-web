/* ================================================================
   ui.js — the interactive components.

     - header pill + drawer
     - hero gate (the band between the chevrons)
     - rotating brand slot in the statement
     - FAQ accordion
     - pinned horizontal scrub carousel
   ================================================================ */

(() => {
  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  /* The carousel goes native-swipe on ANY touch device, tablets included:
     scroll-jacking judders badly under touch momentum scrolling. */
  const nativeSwipe = () =>
    window.innerWidth <= 760 || matchMedia("(pointer: coarse)").matches;

  /* ================= Header pill ================= */
  const pill = document.getElementById("pill");
  const toggle = document.getElementById("pill-toggle");
  const scrim = document.getElementById("pill-scrim");

  if (pill && toggle) {
    /* Freeze the page WITHOUT touching overflow. Flipping overflow on the
       scroll container re-resolves every position:sticky on the page, which
       makes the pinned sections jump away the instant the menu opens.
       Swallowing the gestures instead leaves layout completely untouched. */
    const blockScroll = (e) => {
      if (pill.contains(e.target)) return;   // the drawer itself may scroll
      e.preventDefault();
    };
    const lockScroll = (on) => {
      const fn = on ? "addEventListener" : "removeEventListener";
      window[fn]("wheel", blockScroll, { passive: false });
      window[fn]("touchmove", blockScroll, { passive: false });
    };

    const setOpen = (open) => {
      pill.classList.toggle("open", open);
      document.documentElement.classList.toggle("menu-open", open);
      lockScroll(open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");

      const v = pill.querySelector(".panel-media video");
      if (v) {
        clearTimeout(v._playTimer);
        if (open) {
          /* the drawer video is preload="none", so playing it right here
             would start the fetch + first decode on top of the reveal —
             that is the hitch people feel. Hold it until the drawer has
             finished opening. */
          v._playTimer = setTimeout(() => v.play().catch(() => {}), 460);
        } else v.pause();
      }
    };

    toggle.addEventListener("click", () => setOpen(!pill.classList.contains("open")));
    if (scrim) {
      scrim.addEventListener("click", () => setOpen(false));
      // touchstart so it responds immediately rather than waiting out the click delay
      scrim.addEventListener("touchstart", (e) => { e.preventDefault(); setOpen(false); }, { passive: false });
    }
    // the logo and wordmark live in the bar, not the drawer, but they still
    // navigate — so the panel has to retract for them too
    pill.querySelectorAll(".panel-nav a, .panel-meta a, .pill-logo, .pill-name")
      .forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("click", (e) => { if (!pill.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

    // rotating with the menu open leaves iOS holding the pre-rotation panel
    // geometry, so the drawer content ends up outside the pill. Close it.
    addEventListener("orientationchange", () => setOpen(false));
    let lastW = window.innerWidth;
    addEventListener("resize", () => {
      if (window.innerWidth === lastW) return;   // ignore toolbar-height changes
      lastW = window.innerWidth;
      setOpen(false);
    }, { passive: true });
  }

  /* ================= Hero gate =================
     An invisible band spanning the gap between the two chevrons. Hovering
     it pushes them apart and swells the cursor into the labelled disc. */
  const gate = document.getElementById("hero-gate");
  const hero = document.querySelector(".hero");
  if (gate && hero) {
    const label = gate.dataset.cursorLabel || "Coming soon";
    const set = (on) => {
      // never mid-intro: the preloader's chevrons are still landing on the
      // hero's own pair, and pulling them apart there breaks the hand-off
      if (on && !window.__introDone) return;
      hero.classList.toggle("gate-on", on);
      if (window.__cursorGate) window.__cursorGate(on, label);
    };
    gate.addEventListener("mouseenter", () => set(true));
    gate.addEventListener("mouseleave", () => set(false));
    addEventListener("resize", () => set(false), { passive: true });
  }

  /* ================= Rotating brand slot =================
     One name at a time between two small chevrons. The window animates its
     width to whichever name is showing, so the surrounding sentence
     re-flows smoothly instead of snapping. */
  const slot = document.querySelector(".slot-window");
  if (slot) {
    const items = [...slot.querySelectorAll(".slot-item")];
    let i = 0;
    const sizeTo = (el) => {
      // Pin the window to the item's natural width. The window is
      // border-box and carries horizontal padding, so that padding has to
      // be added back or every name sits a few px too tight and the widest
      // one clips.
      const cs = getComputedStyle(slot);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      slot.style.width = Math.ceil(el.getBoundingClientRect().width + pad) + "px";
    };
    const show = (n) => {
      items.forEach((el, k) => el.classList.toggle("on", k === n));
      sizeTo(items[n]);
    };
    // first paint without a glide; fonts settle layout on load
    slot.style.transition = "none";
    show(0);
    requestAnimationFrame(() => (slot.style.transition = ""));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sizeTo(items[i]));

    if (items.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInterval(() => { i = (i + 1) % items.length; show(i); }, 2600);
    }
  }

  /* ================= FAQ accordion ================= */
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-q");
    if (!q) return;
    q.setAttribute("aria-expanded", "false");
    q.addEventListener("click", () => {
      const willOpen = !item.classList.contains("open");
      // single-open: close the others
      document.querySelectorAll(".faq-item.open").forEach((o) => {
        o.classList.remove("open");
        o.querySelector(".faq-q").setAttribute("aria-expanded", "false");
      });
      item.classList.toggle("open", willOpen);
      q.setAttribute("aria-expanded", String(willOpen));
    });
  });

  /* ================= Pinned horizontal scrub =================
     Vertical scroll through the section's scrub room drives the track
     horizontally while the group is stuck. On touch, the track is a plain
     native-swipe overflow container and none of this runs.

     The scrub room is the section's ::after block, declared in CSS. This
     matters: the distance is a layout fact the browser owns, so it stays
     correct through resizes without js recomputing anything. */
  const sec = document.querySelector(".scrub-sec");
  const group = document.querySelector(".scrub-group");
  const track = document.getElementById("scrub-track");
  const tabs = [...document.querySelectorAll(".scrub-tab")];
  const tabsBox = document.querySelector(".scrub-tabs");

  if (sec && group && track && tabs.length) {
    // the sweep happens inside a padded band of the scrub, so tab targets
    // never sit exactly on the pin/release boundary where tabs fade out
    const P_LO = 0.21, P_HI = 0.95;
    let tabLock = -1, touchTabLock = -1, activeI = -1;

    const pillEl = document.createElement("span");
    pillEl.className = "scrub-tab-pill";
    tabsBox.prepend(pillEl);

    const setActive = (i) => {
      if (i === activeI) return;
      activeI = i;
      tabs.forEach((t, j) => t.classList.toggle("active", j === i));
      if (tabs[i]) {
        pillEl.style.transform = `translateX(${tabs[i].offsetLeft - 4}px)`;
        pillEl.style.width = tabs[i].offsetWidth + "px";
      }
    };

    const metrics = () => {
      /* Anchor on the section's BOTTOM edge. The pin's own offsets shift
         once it is stuck, so they cannot be trusted mid-scrub. */
      const room = Math.max(
        1,
        parseFloat(getComputedStyle(sec, "::after").height) || window.innerHeight
      );
      const secBottom = sec.getBoundingClientRect().bottom + window.scrollY;
      return { start: secBottom - room - window.innerHeight, room };
    };

    const measure = () => {
      // centre the sticky group vertically at its rest height
      const gtop = Math.max(0, (window.innerHeight - group.offsetHeight) / 2);
      group.style.setProperty("--gtop", gtop.toFixed(0) + "px");
      if (tabs[activeI]) {
        pillEl.style.transform = `translateX(${tabs[activeI].offsetLeft - 4}px)`;
        pillEl.style.width = tabs[activeI].offsetWidth + "px";
      }
    };

    const update = () => {
      if (nativeSwipe()) return;   // touch swipes natively — no scroll-jack
      const { start, room } = metrics();
      const p = clamp01((window.scrollY - start) / room);
      const q = clamp01((p - P_LO) / (P_HI - P_LO));
      track.scrollLeft = q * (track.scrollWidth - track.clientWidth);
      // tabs fade in as the scrub starts and then STAY — they simply scroll
      // away with the section when it releases
      tabsBox.classList.toggle("show", p > 0.02);

      let i = Math.round(q * (tabs.length - 1));
      if (tabLock >= 0) {
        if (i === tabLock) tabLock = -1;   // the glide arrived — release
        else i = tabLock;                  // hold the clicked tab while gliding
      }
      setActive(i);
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => {
        setActive(i);
        if (nativeSwipe()) {
          // touch: glide the track; the page never moves
          touchTabLock = i;
          const max = track.scrollWidth - track.clientWidth;
          track.scrollTo({ left: (max * i) / (tabs.length - 1), behavior: "smooth" });
          return;
        }
        tabLock = i;
        const { start, room } = metrics();
        const target = P_LO + ((P_HI - P_LO) * i) / (tabs.length - 1);
        window.scrollTo({ top: start + room * target, behavior: "smooth" });
      });
    });

    // any user-initiated scroll cancels a pending glide lock
    ["wheel", "touchmove"].forEach((ev) =>
      window.addEventListener(ev, () => { tabLock = -1; }, { passive: true })
    );
    track.addEventListener("scroll", () => {
      if (!nativeSwipe()) return;
      const max = Math.max(1, track.scrollWidth - track.clientWidth);
      const i = Math.round((track.scrollLeft / max) * (tabs.length - 1));
      if (touchTabLock >= 0) {
        if (i === touchTabLock) touchTabLock = -1;
        else return;   // ignore sync while a tapped glide is in flight
      }
      setActive(i);
    }, { passive: true });
    track.addEventListener("touchstart", () => { touchTabLock = -1; }, { passive: true });

    // hand the hooks to scroll.js so everything runs in the one rAF
    window.__scrubUpdate = update;
    window.__scrubMeasure = measure;

    tabsBox.classList.toggle("show", nativeSwipe());
    measure();
    setActive(0);
  }
})();
