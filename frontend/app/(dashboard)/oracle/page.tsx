"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Scale, ArrowRight, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { getStoredMarkets, mergeMarkets } from "@/lib/custom-markets";
import { data as allMarkets, type Market } from "@/lib/data";

interface OracleMarket {
  market: Market;
  status: "OPEN_FOR_PROPOSAL" | "PROPOSED" | "DISPUTED";
  timeRemaining?: string;
}

export default function OracleDashboardPage() {
  const [storedMarkets, setStoredMarkets] = useState<Market[]>([]);

  useEffect(() => {
    setStoredMarkets(getStoredMarkets());
  }, []);

  const oracleMarkets = useMemo(() => {
    const combined = mergeMarkets(allMarkets, storedMarkets);
    
    // The user requested all markets to show as needing proposal for the demo
    return combined.map((market): OracleMarket => {
      return {
        market,
        status: "OPEN_FOR_PROPOSAL",
      };
    });
  }, [storedMarkets]);

  const openCount = oracleMarkets.filter(m => m.status === "OPEN_FOR_PROPOSAL").length;
  const proposedCount = oracleMarkets.filter(m => m.status === "PROPOSED").length;
  const disputedCount = oracleMarkets.filter(m => m.status === "DISPUTED").length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <Scale className="h-8 w-8 text-primary" />
          Optimistic Oracle
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Decentralized dispute resolution. Earn USDCx by proposing correct market outcomes or disputing incorrect ones.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="surface-card relative overflow-hidden p-6 group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-backwards">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 shadow-[0_-4px_15px_-3px_rgba(59,130,246,0.5)] transition-all duration-500 group-hover:h-1.5" />
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-500/10 blur-xl transition-all duration-500 group-hover:bg-blue-500/20 group-hover:scale-150" />
          <h3 className="text-sm font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase relative z-10">Awaiting Proposal</h3>
          <div className="text-4xl font-black mt-2 text-slate-800 dark:text-white relative z-10 transition-transform duration-300 group-hover:translate-x-1">{openCount}</div>
        </div>
        <div className="surface-card relative overflow-hidden p-6 group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-backwards">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_-4px_15px_-3px_rgba(245,158,11,0.5)] transition-all duration-500 group-hover:h-1.5" />
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/10 blur-xl transition-all duration-500 group-hover:bg-amber-500/20 group-hover:scale-150" />
          <h3 className="text-sm font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase relative z-10">In Liveness</h3>
          <div className="text-4xl font-black mt-2 text-slate-800 dark:text-white relative z-10 transition-transform duration-300 group-hover:translate-x-1">{proposedCount}</div>
        </div>
        <div className="surface-card relative overflow-hidden p-6 group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-backwards">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-400 to-rose-600 shadow-[0_-4px_15px_-3px_rgba(239,68,68,0.5)] transition-all duration-500 group-hover:h-1.5" />
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-red-500/10 blur-xl transition-all duration-500 group-hover:bg-red-500/20 group-hover:scale-150" />
          <h3 className="text-sm font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase relative z-10">Active Disputes</h3>
          <div className="text-4xl font-black mt-2 text-slate-800 dark:text-white relative z-10 transition-transform duration-300 group-hover:translate-x-1">{disputedCount}</div>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-white/10 bg-slate-50 dark:bg-slate-900/50 px-6 py-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Active Requests</h3>
        </div>

        <div className="divide-y divide-white/5">
          {oracleMarkets.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No markets currently require resolution.
            </div>
          ) : (
            oracleMarkets.map(({ market, status, timeRemaining }) => (
              <div key={market.market_id} className="p-6 transition hover:bg-slate-50/50 dark:hover:bg-white/[0.02] flex items-center justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold font-mono text-slate-400">ID: {market.market_id}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {market.category}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                    {market.market_data.split("?")[0]}{market.market_data.includes("?") ? "?" : ""}
                  </h4>
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                    Reward Pool: <span className="font-medium text-slate-700 dark:text-slate-300">10 USDCx</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-48 text-right flex flex-col items-end justify-center">
                    {status === "OPEN_FOR_PROPOSAL" && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 bg-blue-500/10 px-3 py-1 rounded-lg">
                        <Clock className="w-4 h-4" /> Needs Proposal
                      </span>
                    )}
                    {status === "PROPOSED" && (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 bg-amber-500/10 px-3 py-1 rounded-lg">
                          <AlertTriangle className="w-4 h-4" /> Challenge Window
                        </span>
                        <div className="text-xs font-medium text-amber-600/70 mt-1.5">{timeRemaining}</div>
                      </>
                    )}
                    {status === "DISPUTED" && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-500/10 px-3 py-1 rounded-lg">
                        <ShieldCheck className="w-4 h-4" /> Disputed
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/oracle/${market.market_id}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-primary dark:hover:text-primary-foreground"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
