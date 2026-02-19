"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, Info, RefreshCw } from "lucide-react";

import { TimelineCard } from "./TimelineCard";
import { type Market } from "@/lib/data";

const MARKET_PROGRAM_ID = "ture_prediction_market1.aleo";
const TOKEN_PROGRAM_ID = "true_market_token.aleo";
const MARKET_PROGRAM_ADDRESS = "aleo1rqcw8vqmtzs96kljsptjddkkttskp73zqha04q867r2twchsavgq89zycg";
const API_URL = "https://api.explorer.provable.com/v1/testnet/program";

export const TradeCard = ({ market }: { market: Market }) => {
  const [mounted, setMounted] = useState(false);
  const { connected, address, executeTransaction } = useWallet();

  const [outcome, setOutcome] = useState("yes");
  const [amountStr, setAmountStr] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  const [balanceValue, setBalanceValue] = useState("0.00");
  const [currentPrice, setCurrentPrice] = useState(0.50);
  const [userShares, setUserShares] = useState({ yes: "0", no: "0" });

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchOnChainData = async () => {
    try {
      const market_id_field = `${market.market_id}field`;

      if (connected && address) {
        // 1. Fetch User Token Balance
        const balanceRes = await fetch(`${API_URL}/${TOKEN_PROGRAM_ID}/mapping/account/${address}`);
        if (balanceRes.ok) {
          const rawText = await balanceRes.text();
          if (rawText && rawText !== "null") {
            // Safely grab just the first sequence of numbers (ignores quotes and "u64")
            const clean = rawText.match(/\d+/)?.[0] || "0";
            setBalanceValue((parseInt(clean) || 0).toFixed(2));
          }
        }

        // 2. Fetch User Share Holdings
        const fetchShares = async (outVal: string) => {
          const structStr = `{market:${market_id_field},holder:${address},outcome:${outVal}}`;
          const encodedKey = encodeURIComponent(structStr);
          const url = `${API_URL}/${MARKET_PROGRAM_ID}/mapping/user_shares/${encodedKey}`;

          const res = await fetch(url);
          if (res.ok) {
            const rawText = await res.text();
            
            if (!rawText || rawText === "null" || rawText.trim() === "") {
              return "0";
            }
            
            // Extracts ONLY the core number. 
            // '"10u64"' -> '10'
            // '10u64' -> '10'
            return rawText.match(/\d+/)?.[0] || "0";
          }
          return "0";
        };

        const [yesAmt, noAmt] = await Promise.all([
          fetchShares("0u8"),
          fetchShares("1u8"),
        ]);

        setUserShares({ yes: yesAmt, no: noAmt });
      }

      // 3. Fetch AMM Price
      const poolRes = await fetch(`${API_URL}/${MARKET_PROGRAM_ID}/mapping/pools/${market_id_field}`);
      if (poolRes.ok) {
        const rawText = await poolRes.text();
        if (rawText && rawText !== "null") {
          const sA = parseInt(rawText.match(/shares_a:\s*"?(\d+)/)?.[1] || "0");
          const sB = parseInt(rawText.match(/shares_b:\s*"?(\d+)/)?.[1] || "0");
          if (sA > 0 && sB > 0) {
            setCurrentPrice(sB / (sA + sB));
          }
        }
      }
    } catch (e) {
      console.error("Data fetch error:", e);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    fetchOnChainData();
    const id = setInterval(fetchOnChainData, 15000);
    return () => clearInterval(id);
  }, [mounted, connected, address, market.market_id]);

  const tradeDetails = useMemo(() => {
    const amount = parseFloat(amountStr) || 0;
    return {
      price: currentPrice.toFixed(4),
      estShares: amount > 0 ? (amount / currentPrice).toFixed(4) : "0.0000",
    };
  }, [amountStr, currentPrice]);

  const onAction = async () => {
    if (!connected || !address) return;
    const rawAmount = `${amountStr}u64`;
    const market_id_field = `${market.market_id}field`;

    try {
      setIsProcessing(true);
      setTxStatus("Approving TMT...");
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        inputs: [MARKET_PROGRAM_ADDRESS, rawAmount],
        fee: 100000,
      });

      setTxStatus("Buying shares...");
      await executeTransaction({
        program: MARKET_PROGRAM_ID,
        function: "buy_shares",
        inputs: [market_id_field, outcome === "yes" ? "0u8" : "1u8", rawAmount],
        fee: 100000,
      });

      setTxStatus("Broadcast successful!");
      setTimeout(() => {
        setTxStatus("");
        setAmountStr("");
        fetchOnChainData();
      }, 5000);
    } catch (e) {
      setTxStatus("Transaction failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) return <Card className="w-full h-[400px] animate-pulse bg-muted" />;

  return (
    <Card className="sticky top-8 border-2 shadow-sm">
      <CardHeader className="p-4 border-b bg-muted/5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Trade Market</h3>
          {connected && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-white px-2 py-1 rounded-full border shadow-sm">
              <Wallet className="w-3.5 h-3.5 text-blue-500" /> {balanceValue} TMT
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 px-4 pt-5 pb-4">
        <ToggleGroup
          type="single"
          value={outcome}
          onValueChange={(v) => v && setOutcome(v)}
          className="grid grid-cols-2 gap-3"
        >
          <ToggleGroupItem
            value="yes"
            className="h-14 border-2 data-[state=on]:border-cyan-500 data-[state=on]:bg-cyan-500/5 flex justify-between px-3"
          >
            <span className="text-xs">{market.outcome_a}</span>
            <span className="font-bold text-lg">${tradeDetails.price}</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="no"
            className="h-14 border-2 data-[state=on]:border-pink-500 data-[state=on]:bg-pink-500/5 flex justify-between px-3"
          >
            <span className="text-xs">{market.outcome_b}</span>
            <span className="font-bold text-lg">
              ${(1 - parseFloat(tradeDetails.price)).toFixed(4)}
            </span>
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
            TMT
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
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">Yes Shares</span>
                <span className="font-mono font-bold text-cyan-700">{userShares.yes}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">No Shares</span>
                <span className="font-mono font-bold text-pink-700">{userShares.no}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Est. Shares:</span>
            <span className="text-foreground">{tradeDetails.estShares}</span>
          </div>
        </div>

        <Button
          className="w-full h-14 text-lg font-black transition-all shadow-md"
          onClick={onAction}
          disabled={
            !connected || !amountStr || parseFloat(amountStr) <= 0 || isProcessing
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