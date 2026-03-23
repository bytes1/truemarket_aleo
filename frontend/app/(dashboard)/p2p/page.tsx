"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import {
  AlertCircle,
  Copy,
  Eye,
  Loader2,
  Mail,
  RefreshCw,
  Share2,
  Wallet,
} from "lucide-react";
import { BetModeSwitch } from "@/components/BetModeSwitch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { p2pMarkets } from "@/lib/p2p-data";
import { cn } from "@/lib/utils";

const TOKEN_PROGRAM_ID = "test_usdcx_stablecoin.aleo";
const P2P_PROGRAM_ID =
  process.env.NEXT_PUBLIC_P2P_PROGRAM_ID ?? "true_private_p2p_v2.aleo";
const P2P_ADAPTER_ADDRESS =
  process.env.NEXT_PUBLIC_P2P_ADAPTER_ADDRESS ?? "p2p_usdcx_adapter_v2.aleo";
const API_URL = "https://api.explorer.provable.com/v1/testnet/program";
const TOKEN_DECIMALS = 6;

type ActionMode = "create" | "accept";
type Outcome = "yes" | "no";

type WalletRecord = {
  spent?: boolean;
  recordName?: string;
  recordCiphertext?: string;
  programName?: string;
  commitment?: string;
  blockHeight?: number;
  blockTimestamp?: number;
  transactionIndex?: number;
  transitionIndex?: number;
  outputIndex?: number;
};

type MarketState = {
  exists: boolean;
  creator: string;
  closesAt: number;
  isResolved: boolean;
  winningOutcome: number;
  matchedCount: number;
  volume: bigint;
};

type BetView = {
  key: string;
  marketId: string;
  outcomeValue: number;
  stake: bigint;
  counterparty: string;
  recordInput: string | null;
};

type OfferCommitmentView = {
  offerId: string;
  marketId: number;
  stake: bigint;
  isOpen: boolean;
};

type InvitePayload = {
  version: 1;
  offerId: string;
  maker: string;
  outcome: string;
  salt: string;
};

function parseTypedInt(raw: string): bigint {
  const match = raw.match(/\d+/)?.[0];
  return match ? BigInt(match) : 0n;
}

function parseUnits(value: string, decimals = TOKEN_DECIMALS): bigint {
  if (!value) return 0n;
  const normalized = value.trim();
  if (!normalized) return 0n;
  const [wholeRaw, fracRaw = ""] = normalized.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const fraction = fracRaw.slice(0, decimals).padEnd(decimals, "0");
  if (!/^\d+$/.test(whole) || !/^\d+$/.test(fraction)) return 0n;
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction);
}

function formatUnits(value: bigint, decimals = TOKEN_DECIMALS, precision = 4) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, precision)
    .replace(/0+$/, "");
  return `${whole.toString()}${fractionStr ? `.${fractionStr}` : ""}`;
}

function formatDisplayUsd(value: bigint) {
  return formatUnits(value, TOKEN_DECIMALS, 2);
}

function formatCompactUsd(value: bigint) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(Number(value) / 10 ** TOKEN_DECIMALS);
}

function maskAddress(value: string) {
  if (!value) return "";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function getStringField(value: string, key: string) {
  const match = value.match(new RegExp(`${key}\\s*:\\s*([^,}\\n]+)`));
  return match?.[1]?.trim();
}

function getObjectField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  try {
    const field = Reflect.get(value, key);
    return field === undefined || field === null ? undefined : String(field);
  } catch {
    return undefined;
  }
}

function getField(value: unknown, key: string) {
  const objectField = getObjectField(value, key);
  if (objectField) return objectField;
  if (typeof value === "string") return getStringField(value, key);
  return undefined;
}

function getRecordKey(record: WalletRecord) {
  return (
    record.commitment ||
    `${record.blockHeight ?? 0}-${record.transactionIndex ?? 0}-${record.transitionIndex ?? 0}-${record.outputIndex ?? 0}`
  );
}

