/**
 * protocol.ts — reads, quotes and the routed-buy transaction.
 *
 * The button state machine every transaction surface needs:
 *
 *   disconnected -> wrongNetwork -> notDeployed
 *                                -> needsApproval -> approving
 *                                -> ready -> signing -> pending -> success
 *                                                              -> reverted
 *
 * Two rules that are not negotiable:
 *
 *  1. **The user's minimum is never overridden.** Slippage is theirs to set,
 *     and `minRsqOut` / `minPairOut` are derived from it and passed straight
 *     through. Nothing here silently widens them to make a trade succeed.
 *
 *  2. **Approvals are exact.** `approve(router, amountIn)`, not
 *     `type(uint256).max`. An unlimited approval on a contract that has not
 *     been audited is a standing invitation, and the gas saving is not worth
 *     it. Permit2 is deployed on this chain and is the better long-term
 *     answer, but it is not wired until the router supports it.
 */
import {
  parseAbi,
  formatUnits,
  parseUnits,
  decodeEventLog,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { publicClient, walletClient, getState } from "./wallet.js";
import { CANONICAL, manifest, isDeployed } from "./chain.js";

export type TxPhase =
  | "disconnected"
  | "wrongNetwork"
  | "notDeployed"
  | "enterAmount"
  | "insufficientBalance"
  | "needsApproval"
  | "approving"
  | "ready"
  | "signing"
  | "pending"
  | "success"
  | "reverted";

export interface Quote {
  amountIn: bigint;
  usdgToRsq: bigint;
  usdgToPair: bigint;
  usdgToLiquidity: bigint;
  conserves: boolean;
}

export interface BuyResult {
  hash: Hash;
  rsqOut?: bigint;
  pairAcquired?: bigint;
  status: "success" | "reverted";
}

const ERC20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
]);

const ROUTER = parseAbi([
  "function previewSplit(uint256 amountIn) pure returns (uint256 usdgToRsq, uint256 usdgToPair, uint256 usdgToLiquidity)",
  "function buyExactInput(uint256 amountIn, uint256 minRsqOut, uint256 minPairOut, address recipient, uint256 deadline) returns (uint256 rsqOut, uint256 pairOut)",
  "function paused() view returns (bool)",
  "event PairedBuyExecuted(address indexed buyer, address indexed recipient, uint256 usdgIn, uint256 usdgToRsq, uint256 usdgToPair, uint256 usdgToLiquidity, uint256 rsqOut, uint256 pairAssetAcquired, uint256 timestamp, string routerVersion)",
]);

/* ------------------------------------------------------------- reads */

export async function usdgBalance(owner: Address): Promise<bigint> {
  return publicClient.readContract({
    address: CANONICAL.usdg,
    abi: ERC20,
    functionName: "balanceOf",
    args: [owner],
  });
}

export async function usdgAllowance(owner: Address): Promise<bigint> {
  if (!manifest.router) return 0n;
  return publicClient.readContract({
    address: CANONICAL.usdg,
    abi: ERC20,
    functionName: "allowance",
    args: [owner, manifest.router],
  });
}

/**
 * The allocation preview.
 *
 * Deliberately calls the router's own `previewSplit` rather than doing the
 * basis-point maths in JavaScript. If the two ever disagreed the interface
 * would be lying about what the contract is going to do — so there is only
 * one implementation, and it is the on-chain one.
 */
export async function quote(amountIn: bigint): Promise<Quote> {
  if (!manifest.router) throw new Error("Router not deployed");
  const [usdgToRsq, usdgToPair, usdgToLiquidity] = await publicClient.readContract({
    address: manifest.router,
    abi: ROUTER,
    functionName: "previewSplit",
    args: [amountIn],
  });
  return {
    amountIn,
    usdgToRsq,
    usdgToPair,
    usdgToLiquidity,
    conserves: usdgToRsq + usdgToPair + usdgToLiquidity === amountIn,
  };
}

/** Local mirror of the split, for rendering before a router exists. */
export function previewSplitLocal(amountIn: bigint): Quote {
  const usdgToRsq = (amountIn * 9000n) / 10000n;
  const usdgToPair = (amountIn * 800n) / 10000n;
  const usdgToLiquidity = amountIn - usdgToRsq - usdgToPair;
  return { amountIn, usdgToRsq, usdgToPair, usdgToLiquidity, conserves: true };
}

