"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, Info, RefreshCw } from "lucide-react";

import { TimelineCard } from "./TimelineCard";
import { type Market } from "@/lib/data";

const MARKET_PROGRAM_ID = "ture_prediction_market2.aleo";
const TOKEN_PROGRAM_ID = "test_usdcx_stablecoin.aleo";
const ADAPTER_PROGRAM_ID = "usdcx_token_adapter.aleo";

const MARKET_PROGRAM_ADDRESS =
  "aleo1ee9wzhvlmt4crf9gwvdvdrg7k7vlcj38rl4tqp0au2xssky7jvpq83zfcr";
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

function formatUnits(value: bigint, decimals = TOKEN_DECIMALS, precision = 4): string {
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

  return `${negative ? "-" : ""}${whole.toString()}${fractionStr ? `.${fractionStr}` : ""}`;
}

function formatDisplayUsd(rawAtomic: bigint): string {
  return formatUnits(rawAtomic, TOKEN_DECIMALS, 2);
}

function computeBuyQuoteAtomic(
  sharesA: bigint,
  sharesB: bigint,
  outcome: Outcome,
  amount: bigint,
) {
  if (sharesA <= 0n || sharesB <= 0n || amount <= 0n) {
    return {
      nextSharesA: sharesA,
      nextSharesB: sharesB,
      sharesOut: 0n,
    };
  }

  const k = sharesA * sharesB;

  if (outcome === "yes") {
    const nextSharesB = sharesB + amount;
    const nextSharesA = k / nextSharesB;
    const sharesOut = sharesA - nextSharesA;

    return {
      nextSharesA,
      nextSharesB,
      sharesOut: sharesOut > 0n ? sharesOut : 0n,
    };
  }

  const nextSharesA = sharesA + amount;
  const nextSharesB = k / nextSharesA;
  const sharesOut = sharesB - nextSharesB;

  return {
    nextSharesA,
    nextSharesB,
    sharesOut: sharesOut > 0n ? sharesOut : 0n,
  };
}

async function fetchMappingValue(programId: string, mapping: string, key: string) {
  const res = await fetch(`${API_URL}/${programId}/mapping/${mapping}/${encodeURIComponent(key)}`);
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text === "null") return null;
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
    "Positions are private. Read wallet-owned Position records to show holdings.",
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
          "Private positions are not available in public mappings. Query wallet Position records for this market.",
        );
      }

      const poolText = await fetchMappingValue(MARKET_PROGRAM_ID, "pools", marketIdField);
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
    if (!mounted) return;
    fetchOnChainData();
    const id = setInterval(fetchOnChainData, 15000);
    return () => clearInterval(id);
  }, [mounted, connected, address, market.market_id]);

  const tradeDetails = useMemo(() => {
    const atomicAmount = parseUnits(amountStr);
    const quote = computeBuyQuoteAtomic(pool.sharesA, pool.sharesB, outcome, atomicAmount);
    const minSharesOut = (quote.sharesOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;

    const avgFillPrice =
      quote.sharesOut > 0n ? Number(atomicAmount) / Number(quote.sharesOut) : 0;

    return {
      atomicAmount,
      sharesOut: quote.sharesOut,
      minSharesOut,
      estSharesDisplay: formatUnits(quote.sharesOut, TOKEN_DECIMALS, 4),
      avgFillPriceDisplay: avgFillPrice.toFixed(4),
      yesPriceDisplay: currentPrice.toFixed(4),
      noPriceDisplay: (1 - currentPrice).toFixed(4),
    };
  }, [amountStr, currentPrice, outcome, pool]);

  const onAction = async () => {
    if (!connected || !address) return;
    if (tradeDetails.atomicAmount <= 0n || tradeDetails.sharesOut <= 0n) return;
    if (pool.sharesA <= 0n || pool.sharesB <= 0n) return;

    const marketIdField = `${market.market_id}field`;
    const outcomeU8 = outcome === "yes" ? "0u8" : "1u8";

    try {
      setIsProcessing(true);

      setTxStatus("Approving USDCx...");
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        inputs: [ADAPTER_PROGRAM_ADDRESS, `${tradeDetails.atomicAmount}u128`],
        fee: 100000,
        privateFee: false,
      });

      setTxStatus("Buying private shares...");
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

      setTxStatus("Broadcast successful!");
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
    return <Card className="w-full h-[400px] animate-pulse bg-muted" />;
  }

  return (
    <Card className="sticky top-8 border-2 shadow-sm">
      <CardHeader className="p-4 border-b bg-muted/5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Trade Market</h3>
          {connected && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-white px-2 py-1 rounded-full border shadow-sm">
              <Wallet className="w-3.5 h-3.5 text-blue-500" /> {balanceValue} USDCx
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 px-4 pt-5 pb-4">
        <ToggleGroup
          type="single"
          value={outcome}
          onValueChange={(v) => v && setOutcome(v as Outcome)}
          className="grid grid-cols-2 gap-3"
        >
          <ToggleGroupItem
            value="yes"
            className="h-14 border-2 data-[state=on]:border-cyan-500 data-[state=on]:bg-cyan-500/5 flex justify-between px-3"
          >
            <span className="text-xs">{market.outcome_a}</span>
            <span className="font-bold text-lg">${tradeDetails.yesPriceDisplay}</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="no"
            className="h-14 border-2 data-[state=on]:border-pink-500 data-[state=on]:bg-pink-500/5 flex justify-between px-3"
          >
            <span className="text-xs">{market.outcome_b}</span>
            <span className="font-bold text-lg">${tradeDetails.noPriceDisplay}</span>
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="relative">
          <label className="text-[10px] font-black text-muted-foreground uppercase mb-1 block">
            Trade Amount
          </label>
          <Input
            type="number"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            className="h-14 text-xl font-mono pr-16 border-2"
            disabled={isProcessing}
          />
          <span className="absolute right-4 top-[2.2rem] text-sm font-bold text-muted-foreground">
            USDCx
          </span>
        </div>

        {connected && (
          <div className="bg-blue-500/5 rounded-xl p-4 border-2 border-blue-500/10 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                <Info className="w-3 h-3" /> Your Portfolio
              </span>
              <button
                onClick={fetchOnChainData}
                className="hover:rotate-180 transition-transform duration-500"
              >
                <RefreshCw className="w-3 h-3 text-blue-400" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground">{portfolioMessage}</div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Est. Shares:</span>
            <span className="text-foreground">{tradeDetails.estSharesDisplay}</span>
          </div>
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Avg Fill:</span>
            <span className="text-foreground">${tradeDetails.avgFillPriceDisplay}</span>
          </div>
        </div>

        <Button
          className="w-full h-14 text-lg font-black transition-all shadow-md"
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
            `Purchase ${outcome}`
          )}
        </Button>

        {txStatus && (
          <div className="text-center text-[10px] font-bold text-blue-600 uppercase animate-pulse">
            {txStatus}
          </div>
        )}
      </CardContent>

      <Separator />

      <CardFooter className="p-4">
        <TimelineCard market={market} />
      </CardFooter>
    </Card>
  );
};