function unwrapWalletRecordResponse(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const records = Reflect.get(value, "records");
    if (Array.isArray(records)) return records;
  }
  return [];
}

function isWalletRecordArray(value: unknown): value is WalletRecord[] {
  return Array.isArray(value);
}

async function fetchMappingValue(programId: string, mapping: string, key: string) {
  const response = await fetch(
    `${API_URL}/${programId}/mapping/${mapping}/${encodeURIComponent(key)}`
  );
  if (!response.ok) return null;
  const text = await response.text();
  return !text || text === "null" ? null : text;
}

function parseMarketState(text: string | null): MarketState {
  if (!text) {
    return {
      exists: false,
      creator: "",
      closesAt: 0,
      isResolved: false,
      winningOutcome: 2,
      matchedCount: 0,
      volume: 0n,
    };
  }

  return {
    exists: true,
    creator: text.match(/creator:\s*([a-z0-9]+)/i)?.[1] ?? "",
    closesAt: Number(text.match(/closes_at:\s*(\d+)/)?.[1] ?? 0),
    isResolved: (text.match(/is_resolved:\s*(true|false)/)?.[1] ?? "false") === "true",
    winningOutcome: Number(text.match(/winning_outcome:\s*(\d+)/)?.[1] ?? 2),
    matchedCount: Number(text.match(/matched_count:\s*(\d+)/)?.[1] ?? 0),
    volume: BigInt(text.match(/volume:\s*(\d+)/)?.[1] ?? "0"),
  };
}

function buildBetInput(decrypted: unknown) {
  const owner = getField(decrypted, "owner");
  const marketId = getField(decrypted, "market_id");
  const outcome = getField(decrypted, "outcome");
  const stake = getField(decrypted, "stake");
  const counterparty = getField(decrypted, "counterparty");
  const nonce = getField(decrypted, "_nonce");
  const version = getField(decrypted, "_version");
  if (!owner || !marketId || !outcome || !stake || !counterparty || !nonce || !version) return null;
  return `{ owner: ${owner}, market_id: ${marketId}, outcome: ${outcome}, stake: ${stake}, counterparty: ${counterparty}, _nonce: ${nonce}, _version: ${version} }`;
}

function parseOfferCommitment(
  text: string | null,
  offerId: string
): OfferCommitmentView | null {
  if (!text) return null;

  return {
    offerId,
    marketId: Number(text.match(/market_id:\s*(\d+)/)?.[1] ?? 0),
    stake: BigInt(text.match(/stake:\s*(\d+)/)?.[1] ?? "0"),
    isOpen: (text.match(/is_open:\s*(true|false)/)?.[1] ?? "false") === "true",
  };
}

function createRandomField() {
  const values = crypto.getRandomValues(new Uint32Array(4));
  let result = 0n;
  for (const value of values) {
    result = (result << 32n) + BigInt(value);
  }
  return `${result}field`;
}

function createOfferId(marketId: number) {
  const timePart = BigInt(Date.now());
  const randomPart = BigInt(crypto.getRandomValues(new Uint32Array(1))[0]);
  return `${timePart * 10000000000n + BigInt(marketId) * 100000n + randomPart}field`;
}

function parseInvitePayload(value: string): InvitePayload | null {
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    const parsed = JSON.parse(normalized) as Partial<InvitePayload>;
    if (
      parsed.version !== 1 ||
      typeof parsed.offerId !== "string" ||
      typeof parsed.maker !== "string" ||
      typeof parsed.outcome !== "string" ||
      typeof parsed.salt !== "string"
    ) {
      return null;
    }
    return parsed as InvitePayload;
  } catch {
    return null;
  }
}

function buildInviteShareText(
  invite: InvitePayload,
  marketTitle: string,
  outcomeLabel: string,
  stake: bigint
) {
  return [
    `True Markets P2P invite`,
    `Market: ${marketTitle}`,
    `Side: ${outcomeLabel}`,
    `Stake: ${formatUnits(stake, TOKEN_DECIMALS, 4)} USDCx`,
    "",
    "Paste this private invite into the P2P Accept Invite box:",
    JSON.stringify(invite),
  ].join("\n");
}

