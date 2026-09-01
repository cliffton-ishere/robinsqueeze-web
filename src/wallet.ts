/**
 * wallet.ts — wallet connection, without a framework.
 *
 * The site is deliberately dependency-free at runtime, so this is viem plus a
 * hand-rolled connector rather than wagmi + React. Pulling a React tree in to
 * render one button would have meant rebuilding the page, and the brief's
 * first rule is not to disturb the design.
 *
 * Discovery uses **EIP-6963**, not `window.ethereum`. With several wallets
 * installed they fight over that single global and last-loaded wins, so a user
 * with both Robinhood Wallet and MetaMask gets whichever injected last rather
 * than the one they chose. EIP-6963 has each wallet announce itself, so we can
 * list them all and let the user pick. `window.ethereum` remains a fallback
 * for wallets that have not adopted it.
 *
 * NOTHING HERE PROMPTS ON PAGE LOAD. Discovery is passive, and the only
 * eth_accounts call is the silent one that restores an already-granted
 * session. A signature is never requested until the user asks for an action.
 */
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
  type WalletClient,
  type PublicClient,
} from "viem";
import { robinhoodChain, ROBINHOOD_CHAIN_ID, ADD_CHAIN_PARAMS } from "./chain.js";

export interface WalletInfo {
  uuid: string;
  name: string;
  icon: string;
  provider: EIP1193Provider;
}

export type WalletStatus =
  | "disconnected"
  | "connecting"
  | "wrongNetwork"
  | "connected";

export interface WalletState {
  status: WalletStatus;
  address?: Address;
  chainId?: number;
  wallet?: WalletInfo;
  error?: string;
}

const discovered = new Map<string, WalletInfo>();
let state: WalletState = { status: "disconnected" };
const listeners = new Set<(s: WalletState) => void>();

export const publicClient: PublicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(),
});
export let walletClient: WalletClient | undefined;

/* ------------------------------------------------------------- state */

function set(next: Partial<WalletState>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn(state);
}

export function getState(): WalletState {
  return state;
}

export function subscribe(fn: (s: WalletState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function availableWallets(): WalletInfo[] {
  return [...discovered.values()];
}

/* --------------------------------------------------------- discovery */

/**
 * Passive EIP-6963 discovery. Announcing wallets are recorded; nothing is
 * requested from them. Safe to run at load.
 */
export function startDiscovery() {
  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const e = event as CustomEvent<{ info: { uuid: string; name: string; icon: string }; provider: EIP1193Provider }>;
    const { info, provider } = e.detail;
    if (!discovered.has(info.uuid)) {
      discovered.set(info.uuid, { uuid: info.uuid, name: info.name, icon: info.icon, provider });
      set({}); // notify: the wallet list changed
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  // Legacy fallback for wallets that have not adopted EIP-6963.
  const legacy = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (legacy && discovered.size === 0) {
    discovered.set("legacy", { uuid: "legacy", name: "Injected Wallet", icon: "", provider: legacy });
  }
}

/* -------------------------------------------------------- connection */

/**
 * Restores a session the user has already granted, WITHOUT prompting.
 *
 * `eth_accounts` returns the already-authorised accounts and never opens the
 * wallet. `eth_requestAccounts` is the one that prompts, and it is only ever
 * called from {connect}, i.e. from a click.
 */
export async function restoreSession() {
  for (const w of discovered.values()) {
    try {
      const accounts = (await w.provider.request({ method: "eth_accounts" })) as Address[];
      if (accounts?.length) {
        await attach(w, accounts[0]);
        return;
      }
    } catch {
      // wallet declined to answer; try the next one
    }
  }
}

export async function connect(wallet: WalletInfo) {
  set({ status: "connecting", error: undefined });
  try {
    const accounts = (await wallet.provider.request({ method: "eth_requestAccounts" })) as Address[];
    if (!accounts?.length) throw new Error("No account returned");
    await attach(wallet, accounts[0]);
  } catch (err) {
    set({ status: "disconnected", error: friendlyError(err) });
  }
}

async function attach(wallet: WalletInfo, address: Address) {
  walletClient = createWalletClient({ account: address, chain: robinhoodChain, transport: custom(wallet.provider) });

  const chainIdHex = (await wallet.provider.request({ method: "eth_chainId" })) as string;
  const chainId = Number(chainIdHex);

  bindEvents(wallet);

  set({
    status: chainId === ROBINHOOD_CHAIN_ID ? "connected" : "wrongNetwork",
    address,
    chainId,
    wallet,
    error: undefined,
  });
}

const bound = new WeakSet<EIP1193Provider>();

function bindEvents(wallet: WalletInfo) {
  if (bound.has(wallet.provider)) return;
  bound.add(wallet.provider);

  // Switching accounts in the wallet must be reflected immediately; an
  // interface showing a stale address is how people send to the wrong place.
  wallet.provider.on?.("accountsChanged", (accounts: Address[]) => {
    if (!accounts?.length) {
      disconnect();
      return;
    }
    walletClient = createWalletClient({
      account: accounts[0],
      chain: robinhoodChain,
      transport: custom(wallet.provider),
    });
    set({ address: accounts[0] });
  });

  wallet.provider.on?.("chainChanged", (hex: string) => {
    const chainId = Number(hex);
    set({ chainId, status: chainId === ROBINHOOD_CHAIN_ID ? "connected" : "wrongNetwork" });
  });

  wallet.provider.on?.("disconnect", () => disconnect());
}

export function disconnect() {
  walletClient = undefined;
  set({ status: "disconnected", address: undefined, chainId: undefined, wallet: undefined, error: undefined });
}

/**
 * Asks the wallet to switch to Robinhood Chain, adding it first if unknown.
 *
 * 4902 is the "unrecognised chain" code. Some wallets return it nested under
 * `error.data`, so both shapes are checked — missing that is why "add chain"
 * silently fails in a lot of dapps.
 */
export async function switchToRobinhoodChain(): Promise<boolean> {
  const w = state.wallet;
  if (!w) return false;
  try {
    await w.provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ADD_CHAIN_PARAMS.chainId }],
    });
    return true;
  } catch (err) {
    const code = (err as { code?: number; data?: { originalError?: { code?: number } } })?.code;
    const nested = (err as { data?: { originalError?: { code?: number } } })?.data?.originalError?.code;
    if (code === 4902 || nested === 4902) {
      try {
        await w.provider.request({ method: "wallet_addEthereumChain", params: [ADD_CHAIN_PARAMS] });
        return true;
      } catch (addErr) {
        set({ error: friendlyError(addErr) });
        return false;
      }
    }
    set({ error: friendlyError(err) });
    return false;
  }
}

/* ------------------------------------------------------------ helpers */

/** Turns provider errors into something a person can act on. */
export function friendlyError(err: unknown): string {
  const e = err as { code?: number; shortMessage?: string; message?: string };
  // 4001 is the user rejecting. It is not a failure and must not read like one.
  if (e?.code === 4001) return "Request cancelled";
  if (e?.code === -32002) return "Check your wallet: a request is already open";
  const msg = e?.shortMessage ?? e?.message ?? String(err);
  if (/user rejected|user denied/i.test(msg)) return "Request cancelled";
  if (/insufficient funds/i.test(msg)) return "Not enough ETH for gas";
  return msg.length > 120 ? msg.slice(0, 117) + "..." : msg;
}

export function shortAddress(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}
