/* ================================================================
   live.js — live on-chain reads for the stat tiles.

   WHY THIS IS NOT viem. These reads run for every visitor on page load,
   and js/wallet.js is 77 KB brotli. Making everyone download a
   transaction library to display a multiplier would undo the point of
   lazy-loading it. So this file speaks raw JSON-RPC over fetch, with
   hand-encoded calldata: zero dependencies, ~4 KB, no build step.

   Selectors are computed at build time with `cast sig` and pinned below
   with their signatures, so nobody has to trust a magic hex string.

   THE RULE THIS FILE EXISTS TO ENFORCE: every figure is either read from
   the chain right now, or it says why it isn't. There are no fallback
   numbers. If the RPC fails, the tile shows a state pill — never a stale
   value, and never a zero dressed up as data.
   ================================================================ */

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = 4663;

/* Verified on-chain; see docs/FINDINGS.md */
const GME = "0x1b0E319c6A659F002271B69dB8A7df2F911c153E";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
/* GME/USDG fee-500. NOTE: GME is token0 here, the opposite of the NVDA pool. */
const POOL = "0xE2b46c905E12Ab8E2f864e4821a4325884C1B126";

const SEL = {
  uiMultiplier: "0xa60bf13d", // uiMultiplier()
  slot0: "0x3850c7bd", // slot0()
  balanceOf: "0x70a08231", // balanceOf(address)
  liquidity: "0x1a686502", // liquidity()
  pairAssetBalance: "0x39e67ef8", // pairAssetBalance()
  cumulativeAcquired: "0x85e12765", // cumulativePairAssetAcquired()
  routedBuyCount: "0x8aacb4cd", // routedBuyCount()
  paused: "0x5c975abb", // paused()
};

const pad = (addr) => addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");

/** One batched JSON-RPC round trip. */
async function rpcBatch(calls) {
  const body = calls.map((c, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: c.method ?? "eth_call",
    params: c.params ?? [{ to: c.to, data: c.data }, "latest"],
  }));
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  const out = new Array(calls.length);
  for (const r of Array.isArray(json) ? json : [json]) {
    out[r.id] = r.error ? null : r.result;
  }
  return out;
}

const toBig = (hex) => (hex && hex !== "0x" ? BigInt(hex) : null);

/**
 * Formats a raw integer with `decimals` places, thousands-separated.
 * @param trim strip trailing zeros. TRUE for money, FALSE for values whose
 *        precision is the point — a corporate-action multiplier must read
 *        "1.000000", not "1", or it looks like a rounded guess.
 */
