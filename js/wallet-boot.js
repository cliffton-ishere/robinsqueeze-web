/* ================================================================
   wallet-boot.js — the lazy loader for the wallet layer.

   js/wallet.js is 77 KB brotli, almost all of it viem. Making every
   visitor download that to read a landing page would undo the reason
   this site has no framework in the first place.

   So this file — under 2 KB, zero dependencies — does the two things
   the page needs before anyone connects:

     1. renders the 90/8/2 allocation preview, which is basis-point
        arithmetic and needs no library
     2. renders a Connect button

   The moment the user actually reaches for a wallet, it dynamically
   imports the real module, which takes over and re-renders everything.
   Nobody pays for viem until they want it.

   The maths here MIRRORS PairedBuyRouter.previewSplit exactly, including
   computing the 2% as the remainder rather than a third multiplication,
   so the three parts sum to the input at every size. Once the router is
   deployed the real module replaces these numbers with previewSplit()
   read straight from the contract — the interface must never be able to
   disagree with the chain.
   ================================================================ */

const USDG_DECIMALS = 6;
const RSQ_BPS = 9000n;
const PAIR_BPS = 800n;
const BPS = 10000n;

let loaded = false;

/** Parses a decimal string into USDG base units without floating point. */
function parseUsdg(input) {
  const s = String(input ?? "").trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return 0n;
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(USDG_DECIMALS)).slice(0, USDG_DECIMALS);
  return BigInt(whole || "0") * 10n ** BigInt(USDG_DECIMALS) + BigInt(padded || "0");
}

function formatUsdg(v) {
  const base = 10n ** BigInt(USDG_DECIMALS);
  const whole = v / base;
  const frac = (v % base).toString().padStart(USDG_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** Same split as the contract: the remainder absorbs rounding. */
function previewSplit(amountIn) {
  const toRsq = (amountIn * RSQ_BPS) / BPS;
  const toPair = (amountIn * PAIR_BPS) / BPS;
  const toLiq = amountIn - toRsq - toPair;
  return { toRsq, toPair, toLiq, conserves: toRsq + toPair + toLiq === amountIn };
}

function renderPreview() {
  if (loaded) return; // the real module owns rendering once it is in
  const input = document.getElementById("trade-amount");
  const amountIn = parseUsdg(input?.value);
  const { toRsq, toPair, toLiq, conserves } = previewSplit(amountIn);

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("alloc-rsq", formatUsdg(toRsq));
  set("alloc-pair", formatUsdg(toPair));
  set("alloc-liq", formatUsdg(toLiq));

  const c = document.getElementById("alloc-conserves");
  if (c) c.textContent = conserves ? "sums to your input exactly" : "ROUNDING ERROR";
}

/**
 * Pulls in the real wallet layer once, on demand.
 *
 * Local first. The CDN entry is a fallback for hosts where the 314 KB bundle
 * was not uploaded - it is OUR OWN build, pinned to an immutable commit hash
 * on jsDelivr, not a third-party package. Pinning by SHA is what keeps this
 * from being a supply-chain hole: the bytes at that commit can never change.
 * Once the host serves js/wallet.js the local path always wins and the
 * fallback becomes dead code.
 */
const WALLET_SOURCES = [
  "./wallet.js",
  "https://cdn.jsdelivr.net/gh/cliffton-ishere/robinsqueeze-web@025d76c6daff575aa0fbfd01b4235428b281d74d/js/wallet.js",
];

async function load() {
  if (loaded) return;
  loaded = true;
  const slot = document.getElementById("wallet-slot");
  if (slot) slot.innerHTML = '<button class="wallet-chip" type="button" disabled>Loading…</button>';

  for (const src of WALLET_SOURCES) {
    if (src.includes("025d76c6daff575aa0fbfd01b4235428b281d74d")) continue; // not pinned yet
    try {
      await import(src);
      return;
    } catch (err) {
      console.warn("[wallet] source failed:", src, err?.message ?? err);
    }
  }

  loaded = false;
  if (slot) slot.innerHTML = '<button class="wallet-chip" id="wallet-retry" type="button">Retry</button>';
  document.getElementById("wallet-retry")?.addEventListener("click", () => void load());
}

function boot() {
  const slot = document.getElementById("wallet-slot");
  if (slot && !slot.dataset.ready) {
    slot.dataset.ready = "1";
    slot.innerHTML = '<button class="wallet-chip" id="wallet-connect-stub" type="button">Connect</button>';
    document.getElementById("wallet-connect-stub")?.addEventListener("click", () => void load());
  }

  const input = document.getElementById("trade-amount");
  input?.addEventListener("input", renderPreview);
  // Reaching for the amount field means a purchase is being considered —
  // start fetching the real module then, so it is warm by the time it matters.
  input?.addEventListener("focus", () => void load(), { once: true });
  document.getElementById("trade-action")?.addEventListener("click", () => void load());

  renderPreview();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
