"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimelineCard } from "./TimelineCard";
import { type Market } from "@/lib/data";
import { cn } from "@/lib/utils";

const MARKET_PROGRAM_ID = "ture_prediction_market2.aleo";
const TOKEN_PROGRAM_ID = "test_usdcx_stablecoin.aleo";
const ADAPTER_PROGRAM_ADDRESS =
  "aleo1dueh8x2nkuyywlzun8mhkslspgh7jxt2qqpvsvz9hwmyr5fwdcpqeaj4ur";
const API_URL = "https://api.explorer.provable.com/v1/testnet/program";
const TOKEN_DECIMALS = 6;
const SLIPPAGE_BPS = 100n;

type Outcome = "yes" | "no";

type PoolState = {
  sharesA: bigint;
  sharesB: bigint;
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
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;

  if (precision === 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, precision)
    .replace(/0+$/, "");

  return `${negative ? "-" : ""}${whole.toString()}${
    fractionStr ? `.${fractionStr}` : ""
  }`;
}

function formatDisplayUsd(rawAtomic: bigint) {
  return formatUnits(rawAtomic, TOKEN_DECIMALS, 2);
}

function computeBuyQuoteAtomic(
  sharesA: bigint,
  sharesB: bigint,
  outcome: Outcome,
  amount: bigint
) {
  if (sharesA <= 0n || sharesB <= 0n || amount <= 0n) {
    return {
      sharesOut: 0n,
    };
  }

  const k = sharesA * sharesB;

  if (outcome === "yes") {
    const nextSharesB = sharesB + amount;
    const nextSharesA = k / nextSharesB;
    const sharesOut = sharesA - nextSharesA;
    return { sharesOut: sharesOut > 0n ? sharesOut : 0n };
  }

  const nextSharesA = sharesA + amount;
  const nextSharesB = k / nextSharesA;
  const sharesOut = sharesB - nextSharesB;
  return { sharesOut: sharesOut > 0n ? sharesOut : 0n };
}

async function fetchMappingValue(programId: string, mapping: string, key: string) {
  const response = await fetch(
    `${API_URL}/${programId}/mapping/${mapping}/${encodeURIComponent(key)}`
  );

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  if (!text || text === "null") {
    return null;
  }

  return text;
}

