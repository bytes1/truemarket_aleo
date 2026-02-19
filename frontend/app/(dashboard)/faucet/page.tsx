"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Coins, Wallet } from "lucide-react";

const TOKEN_PROGRAM_ID = "true_market_token.aleo";
const API_URL = "https://api.explorer.provable.com/v1/testnet/program";

export default function FaucetPage() {
  const [mounted, setMounted] = useState(false);
  
  // Aleo Wallet Hooks
  const { connected, address, executeTransaction } = useWallet();
  
  // UI State
  const [balance, setBalance] = useState<string>("0.00");
  const [isMinting, setIsMinting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // 1. Handle Next.js Hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Fetch Balance Logic
  useEffect(() => {
    let isMounted = true;

    const fetchBalance = async () => {
      if (!connected || !address) return;
      
      setIsLoadingData(true);
      try {
        const res = await fetch(`${API_URL}/${TOKEN_PROGRAM_ID}/mapping/account/${address}`);
        if (res.ok) {
          const rawText = await res.text();
          if (rawText && rawText !== "null" && rawText.trim() !== "") {
            // FIX 1: Safely extract just the numbers, matching TradeCard.tsx exactly
            const clean = rawText.match(/\d+/)?.[0] || "0";
            if (isMounted) setBalance((parseInt(clean) || 0).toFixed(2));
          } else {
            if (isMounted) setBalance("0.00");
          }
        }
      } catch (err) {
        console.error("Fetch balance error:", err);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    if (mounted) {
      fetchBalance();
      const id = setInterval(fetchBalance, 15000);
      return () => {
        isMounted = false;
        clearInterval(id);
      };
    }
  }, [mounted, connected, address]);

  // 3. Handle Mint Transaction
  const handleMint = async () => {
    if (!connected || !address) return;
    
    setIsMinting(true);
    setStatus(null);

    try {
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "mint_public", 
        inputs: [address, "100u64"], 
        fee: 100000,
      });

      setStatus("Success! +100 TMT minted. Waiting for network sync...");
      
      setTimeout(() => {
        setStatus(null);
      }, 6000);

    } catch (err: any) {
      console.error("Mint failed:", err);
      setStatus("Minting failed. See console for details.");
    } finally {
      setIsMinting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connected) {
    return (
      // FIX 2: Added mx-auto and flex centering classes
      <div className="container mx-auto flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center shadow-sm border-2">
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>
              You need to connect your Aleo wallet to access the faucet.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
             <Button variant="secondary" size="lg" className="pointer-events-none opacity-50">
                <Wallet className="mr-2 h-4 w-4" />
                Connect via Navbar
             </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    // FIX 2: Added mx-auto and flex centering classes to ensure perfect alignment
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[70vh] py-10">
      <div className="mb-8 text-center w-full max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2">TMT Faucet</h1>
        <p className="text-muted-foreground">
          Mint free test tokens to trade on True Markets.
        </p>
      </div>

      <Card className="w-full max-w-xl border-2 shadow-sm">
        <CardHeader className="bg-muted/5 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-blue-500" />
              True Market Token
            </CardTitle>
            <div className="text-xs font-mono text-muted-foreground bg-white px-2 py-1 rounded border shadow-sm">
               {TOKEN_PROGRAM_ID}
            </div>
          </div>
          <CardDescription className="pt-2">
            Get 100 TMT per click.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-6">
          {/* Balance Display */}
          <div className="bg-blue-500/5 p-6 rounded-xl border-2 border-blue-500/10 text-center">
            <h3 className="text-[10px] uppercase tracking-wider text-blue-600 font-black mb-1">
              Your Wallet Balance
            </h3>
            <div className="text-4xl font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
              {isLoadingData && balance === "0.00" ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto opacity-20" />
              ) : (
                <>
                  {balance} <span className="text-xl text-muted-foreground font-bold">TMT</span>
                </>
              )}
            </div>
          </div>

          {/* Status Message */}
          {status && (
            <div className={`text-xs font-bold uppercase tracking-wide text-center p-3 rounded-lg ${
              status.includes("failed") 
                ? "bg-red-50 text-red-600 border border-red-100" 
                : "bg-blue-50 text-blue-600 border border-blue-100 animate-pulse"
            }`}>
              {status}
            </div>
          )}
        </CardContent>

        <CardFooter className="pb-6">
          <Button 
            className="w-full h-14 text-lg font-black transition-all shadow-md" 
            onClick={handleMint} 
            disabled={isMinting || isLoadingData}
          >
            {isMinting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Minting Tokens...
              </>
            ) : (
              "Mint 100 TMT"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}