export async function isPaused(): Promise<boolean> {
  if (!manifest.router) return false;
  try {
    return await publicClient.readContract({ address: manifest.router, abi: ROUTER, functionName: "paused" });
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ writes */

export async function approveExact(amountIn: bigint): Promise<Hash> {
  if (!walletClient || !manifest.router) throw new Error("Not ready");
  const { address } = getState();
  if (!address) throw new Error("No account");
  // Exact amount, never unlimited. See the header note.
  return walletClient.writeContract({
    address: CANONICAL.usdg,
    abi: ERC20,
    functionName: "approve",
    args: [manifest.router, amountIn],
    account: address,
    chain: undefined,
  });
}

export interface BuyParams {
  amountIn: bigint;
  /** Slippage in basis points, e.g. 50 = 0.5%. Supplied by the user. */
  slippageBps: bigint;
  /** Expected outputs used to derive minimums. */
  expectedRsqOut: bigint;
  expectedPairOut: bigint;
  recipient: Address;
  /** Seconds from now. */
  deadlineSeconds?: bigint;
}

/**
 * Derives minimum outputs from the user's slippage.
 * Exported so the UI can display the exact figures that will be signed —
 * "minimum received" must be the number in the transaction, not an estimate.
 */
export function minimums(p: BuyParams): { minRsqOut: bigint; minPairOut: bigint } {
  const keep = 10000n - p.slippageBps;
  return {
    minRsqOut: (p.expectedRsqOut * keep) / 10000n,
    minPairOut: (p.expectedPairOut * keep) / 10000n,
  };
}

export async function buy(p: BuyParams): Promise<Hash> {
  if (!walletClient || !manifest.router) throw new Error("Not ready");
  const { address } = getState();
  if (!address) throw new Error("No account");

  const { minRsqOut, minPairOut } = minimums(p);
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + (p.deadlineSeconds ?? 600n);

  // Simulate first. This surfaces a revert reason BEFORE the wallet opens,
  // so the user is never asked to sign something that cannot succeed.
  const { request } = await publicClient.simulateContract({
    address: manifest.router,
    abi: ROUTER,
    functionName: "buyExactInput",
    args: [p.amountIn, minRsqOut, minPairOut, p.recipient, deadline],
    account: address,
  });

  return walletClient.writeContract(request);
}

/**
 * Waits for a receipt and decodes the real amounts out of the event.
 *
 * The decoded values are what actually happened, not what was estimated. The
 * UI shows these, so a trade that filled at the edge of tolerance reports the
 * truth rather than the projection.
 */
export async function waitForBuy(hash: Hash): Promise<BuyResult> {
  const receipt: TransactionReceipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") return { hash, status: "reverted" };

  for (const log of receipt.logs) {
    if (manifest.router && log.address.toLowerCase() !== manifest.router.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: ROUTER, data: log.data, topics: log.topics });
      if (decoded.eventName === "PairedBuyExecuted") {
        const a = decoded.args as unknown as { rsqOut: bigint; pairAssetAcquired: bigint };
        return { hash, status: "success", rsqOut: a.rsqOut, pairAcquired: a.pairAssetAcquired };
      }
    } catch {
      // not our event; keep looking
    }
  }
  return { hash, status: "success" };
}

/* ----------------------------------------------------------- helpers */

export const fmtUsdg = (v: bigint) => formatUnits(v, CANONICAL.usdgDecimals);
export const fmt18 = (v: bigint) => formatUnits(v, 18);
export const parseUsdg = (v: string) => parseUnits(v, CANONICAL.usdgDecimals);

/** Resolves the button phase from current state. */
export async function resolvePhase(amountIn: bigint): Promise<TxPhase> {
  const { status, address } = getState();
  if (status === "disconnected" || !address) return "disconnected";
  if (status === "wrongNetwork") return "wrongNetwork";
  if (!isDeployed()) return "notDeployed";
  if (amountIn <= 0n) return "enterAmount";

  const [balance, allowance] = await Promise.all([usdgBalance(address), usdgAllowance(address)]);
  if (balance < amountIn) return "insufficientBalance";
  if (allowance < amountIn) return "needsApproval";
  return "ready";
}

export const PHASE_LABEL: Record<TxPhase, string> = {
  disconnected: "Connect wallet",
  wrongNetwork: "Switch to Robinhood Chain",
  notDeployed: "Launching soon",
  enterAmount: "Enter an amount",
  insufficientBalance: "Insufficient USDG",
  needsApproval: "Approve USDG",
  approving: "Approving…",
  ready: "Buy RSQ",
  signing: "Confirm in wallet…",
  pending: "Transaction pending…",
  success: "Done",
  reverted: "Transaction reverted",
};
