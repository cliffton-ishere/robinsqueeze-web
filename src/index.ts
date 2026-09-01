/**
 * index.ts — binds the wallet + protocol layer to the existing DOM.
 *
 * This file adds behaviour to markup that already exists. It creates no new
 * layout and introduces no new visual language: the connect control lives in
 * the header pill, and the trade panel reuses `.stat`, `.state`, `.btn` and
 * `.alloc-*` exactly as the rest of the page does.
 */
import { formatUnits } from "viem";
import {
  startDiscovery,
  restoreSession,
  connect,
  disconnect,
  subscribe,
  getState,
  availableWallets,
  switchToRobinhoodChain,
  shortAddress,
  friendlyError,
  type WalletInfo,
} from "./wallet.js";
import { loadManifest, isDeployed, CANONICAL, explorer, ROBINHOOD_CHAIN_ID } from "./chain.js";
import {
  previewSplitLocal,
  quote,
  resolvePhase,
  approveExact,
  buy,
  waitForBuy,
  minimums,
  usdgBalance,
  parseUsdg,
  fmtUsdg,
  fmt18,
  PHASE_LABEL,
  type TxPhase,
} from "./protocol.js";
import { publicClient } from "./wallet.js";

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;

/* ------------------------------------------------------ connect button */

function renderConnect() {
  const host = $("#wallet-slot");
  if (!host) return;
  const s = getState();

  if (s.status === "connected" || s.status === "wrongNetwork") {
    const wrong = s.status === "wrongNetwork";
    host.innerHTML = `
      <button class="wallet-chip${wrong ? " is-wrong" : ""}" id="wallet-chip" type="button">
        <span class="wallet-dot"></span>
        <span>${wrong ? "Wrong network" : shortAddress(s.address)}</span>
      </button>`;
    $("#wallet-chip")?.addEventListener("click", async () => {
      if (wrong) await switchToRobinhoodChain();
      else disconnect();
    });
    return;
  }

  const wallets = availableWallets();
  if (s.status === "connecting") {
    host.innerHTML = `<button class="wallet-chip" type="button" disabled><span class="wallet-dot"></span>Connecting…</button>`;
    return;
  }
  if (wallets.length === 0) {
    host.innerHTML = `<a class="wallet-chip" href="https://robinhood.com/wallet" target="_blank" rel="noopener">Get a wallet</a>`;
    return;
  }

  host.innerHTML = `<button class="wallet-chip" id="wallet-connect" type="button">Connect</button>`;
  $("#wallet-connect")?.addEventListener("click", () => openWalletPicker(wallets));
}