function fmt(raw, decimals, maxFrac = 2, trim = true) {
  if (raw === null || raw === undefined) return null;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  let frac = (raw % base).toString().padStart(decimals, "0").slice(0, maxFrac);
  if (trim) frac = frac.replace(/0+$/, "");
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${w}.${frac}` : w;
}

/**
 * GME price in USDG from the pool's sqrtPriceX96.
 *
 * token0 = GME (18dp), token1 = USDG (6dp), so
 *   price_raw = (sqrtP / 2^96)^2  = USDG_raw per GME_raw
 *   USDG per GME = price_raw * 10^18 / 10^6
 * Computed entirely in BigInt — a float would lose the low digits.
 * Returned scaled by 1e6 so it can share the USDG formatter.
 */
function priceFromSqrt(sqrtPriceX96) {
  if (!sqrtPriceX96 || sqrtPriceX96 === 0n) return null;
  return (sqrtPriceX96 * sqrtPriceX96 * 10n ** 18n) / (1n << 192n);
}

/* -------------------------------------------------------------- reads */

async function readCanonical() {
  const [blockHex, multHex, slot0Hex, poolGmeHex, poolUsdgHex, liqHex] = await rpcBatch([
    { method: "eth_blockNumber", params: [] },
    { to: GME, data: SEL.uiMultiplier },
    { to: POOL, data: SEL.slot0 },
    { to: GME, data: SEL.balanceOf + pad(POOL) },
    { to: USDG, data: SEL.balanceOf + pad(POOL) },
    { to: POOL, data: SEL.liquidity },
  ]);

  // slot0 returns a tuple; sqrtPriceX96 is the first 32-byte word.
  const sqrtPriceX96 = slot0Hex && slot0Hex.length >= 66 ? BigInt(slot0Hex.slice(0, 66)) : null;

  return {
    block: toBig(blockHex),
    multiplier: toBig(multHex),
    sqrtPriceX96,
    gmePriceUsdg: priceFromSqrt(sqrtPriceX96),
    poolGme: toBig(poolGmeHex),
    poolUsdg: toBig(poolUsdgHex),
    poolLiquidity: toBig(liqHex),
  };
}

async function readProtocol(manifest) {
  if (!manifest?.pairVault || !manifest?.router) return null;
  const [balHex, cumHex, countHex, pausedHex] = await rpcBatch([
    { to: manifest.pairVault, data: SEL.pairAssetBalance },
    { to: manifest.pairVault, data: SEL.cumulativeAcquired },
    { to: manifest.router, data: SEL.routedBuyCount },
    { to: manifest.router, data: SEL.paused },
  ]);
  return {
    vaultBalance: toBig(balHex),
    cumulativeAcquired: toBig(cumHex),
    routedBuyCount: toBig(countHex),
    paused: toBig(pausedHex) === 1n,
  };
}

/* -------------------------------------------------------------- paint */

const setHTML = (id, html) => {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
};
const state = (text, kind = "") => `<span class="state ${kind}">${text}</span>`;

function paintCanonical(d) {
  // Multiplier: 1e18 == 1.0 == no corporate action in effect.
  if (d.multiplier !== null) {
    const m = fmt(d.multiplier, 18, 6, false); // keep the trailing zeros
    setHTML(
      "live-multiplier",
      `${m}${d.multiplier === 10n ** 18n ? '<span class="sub" style="margin-left:8px">no corporate action</span>' : ""}`
    );
  } else {
    setHTML("live-multiplier", state("Unavailable", "is-warn"));
  }

  if (d.gmePriceUsdg !== null) {
    setHTML("live-gme-price", `$${fmt(d.gmePriceUsdg, 6, 2)}`);
  } else {
    setHTML("live-gme-price", state("Pool unavailable"));
  }

  if (d.poolUsdg !== null && d.poolGme !== null) {
    setHTML(
      "live-pool-depth",
      `${fmt(d.poolUsdg, 6, 0)} USDG <span class="sub">+ ${fmt(d.poolGme, 18, 2)} GME</span>`
    );
    const inline = document.getElementById("live-pool-depth-inline");
    if (inline) inline.textContent = `${fmt(d.poolUsdg, 6, 0)} USDG`;
  } else {
    setHTML("live-pool-depth", state("Pool unavailable"));
  }

  const blockEl = document.getElementById("live-block");
  if (blockEl) {
    blockEl.textContent = d.block !== null ? `block ${d.block.toString()}` : "";
  }
}

function paintProtocolMissing() {
  // No manifest: the protocol genuinely is not deployed. Say exactly that.
  setHTML("live-vault-balance", state("Not deployed"));
  setHTML("live-cumulative", state("Not deployed"));
  setHTML("live-settlement", state("Not deployed"));
  setHTML("live-rsq", state("Not deployed"));
  setHTML("live-router", state("Not deployed"));
  setHTML("live-rsq-market", state("Pool unavailable"));
}

function paintProtocol(p) {
  if (p.routedBuyCount === 0n) {
    setHTML("live-vault-balance", state("Awaiting first routed buy"));
    setHTML("live-cumulative", state("Awaiting first routed buy"));
    return;
  }
  setHTML("live-vault-balance", `${fmt(p.vaultBalance, 18, 4)} GME`);
  setHTML("live-cumulative", `${fmt(p.cumulativeAcquired, 18, 4)} GME`);
  if (p.paused) setHTML("live-router", state("Trading temporarily paused", "is-warn"));
}

function paintFailure(err) {
  // A failed read must never leave the previous number on screen — that is
  // how a page ends up confidently displaying yesterday's data.
  for (const id of ["live-multiplier", "live-gme-price", "live-pool-depth"]) {
    setHTML(id, state("Network unavailable", "is-warn"));
  }
  const blockEl = document.getElementById("live-block");
  if (blockEl) blockEl.textContent = "";
  console.warn("[live] read failed:", err?.message ?? err);
}

/* --------------------------------------------------------------- boot */

let manifest = null;

async function loadManifest() {
  try {
    const res = await fetch("/deployments.json", { cache: "no-store" });
    if (!res.ok) return null;
    const m = await res.json();
    return m?.chainId === CHAIN_ID ? m : null;
  } catch {
    return null;
  }
}

async function refresh() {
  try {
    const canonical = await readCanonical();
    paintCanonical(canonical);

    const p = await readProtocol(manifest);
    if (p) paintProtocol(p);
    else paintProtocolMissing();
  } catch (err) {
    paintFailure(err);
  }
}

async function boot() {
  // Mark every live slot as loading, so nothing shows an empty box.
  for (const el of document.querySelectorAll("[data-live]")) {
    if (!el.innerHTML.trim()) el.innerHTML = state("Loading…");
  }
  manifest = await loadManifest();
  await refresh();

  // Refresh while the tab is visible. Polling a hidden tab wastes the
  // user's battery and the RPC's rate limit for a page nobody is reading.
  let timer = setInterval(() => {
    if (!document.hidden) void refresh();
  }, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  window.addEventListener("pagehide", () => clearInterval(timer));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void boot());
} else {
  void boot();
}
