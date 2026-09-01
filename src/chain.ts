/**
 * chain.ts — Robinhood Chain definition and the deployment manifest.
 *
 * Every address here was verified on-chain (docs/FINDINGS.md). Protocol
 * addresses come from the generated manifest and are `undefined` until
 * `script/Deploy.s.sol` has run — which is what drives the "Not deployed"
 * states rather than a placeholder address that looks real.
 */
import { defineChain, type Address } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

/**
 * Params for `wallet_addEthereumChain`, for wallets that don't know this chain.
 * @dev Deliberately NOT `as const`: the EIP-1193 type wants mutable string
 *      arrays, and a readonly literal fails to assign.
 */
export const ADD_CHAIN_PARAMS: {
  chainId: `0x${string}`;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
} = {
  chainId: `0x${ROBINHOOD_CHAIN_ID.toString(16)}`, // 0x1237
  chainName: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
};

/** Canonical, verified assets. Present whether or not the protocol is deployed. */
export const CANONICAL = {
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address,
  /** SIX decimals. Never assume 18. */
  usdgDecimals: 6,
  pairAsset: "0x1b0E319c6A659F002271B69dB8A7df2F911c153E" as Address,
  pairSymbol: "GME",
  pairDecimals: 18,
  factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA" as Address,
  /** GME/USDG fee-500. NOTE: GME is token0 here, unlike the NVDA pool. */
  pairPool: "0xE2b46c905E12Ab8E2f864e4821a4325884C1B126" as Address,
} as const;

export interface Manifest {
  rsq?: Address;
  rsqPool?: Address;
  router?: Address;
  pairVault?: Address;
  liquidityManager?: Address;
  lens?: Address;
  deployedAtBlock?: number;
}

/**
 * Protocol addresses.
 *
 * Empty until deployment. The UI reads `isDeployed()` and renders honest
 * states; it must never fall back to a plausible-looking address.
 */
export const manifest: Manifest = {};

export function isDeployed(): boolean {
  return Boolean(manifest.router && manifest.lens);
}

/**
 * Loads /deployments.json if it has been published alongside the site.
 * A 404 is the normal pre-launch case and is not an error.
 */
export async function loadManifest(): Promise<boolean> {
  try {
    const res = await fetch("/deployments.json", { cache: "no-store" });
    if (!res.ok) return false;
    Object.assign(manifest, await res.json());
    return isDeployed();
  } catch {
    return false;
  }
}

export const explorer = {
  tx: (hash: string) => `${robinhoodChain.blockExplorers.default.url}/tx/${hash}`,
  address: (a: string) => `${robinhoodChain.blockExplorers.default.url}/address/${a}`,
};