/** Wallet chooser. Needed because EIP-6963 can surface several at once. */
function openWalletPicker(wallets: WalletInfo[]) {
  if (wallets.length === 1) {
    void connect(wallets[0]);
    return;
  }
  const existing = $("#wallet-picker");
  existing?.remove();

  const el = document.createElement("div");
  el.id = "wallet-picker";
  el.className = "wallet-picker";
  el.innerHTML = `
    <div class="wallet-picker-card" role="dialog" aria-label="Choose a wallet">
      <h3>Choose a wallet</h3>
      <div class="wallet-list">
        ${wallets
          .map(
            (w) =>
              `<button class="wallet-option" data-uuid="${w.uuid}" type="button">
                 ${w.icon ? `<img src="${w.icon}" alt="" width="24" height="24">` : `<span class="wallet-dot"></span>`}
                 <span>${w.name}</span>
               </button>`
          )
          .join("")}
      </div>
      <button class="wallet-picker-close" type="button" aria-label="Close">Cancel</button>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener("click", (e) => {
    if (e.target === el) el.remove();
  });
  el.querySelector(".wallet-picker-close")?.addEventListener("click", () => el.remove());
  el.querySelectorAll<HTMLButtonElement>(".wallet-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const w = wallets.find((x) => x.uuid === btn.dataset.uuid);
      el.remove();
      if (w) void connect(w);
    });
  });
}

/* ---------------------------------------------------------- trade panel */

let phase: TxPhase = "disconnected";
let lastHash: string | undefined;

async function refreshPanel() {
  const panel = $("#trade");
  if (!panel) return;

  const amountEl = $<HTMLInputElement>("#trade-amount");
  const raw = amountEl?.value?.trim() ?? "";
  let amountIn = 0n;
  try {
    amountIn = raw ? parseUsdg(raw) : 0n;
  } catch {
    amountIn = 0n;
  }

  // Allocation preview. Uses the router when it exists so the page can never
  // disagree with the contract; falls back to the local mirror before launch.
  const q = isDeployed() && amountIn > 0n ? await quote(amountIn).catch(() => previewSplitLocal(amountIn)) : previewSplitLocal(amountIn);

  const setText = (sel: string, v: string) => {
    const el = $(sel);
    if (el) el.textContent = v;
  };
  setText("#alloc-rsq", fmtUsdg(q.usdgToRsq));
  setText("#alloc-pair", fmtUsdg(q.usdgToPair));
  setText("#alloc-liq", fmtUsdg(q.usdgToLiquidity));

  const conserveEl = $("#alloc-conserves");
  if (conserveEl) {
    conserveEl.textContent = q.conserves ? "sums to your input exactly" : "ROUNDING ERROR";
    conserveEl.className = q.conserves ? "sub" : "sub is-danger";
  }

  // Balance
  const s = getState();
  const balEl = $("#trade-balance");
  if (balEl) {
    if (s.address) {
      try {
        balEl.textContent = `${fmtUsdg(await usdgBalance(s.address))} USDG`;
      } catch {
        balEl.innerHTML = `<span class="state">Balance unavailable</span>`;
      }
    } else {
      balEl.textContent = "0.00";
    }
  }

  // Minimum received, from the user's own slippage. Shown because it is the
  // number that will be signed, not an estimate of it.
  const slippage = BigInt($<HTMLInputElement>("#trade-slippage")?.value ?? "50");
  const minEl = $("#trade-minimum");
  if (minEl) {
    minEl.textContent = isDeployed()
      ? `${slippage / 100n}.${(slippage % 100n).toString().padStart(2, "0")}% max slippage`
      : "available at launch";
  }

  if (!["approving", "signing", "pending"].includes(phase)) {
    phase = await resolvePhase(amountIn);
  }
  paintButton();
}

function paintButton() {
  const btn = $<HTMLButtonElement>("#trade-action");
  if (!btn) return;
  btn.textContent = PHASE_LABEL[phase];
  btn.disabled = ["notDeployed", "enterAmount", "insufficientBalance", "approving", "signing", "pending"].includes(phase);
  btn.dataset.phase = phase;

  const note = $("#trade-note");
  if (!note) return;
  if (phase === "success" && lastHash) {
    note.innerHTML = `<a class="addr" href="${explorer.tx(lastHash)}" target="_blank" rel="noopener">View transaction ↗</a>`;
  } else if (phase === "reverted" && lastHash) {
    note.innerHTML = `<span class="state is-danger">Reverted</span> <a class="addr" href="${explorer.tx(lastHash)}" target="_blank" rel="noopener">View ↗</a>`;
  } else if (phase === "notDeployed") {
    note.innerHTML = `<span class="state">Launching soon. Nothing to sign yet, and no address to send funds to.</span>`;
  } else {
    note.textContent = "";
  }
}

async function onAction() {
  const s = getState();
  const note = $("#trade-note");
  const fail = (msg: string) => {
    if (note) note.innerHTML = `<span class="state is-warn">${msg}</span>`;
  };

  try {
    if (phase === "disconnected") return openWalletPicker(availableWallets());
    if (phase === "wrongNetwork") {
      await switchToRobinhoodChain();
      return refreshPanel();
    }

    const amountIn = parseUsdg($<HTMLInputElement>("#trade-amount")?.value ?? "0");

    if (phase === "needsApproval") {
      phase = "approving";
      paintButton();
      const hash = await approveExact(amountIn);
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      return refreshPanel();
    }

    if (phase === "ready" && s.address) {
      const q = await quote(amountIn);
      // Expected outputs would come from a quoter; pre-launch these are zero,
      // which makes the minimums zero. That is only acceptable because the
      // router is not deployed — a live build must supply real expectations
      // or the user has no slippage protection at all.
      const params = {
        amountIn,
        slippageBps: BigInt($<HTMLInputElement>("#trade-slippage")?.value ?? "50"),
        expectedRsqOut: 0n,
        expectedPairOut: 0n,
        recipient: s.address,
      };
      const mins = minimums(params);
      if (mins.minRsqOut === 0n || mins.minPairOut === 0n) {
        return fail("No quote available. Refusing to submit without slippage protection.");
      }

      phase = "signing";
      paintButton();
      const hash = await buy(params);
      lastHash = hash;
      phase = "pending";
      paintButton();

      const result = await waitForBuy(hash);
      phase = result.status === "success" ? "success" : "reverted";
      if (result.status === "success" && note) {
        note.innerHTML =
          `<span class="state is-live">Received ${fmt18(result.rsqOut ?? 0n)} RSQ · ` +
          `vault acquired ${fmt18(result.pairAcquired ?? 0n)} ${CANONICAL.pairSymbol}</span> ` +
          `<a class="addr" href="${explorer.tx(hash)}" target="_blank" rel="noopener">View ↗</a>`;
      }
      paintButton();
      void q;
    }
  } catch (err) {
    phase = "ready";
    fail(friendlyError(err));
    paintButton();
  }
}

/* ----------------------------------------------------------------- boot */

async function boot() {
  startDiscovery();
  await loadManifest();

  subscribe(() => {
    renderConnect();
    void refreshPanel();
  });

  // Passive: restores an already-authorised session without prompting.
  await restoreSession();

  $("#trade-amount")?.addEventListener("input", () => void refreshPanel());
  $("#trade-slippage")?.addEventListener("change", () => void refreshPanel());
  $("#trade-action")?.addEventListener("click", () => void onAction());

  const chainEl = $("#chain-label");
  if (chainEl) chainEl.textContent = `Robinhood Chain · ${ROBINHOOD_CHAIN_ID}`;

  void refreshPanel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void boot());
} else {
  void boot();
}

export { formatUnits };