export const TradeCard = ({ market }: { market: Market }) => {
  const [mounted, setMounted] = useState(false);
  const { connected, address, executeTransaction } = useWallet();

  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [amountStr, setAmountStr] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  const [balanceValue, setBalanceValue] = useState("0.00");
  const [currentPrice, setCurrentPrice] = useState(0.5);
  const [pool, setPool] = useState<PoolState>({ sharesA: 0n, sharesB: 0n });
  const [portfolioMessage, setPortfolioMessage] = useState(
    "Positions are private. Read wallet-owned Position records to show holdings."
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchOnChainData = async () => {
    try {
      const marketIdField = `${market.market_id}field`;

      if (connected && address) {
        const balanceText =
          (await fetchMappingValue(TOKEN_PROGRAM_ID, "account", address)) ??
          (await fetchMappingValue(TOKEN_PROGRAM_ID, "balances", address));

        if (balanceText) {
          setBalanceValue(formatDisplayUsd(parseTypedInt(balanceText)));
        }

        setPortfolioMessage(
          "Private positions are not available in public mappings. Query wallet Position records for this market."
        );
      }

      const poolText = await fetchMappingValue(
        MARKET_PROGRAM_ID,
        "pools",
        marketIdField
      );

      if (poolText) {
        const sharesA = BigInt(poolText.match(/shares_a:\s*"?(\d+)/)?.[1] || "0");
        const sharesB = BigInt(poolText.match(/shares_b:\s*"?(\d+)/)?.[1] || "0");

        setPool({ sharesA, sharesB });

        const total = sharesA + sharesB;
        if (total > 0n) {
          setCurrentPrice(Number(sharesB) / Number(total));
        }
      }
    } catch (error) {
      console.error("Data fetch error:", error);
    }
  };

  useEffect(() => {
    if (!mounted) {
      return;
    }

    fetchOnChainData();
    const intervalId = setInterval(fetchOnChainData, 15000);
    return () => clearInterval(intervalId);
  }, [mounted, connected, address, market.market_id]);

  const tradeDetails = useMemo(() => {
    const atomicAmount = parseUnits(amountStr);
    const quote = computeBuyQuoteAtomic(
      pool.sharesA,
      pool.sharesB,
      outcome,
      atomicAmount
    );
    const minSharesOut = (quote.sharesOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
    const avgFillPrice =
      quote.sharesOut > 0n ? Number(atomicAmount) / Number(quote.sharesOut) : 0;

    return {
      atomicAmount,
      sharesOut: quote.sharesOut,
      minSharesOut,
      estSharesDisplay: formatUnits(quote.sharesOut, TOKEN_DECIMALS, 4),
      minSharesDisplay: formatUnits(minSharesOut, TOKEN_DECIMALS, 4),
      avgFillPriceDisplay: avgFillPrice.toFixed(4),
      yesPriceDisplay: currentPrice.toFixed(4),
      noPriceDisplay: (1 - currentPrice).toFixed(4),
    };
  }, [amountStr, currentPrice, outcome, pool]);

  const selectedOutcomeLabel =
    outcome === "yes" ? market.outcome_a : market.outcome_b;

  const onAction = async () => {
    if (!connected || !address) return;
    if (tradeDetails.atomicAmount <= 0n || tradeDetails.sharesOut <= 0n) return;
    if (pool.sharesA <= 0n || pool.sharesB <= 0n) return;

    const marketIdField = `${market.market_id}field`;
    const outcomeU8 = outcome === "yes" ? "0u8" : "1u8";

    try {
      setIsProcessing(true);

      setTxStatus("Approving USDCx allowance...");
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        inputs: [ADAPTER_PROGRAM_ADDRESS, `${tradeDetails.atomicAmount}u128`],
        fee: 100000,
        privateFee: false,
      });

      setTxStatus("Submitting market purchase...");
      await executeTransaction({
        program: MARKET_PROGRAM_ID,
        function: "buy_private",
        inputs: [
          marketIdField,
          outcomeU8,
          `${tradeDetails.atomicAmount}u64`,
          address,
          `${pool.sharesA}u64`,
          `${pool.sharesB}u64`,
          `${tradeDetails.minSharesOut}u64`,
        ],
        fee: 150000,
        privateFee: false,
      });

      setTxStatus("Transaction broadcast successfully.");
      setTimeout(() => {
        setTxStatus("");
        setAmountStr("");
        fetchOnChainData();
      }, 5000);
    } catch (error) {
      console.error(error);
      setTxStatus("Transaction failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) {
    return <div className="surface-card h-[640px] animate-pulse" />;
  }

  return (
    <section className="surface-card sticky top-6 overflow-hidden p-0">
      <div className="border-b border-white/45 bg-gradient-to-r from-slate-950 via-sky-950 to-cyan-950 p-5 text-white dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
              Onchain execution
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
              Trade this market
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/72">
              Review live pricing, choose a side, and route a private share
              purchase from the same panel.
            </p>
          </div>

          {connected && (
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-xl">
              <span className="inline-flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {balanceValue} USDCx
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOutcome("yes")}
            className={cn(
              "rounded-[24px] border p-4 text-left transition-all duration-200",
              outcome === "yes"
                ? "border-transparent bg-sky-500 text-white shadow-[0_18px_35px_-24px_rgba(14,165,233,0.85)]"
                : "border-slate-200/80 bg-white/88 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
              {market.outcome_a}
            </p>
            <p className="mt-3 font-display text-3xl font-bold">
              ${tradeDetails.yesPriceDisplay}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setOutcome("no")}
            className={cn(
              "rounded-[24px] border p-4 text-left transition-all duration-200",
              outcome === "no"
                ? "border-transparent bg-amber-400 text-slate-950 shadow-[0_18px_35px_-24px_rgba(245,158,11,0.8)]"
                : "border-slate-200/80 bg-white/88 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
              {market.outcome_b}
            </p>
            <p className="mt-3 font-display text-3xl font-bold">
              ${tradeDetails.noPriceDisplay}
            </p>
          </button>
        </div>

        <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-4 dark:border-white/10 dark:bg-white/5">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Trade amount
          </label>
          <div className="relative mt-3">
            <Input
              type="number"
              value={amountStr}
              onChange={(event) => setAmountStr(event.target.value)}
              placeholder="0.00"
              className="h-14 rounded-2xl border-slate-200/80 bg-white pr-20 text-xl font-semibold shadow-none dark:border-white/10 dark:bg-slate-950/35"
              disabled={isProcessing}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
              USDCx
            </span>
          </div>
        </div>

        {connected ? (
          <div className="rounded-[28px] border border-sky-500/15 bg-sky-500/8 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
                  Portfolio context
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {portfolioMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={fetchOnChainData}
                className="rounded-full bg-white/70 p-2 text-sky-700 transition-transform duration-300 hover:rotate-180 dark:bg-white/8 dark:text-sky-300"
                aria-label="Refresh market data"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-amber-300/25 bg-amber-300/10 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-amber-300/18 p-3 text-amber-700 dark:text-amber-200">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Wallet connection required
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-900/75 dark:text-amber-100/80">
                  Connect an Aleo wallet from the header to approve USDCx and
                  place a position.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200/70 bg-white/86 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Est. shares
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {tradeDetails.estSharesDisplay}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200/70 bg-white/86 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Avg fill
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              ${tradeDetails.avgFillPriceDisplay}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200/70 bg-white/86 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Min shares
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {tradeDetails.minSharesDisplay}
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-500/15 bg-emerald-500/8 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-600 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Private share purchase</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Orders use onchain approval plus the market buy function. The
                selected side right now is <strong>{selectedOutcomeLabel}</strong>.
              </p>
            </div>
          </div>
        </div>

        <Button
          className="h-14 w-full rounded-2xl text-base font-semibold shadow-[0_20px_45px_-28px_rgba(14,165,233,0.9)]"
          onClick={onAction}
          disabled={
            !connected ||
            !amountStr ||
            parseFloat(amountStr) <= 0 ||
            isProcessing ||
            tradeDetails.atomicAmount <= 0n ||
            tradeDetails.sharesOut <= 0n
          }
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            `Buy ${selectedOutcomeLabel}`
          )}
        </Button>

        {txStatus && (
          <div className="rounded-2xl border border-sky-500/15 bg-sky-500/8 px-4 py-3 text-center text-sm font-medium text-sky-700 dark:text-sky-300">
            {txStatus}
          </div>
        )}
      </div>

      <div className="border-t border-white/45 p-5 dark:border-white/10">
        <TimelineCard market={market} />
      </div>
    </section>
  );
};