export default function P2PPage() {
  const wallet = useWallet() as ReturnType<typeof useWallet> & {
    requestRecords?: (programId: string, filterSpent?: boolean) => Promise<unknown>;
    decrypt?: (ciphertext: string) => Promise<unknown>;
  };
  const { connected, address, executeTransaction } = wallet;
  const requestRecords = wallet.requestRecords;
  const decrypt = wallet.decrypt;

  const [mounted, setMounted] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState(p2pMarkets[0].market_id);
  const [actionMode, setActionMode] = useState<ActionMode>("create");
  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [stakeStr, setStakeStr] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [latestInvite, setLatestInvite] = useState<InvitePayload | null>(null);
  const [latestInviteOffer, setLatestInviteOffer] = useState<OfferCommitmentView | null>(null);
  const [inviteOffer, setInviteOffer] = useState<OfferCommitmentView | null>(null);
  const [balanceAtomic, setBalanceAtomic] = useState(0n);
  const [balanceValue, setBalanceValue] = useState("0.00");
  const [marketStates, setMarketStates] = useState<Record<number, MarketState>>({});
  const [records, setRecords] = useState<WalletRecord[]>([]);
  const [bets, setBets] = useState<Record<string, BetView>>({});
  const [status, setStatus] = useState("");
  const [recordMessage, setRecordMessage] = useState(
    "This contract version settles from invite details and offer state, not wallet records."
  );
  const [decryptingKey, setDecryptingKey] = useState<string | null>(null);
  const [isRefreshingMarkets, setIsRefreshingMarkets] = useState(false);
  const [isRefreshingRecords, setIsRefreshingRecords] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedMarket =
    p2pMarkets.find((market) => market.market_id === selectedMarketId) ?? p2pMarkets[0];
  const selectedState = marketStates[selectedMarketId] ?? parseMarketState(null);
  const selectedOutcomeValue = outcome === "yes" ? 0 : 1;
  const atomicStake = parseUnits(stakeStr);
  const invitePreview = useMemo(() => parseInvitePayload(inviteInput), [inviteInput]);
  const currentBets = useMemo(
    () =>
      Object.values(bets).filter(
        (bet) => bet.marketId === String(selectedMarket.market_id)
      ),
    [bets, selectedMarket.market_id]
  );
  const latestInviteShareText = useMemo(() => {
    if (!latestInvite || !latestInviteOffer) return "";
    const outcomeLabel =
      latestInvite.outcome === "0u8"
        ? selectedMarket.outcome_a
        : selectedMarket.outcome_b;
    return buildInviteShareText(
      latestInvite,
      selectedMarket.market_title,
      outcomeLabel,
      latestInviteOffer.stake
    );
  }, [latestInvite, latestInviteOffer, selectedMarket]);
  const canCreateOffer =
    connected &&
    !isProcessing &&
    selectedState.exists &&
    !selectedState.isResolved &&
    atomicStake > 0n;
  const canAcceptInvite =
    connected &&
    !isProcessing &&
    !!invitePreview &&
    !!inviteOffer &&
    inviteOffer.isOpen &&
    inviteOffer.marketId === selectedMarket.market_id;

  const refreshMarkets = async () => {
    try {
      setIsRefreshingMarkets(true);

      if (connected && address) {
        const balanceText =
          (await fetchMappingValue(TOKEN_PROGRAM_ID, "account", address)) ??
          (await fetchMappingValue(TOKEN_PROGRAM_ID, "balances", address));
        const nextBalance = balanceText ? parseTypedInt(balanceText) : 0n;
        setBalanceAtomic(nextBalance);
        setBalanceValue(formatDisplayUsd(nextBalance));
      } else {
        setBalanceAtomic(0n);
        setBalanceValue("0.00");
      }

      const nextStates = await Promise.all(
        p2pMarkets.map(async (market) => {
          const text = await fetchMappingValue(
            P2P_PROGRAM_ID,
            "markets",
            `${market.market_id}field`
          );
          return [market.market_id, parseMarketState(text)] as const;
        })
      );

      setMarketStates(Object.fromEntries(nextStates));

      if (latestInvite) {
        const offerText = await fetchMappingValue(P2P_PROGRAM_ID, "offers", latestInvite.offerId);
        setLatestInviteOffer(parseOfferCommitment(offerText, latestInvite.offerId));
      }
    } catch (error) {
      console.error("P2P market refresh error:", error);
    } finally {
      setIsRefreshingMarkets(false);
    }
  };

  const loadRecords = async () => {
    setIsRefreshingRecords(true);
    setRecords([]);
    setBets({});
    setRecordMessage(
      "This contract version settles from invite details and offer state, not wallet records."
    );
    setIsRefreshingRecords(false);
  };

  const decryptRecord = async (record: WalletRecord) => {
    if (!decrypt || !record.recordCiphertext) return;

    const key = getRecordKey(record);

    try {
      setDecryptingKey(key);
      const decrypted = await decrypt(record.recordCiphertext);

      if (!decrypted || (typeof decrypted !== "object" && typeof decrypted !== "string")) {
        return;
      }

      const marketId = parseTypedInt(getField(decrypted, "market_id") ?? "").toString();
      const outcomeValue = Number(parseTypedInt(getField(decrypted, "outcome") ?? ""));
      const stake = parseTypedInt(getField(decrypted, "stake") ?? "");
      setBets((current) => ({
        ...current,
        [key]: {
          key,
          marketId,
          outcomeValue,
          stake,
          counterparty: getField(decrypted, "counterparty") ?? "",
          recordInput: buildBetInput(decrypted),
        },
      }));
    } catch (error) {
      console.error("P2P decrypt error:", error);
    } finally {
      setDecryptingKey(null);
    }
  };

  useEffect(() => {
    void refreshMarkets();
  }, [connected, address]);

  useEffect(() => {
    let cancelled = false;

    const loadInviteOffer = async () => {
      if (!invitePreview) {
        setInviteOffer(null);
        return;
      }

      try {
        const text = await fetchMappingValue(
          P2P_PROGRAM_ID,
          "offers",
          invitePreview.offerId
        );
        if (!cancelled) {
          setInviteOffer(parseOfferCommitment(text, invitePreview.offerId));
        }
      } catch (error) {
        console.error("Invite offer lookup error:", error);
        if (!cancelled) {
          setInviteOffer(null);
        }
      }
    };

    void loadInviteOffer();

    return () => {
      cancelled = true;
    };
  }, [invitePreview]);

  const runTx = async (runner: () => Promise<void>) => {
    try {
      setIsProcessing(true);
      setStatus("");
      await runner();
      window.setTimeout(() => {
        void refreshMarkets();
        if (connected) {
          void loadRecords();
        }
      }, 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateMarket = async () => {
    if (!connected || !address) return;

    await runTx(async () => {
      setStatus("Creating market...");
      await executeTransaction({
        program: P2P_PROGRAM_ID,
        function: "create_market",
        fee: 100000,
        inputs: [
          `${selectedMarket.market_id}field`,
          address,
          `${selectedMarket.closeHeight}u32`,
        ],
      });
      setStatus("Market created.");
    });
  };

  const handleCreateOffer = async () => {
    if (!connected || !address || !selectedState.exists || selectedState.isResolved) return;
    if (atomicStake <= 0n) return;
    if (atomicStake > balanceAtomic) {
      setStatus("Not enough USDCx balance.");
      return;
    }
    if (P2P_ADAPTER_ADDRESS === "") {
      setStatus("P2P adapter address is missing.");
      return;
    }

    await runTx(async () => {
      setStatus("Approving USDCx...");
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        fee: 100000,
        inputs: [P2P_ADAPTER_ADDRESS, `${atomicStake}u128`],
        privateFee: false,
      });

      setStatus("Creating invite...");
      const offerId = createOfferId(selectedMarket.market_id);
      const salt = createRandomField();
      const nextInvite: InvitePayload = {
        version: 1,
        offerId,
        maker: address,
        outcome: `${selectedOutcomeValue}u8`,
        salt,
      };
      await executeTransaction({
        program: P2P_PROGRAM_ID,
        function: "create_offer_private",
        fee: 100000,
        inputs: [
          nextInvite.offerId,
          `${selectedMarket.market_id}field`,
          `${atomicStake}u64`,
          nextInvite.outcome,
          nextInvite.salt,
        ],
        privateFee: false,
      });
      setLatestInvite(nextInvite);
      setLatestInviteOffer({
        offerId,
        marketId: selectedMarket.market_id,
        stake: atomicStake,
        isOpen: true,
      });
      setStatus("Invite created. Copy it and share privately.");
      setStakeStr("");
    });
  };

  const handleAcceptInvite = async () => {
    if (
      !connected ||
      !address ||
      !invitePreview ||
      !inviteOffer ||
      !selectedState.exists ||
      selectedState.isResolved
    ) {
      return;
    }
    const inviteStake = inviteOffer.stake;
    if (inviteStake > balanceAtomic) {
      setStatus("Not enough USDCx balance.");
      return;
    }
    if (P2P_ADAPTER_ADDRESS === "") {
      setStatus("P2P adapter address is missing.");
      return;
    }

    await runTx(async () => {
      setStatus("Approving USDCx...");
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        fee: 100000,
        inputs: [P2P_ADAPTER_ADDRESS, `${inviteStake}u128`],
        privateFee: false,
      });

      setStatus("Accepting invite...");
      await executeTransaction({
        program: P2P_PROGRAM_ID,
        function: "accept_offer_private",
        fee: 100000,
        inputs: [
          invitePreview.offerId,
          `${inviteOffer.marketId}field`,
          `${inviteOffer.stake}u64`,
          invitePreview.maker,
          invitePreview.outcome,
          invitePreview.salt,
        ],
        privateFee: false,
      });
      setInviteInput("");
      setStatus("Invite accepted.");
    });
  };

  const handleCancelInvite = async (invite: InvitePayload) => {
    if (!latestInviteOffer) return;

    await runTx(async () => {
      setStatus("Canceling invite...");
      await executeTransaction({
        program: P2P_PROGRAM_ID,
        function: "cancel_offer_private",
        fee: 100000,
        inputs: [
          invite.offerId,
          `${latestInviteOffer.marketId}field`,
          `${latestInviteOffer.stake}u64`,
          invite.outcome,
          invite.salt,
        ],
        privateFee: false,
      });
      setLatestInvite(null);
      setLatestInviteOffer(null);
      setStatus("Invite canceled.");
    });
  };

  const handleCopyInvite = async () => {
    if (!latestInviteShareText) return;

    try {
      await navigator.clipboard.writeText(latestInviteShareText);
      setStatus("Invite copied.");
    } catch (error) {
      console.error("Copy invite error:", error);
      setStatus("Unable to copy invite.");
    }
  };

  const handleEmailInvite = () => {
    if (!latestInviteShareText) return;
    const subject = encodeURIComponent(`True Markets P2P invite`);
    const body = encodeURIComponent(latestInviteShareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleShareInvite = async () => {
    if (!latestInviteShareText) return;

    if (typeof navigator === "undefined" || !("share" in navigator)) {
      setStatus("Native sharing is not available on this device.");
      return;
    }

    try {
      await navigator.share({
        title: "True Markets P2P invite",
        text: latestInviteShareText,
      });
      setStatus("Invite shared.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Share invite error:", error);
      setStatus("Unable to share invite.");
    }
  };

  const handleClaim = async (recordInput: string | null) => {
    if (!recordInput) return;
    await runTx(async () => {
      setStatus("Claiming...");
      await executeTransaction({
        program: P2P_PROGRAM_ID,
        function: "claim_private",
        fee: 100000,
        inputs: [recordInput],
        privateFee: false,
      });
      setStatus("Claim submitted.");
    });
  };

  const handleRefund = async (recordInput: string | null) => {
    if (!recordInput) return;
    await runTx(async () => {
      setStatus("Refunding...");
      await executeTransaction({
        program: P2P_PROGRAM_ID,
        function: "refund_private",
        fee: 100000,
        inputs: [recordInput],
        privateFee: false,
      });
      setStatus("Refund submitted.");
    });
  };

  if (!mounted) {
    return <div className="surface-card h-[720px] animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <BetModeSwitch active="p2p" />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="surface-card p-6 md:p-8">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            P2P bets
          </h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Markets
              </p>
              <p className="mt-2 font-display text-3xl font-bold">{p2pMarkets.length}</p>
            </div>
            <div className="surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Volume
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {formatCompactUsd(
                  p2pMarkets.reduce(
                    (sum, market) => sum + (marketStates[market.market_id]?.volume ?? 0n),
                    0n
                  )
                )}
              </p>
            </div>
            <div className="surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Matches
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {p2pMarkets.reduce(
                  (sum, market) => sum + (marketStates[market.market_id]?.matchedCount ?? 0),
                  0
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Wallet
              </p>
              <p className="mt-2 text-lg font-semibold">
                {connected ? `${balanceValue} USDCx` : "Not connected"}
              </p>
            </div>
            <div className="surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Privacy
              </p>
              <p className="mt-2 text-lg font-semibold">Private invite</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-3xl font-bold tracking-tight">Markets</h2>
            <Button
              type="button"
              variant="secondary"
              onClick={refreshMarkets}
              disabled={isRefreshingMarkets}
              className="h-11 rounded-2xl"
            >
              {isRefreshingMarkets ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            {p2pMarkets.map((market) => {
              const state = marketStates[market.market_id] ?? parseMarketState(null);
              const isActive = selectedMarketId === market.market_id;
              const statusLabel = !state.exists
                ? "not initialized"
                : state.isResolved
                ? state.winningOutcome === 3
                  ? "canceled"
                  : "resolved"
                : "open";

              return (
                <button
                  key={market.market_id}
                  type="button"
                  onClick={() => setSelectedMarketId(market.market_id)}
                  className={cn(
                    "surface-card w-full p-5 text-left transition-all duration-200",
                    isActive &&
                      "border-transparent shadow-[0_28px_60px_-34px_rgba(14,165,233,0.42)] ring-1 ring-sky-400/30"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                          {market.category}
                        </span>
                        <span className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                          {statusLabel}
                        </span>
                      </div>

                      <h3 className="mt-3 max-w-2xl font-display text-2xl font-bold tracking-tight">
                        {market.market_title}
                      </h3>
                    </div>

                    <div className="rounded-[22px] border border-slate-200/70 bg-white/88 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Close
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {market.deadline}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="surface-card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl font-bold tracking-tight">
                {selectedMarket.market_title}
              </h2>
              {connected && (
                <div className="rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium dark:border-white/10 dark:bg-white/5">
                  <span className="inline-flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    {balanceValue} USDCx
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Status
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {!selectedState.exists
                    ? "Not initialized"
                    : selectedState.isResolved
                    ? selectedState.winningOutcome === 3
                      ? "Canceled"
                      : "Resolved"
                    : "Open"}
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Volume
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatDisplayUsd(selectedState.volume)}
                </p>
              </div>
            </div>

            {!selectedState.exists ? (
              <div className="mt-5 rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-5">
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  This market has not been initialized onchain.
                </p>
                <Button
                  className="mt-4 h-12 rounded-2xl"
                  onClick={handleCreateMarket}
                  disabled={!connected || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Create market"
                  )}
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActionMode("create")}
                    className={cn(
                      "rounded-[24px] border px-4 py-3 text-left transition-all duration-200",
                      actionMode === "create"
                        ? "border-transparent bg-slate-950 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.85)]"
                        : "border-slate-200/80 bg-white/88 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
                    )}
                  >
                    <p className="text-lg font-semibold">Create invite</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionMode("accept")}
                    className={cn(
                      "rounded-[24px] border px-4 py-3 text-left transition-all duration-200",
                      actionMode === "accept"
                        ? "border-transparent bg-slate-950 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.85)]"
                        : "border-slate-200/80 bg-white/88 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
                    )}
                  >
                    <p className="text-lg font-semibold">Accept invite</p>
                  </button>
                </div>

                {actionMode === "create" ? (
                  <div className="mt-4 space-y-4 rounded-[24px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setOutcome("yes")}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors",
                          outcome === "yes"
                            ? "border-transparent bg-sky-500 text-white"
                            : "border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-950/20"
                        )}
                      >
                        <p className="text-sm font-semibold">{selectedMarket.outcome_a}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutcome("no")}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors",
                          outcome === "no"
                            ? "border-transparent bg-amber-400 text-slate-950"
                            : "border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-950/20"
                        )}
                      >
                        <p className="text-sm font-semibold">{selectedMarket.outcome_b}</p>
                      </button>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Stake
                      </label>
                      <div className="relative mt-3">
                        <Input
                          type="number"
                          value={stakeStr}
                          onChange={(event) => setStakeStr(event.target.value)}
                          placeholder="0.00"
                          className="h-14 rounded-2xl border-slate-200/80 bg-white pr-20 text-xl font-semibold shadow-none dark:border-white/10 dark:bg-slate-950/35"
                          disabled={isProcessing}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                          USDCx
                        </span>
                      </div>
                    </div>

                    <Button
                      className="h-14 w-full rounded-2xl text-base font-semibold"
                      onClick={handleCreateOffer}
                      disabled={!canCreateOffer}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        "Create invite"
                      )}
                    </Button>

                    {latestInvite &&
                      latestInviteOffer &&
                      latestInviteOffer.marketId === selectedMarket.market_id && (
                      <div className="space-y-3 rounded-[22px] border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-950/25">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Side
                            </p>
                            <p className="mt-2 text-base font-semibold text-foreground">
                              {latestInvite.outcome === "0u8"
                                ? selectedMarket.outcome_a
                                : selectedMarket.outcome_b}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Stake
                            </p>
                            <p className="mt-2 text-base font-semibold text-foreground">
                              {formatUnits(latestInviteOffer?.stake ?? 0n, TOKEN_DECIMALS, 4)}
                            </p>
                          </div>
                        </div>

                        <textarea
                          readOnly
                          value={latestInviteShareText || JSON.stringify(latestInvite)}
                          className="h-28 w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs outline-none dark:border-white/10 dark:bg-slate-950/25"
                        />

                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="secondary"
                            className="h-11 rounded-2xl"
                            onClick={handleCopyInvite}
                            disabled={isProcessing}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy invite
                          </Button>
                          <Button
                            variant="secondary"
                            className="h-11 rounded-2xl"
                            onClick={handleEmailInvite}
                            disabled={isProcessing}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Email invite
                          </Button>
                          <Button
                            variant="secondary"
                            className="h-11 rounded-2xl"
                            onClick={handleShareInvite}
                            disabled={isProcessing}
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            Share invite
                          </Button>
                          <Button
                            variant="secondary"
                            className="h-11 rounded-2xl"
                            onClick={() => handleCancelInvite(latestInvite)}
                            disabled={isProcessing}
                          >
                            Cancel invite
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4 rounded-[24px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                    <textarea
                      value={inviteInput}
                      onChange={(event) => setInviteInput(event.target.value)}
                      placeholder="Paste private invite"
                      className="h-36 w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/35"
                      disabled={isProcessing}
                    />

                    {invitePreview && inviteOffer && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-slate-200/70 bg-white p-3 dark:border-white/10 dark:bg-slate-950/25">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Stake
                          </p>
                          <p className="mt-2 text-base font-semibold text-foreground">
                            {formatUnits(inviteOffer?.stake ?? 0n, TOKEN_DECIMALS, 4)}
                          </p>
                        </div>
                        <div className="rounded-[20px] border border-slate-200/70 bg-white p-3 dark:border-white/10 dark:bg-slate-950/25">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Your side
                          </p>
                          <p className="mt-2 text-base font-semibold text-foreground">
                            {invitePreview.outcome === "0u8"
                              ? selectedMarket.outcome_b
                              : selectedMarket.outcome_a}
                          </p>
                        </div>
                      </div>
                    )}

                    <Button
                      className="h-14 w-full rounded-2xl text-base font-semibold"
                      onClick={handleAcceptInvite}
                      disabled={!canAcceptInvite}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        "Accept invite"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}

            {status && (
              <div className="mt-4 rounded-2xl border border-sky-500/15 bg-sky-500/8 px-4 py-3 text-center text-sm font-medium text-sky-700 dark:text-sky-300">
                {status}
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-bold tracking-tight">
                Your bets
              </h3>
              <Button
                type="button"
                variant="secondary"
                onClick={loadRecords}
                disabled={isRefreshingRecords}
                className="h-11 rounded-2xl"
              >
                {isRefreshingRecords ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Load Records
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Invite ready
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {latestInvite &&
                  latestInviteOffer &&
                  latestInviteOffer.marketId === selectedMarket.market_id
                    ? "Yes"
                    : "No"}
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Bets
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {currentBets.length}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-slate-200/70 bg-white/85 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
              {recordMessage}
            </div>

            {records.length > 0 && (
              <div className="mt-4 space-y-3">
                {records.map((record) => {
                  const key = getRecordKey(record);
                  const bet = bets[key];

                  if (bet && bet.marketId !== String(selectedMarket.market_id)) {
                    return null;
                  }

                  const canClaim =
                    !!bet &&
                    selectedState.isResolved &&
                    selectedState.winningOutcome <= 1 &&
                    selectedState.winningOutcome === bet.outcomeValue;
                  const canRefund =
                    !!bet &&
                    selectedState.isResolved &&
                    selectedState.winningOutcome === 3;

                  return (
                    <div
                      key={key}
                      className="rounded-[24px] border border-slate-200/70 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Bet
                          </p>
                          <p className="mt-2 truncate text-sm font-medium text-foreground">
                            {record.commitment ?? "Encrypted record"}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => decryptRecord(record)}
                          disabled={decryptingKey === key || !decrypt}
                          className="h-10 rounded-2xl"
                        >
                          {decryptingKey === key ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Decrypting
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Decrypt
                            </>
                          )}
                        </Button>
                      </div>

                      {bet && (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[20px] border border-slate-200/70 bg-white p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Side
                              </p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {bet.outcomeValue === 0
                                  ? selectedMarket.outcome_a
                                  : selectedMarket.outcome_b}
                              </p>
                            </div>
                            <div className="rounded-[20px] border border-slate-200/70 bg-white p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Stake
                              </p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {formatUnits(bet.stake, TOKEN_DECIMALS, 4)}
                              </p>
                            </div>
                            <div className="rounded-[20px] border border-slate-200/70 bg-white p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Counterparty
                              </p>
                              <p className="mt-2 break-all text-xs font-semibold text-foreground">
                                {maskAddress(bet.counterparty)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {canClaim && (
                              <Button
                                className="h-11 rounded-2xl"
                                onClick={() => handleClaim(bet.recordInput)}
                                disabled={isProcessing || !bet.recordInput}
                              >
                                Claim
                              </Button>
                            )}
                            {canRefund && (
                              <Button
                                variant="secondary"
                                className="h-11 rounded-2xl"
                                onClick={() => handleRefund(bet.recordInput)}
                                disabled={isProcessing || !bet.recordInput}
                              >
                                Refund
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!connected && (
              <div className="mt-4 rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-amber-300/18 p-3 text-amber-700 dark:text-amber-200">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      Wallet connection required
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}




