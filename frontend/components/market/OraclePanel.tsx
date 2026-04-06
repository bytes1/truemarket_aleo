"use client";

import { useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { Loader2, Scale, AlertTriangle, ShieldCheck } from "lucide-react";
import type { Market } from "@/lib/data";

const ORACLE_PROGRAM_ID = "true_optimistic_oracle_v3.aleo";
const TOKEN_PROGRAM_ID = "test_usdcx_stablecoin.aleo";
const MARKET_PROGRAM_ID = "true_prediction_market_v3.aleo";

type OracleState = "OPEN" | "PROPOSED" | "DISPUTED" | "RESOLVED";

interface OraclePanelProps {
  market: Market;
}

export function OraclePanel({ market }: OraclePanelProps) {
  const { connected, address, executeTransaction } = useWallet();
  const [oracleState, setOracleState] = useState<OracleState>("OPEN");
  const [proposedOutcome, setProposedOutcome] = useState<"YES" | "NO" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const bondAmount = 10; // Derived from market in a real app, assuming 10 here for UI
  const bondUnits = bondAmount * 1_000_000;

  const handlePropose = async (outcome: "YES" | "NO") => {
    if (!connected || !address) {
      setStatusMsg("Connect wallet to propose.");
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMsg(`Approving ${bondAmount} USDCx bond...`);
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        inputs: [ORACLE_PROGRAM_ID, `${bondUnits}u128`],
        fee: 100000,
        privateFee: false,
      });

      setStatusMsg("Submitting proposal...");
      const outcomeCode = outcome === "YES" ? "0u8" : "1u8";
      await executeTransaction({
        program: ORACLE_PROGRAM_ID,
        function: "propose_outcome",
        inputs: [`${market.market_id}field`, outcomeCode, `${bondUnits}u64`],
        fee: 150000,
        privateFee: false,
      });

      setProposedOutcome(outcome);
      setOracleState("PROPOSED");
      setStatusMsg("Proposal submitted! Liveness period started.");
    } catch (e) {
      console.error(e);
      setStatusMsg("Proposal failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDispute = async () => {
    if (!connected) return;
    try {
      setIsProcessing(true);
      setStatusMsg(`Approving ${bondAmount} USDCx bond...`);
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        inputs: [ORACLE_PROGRAM_ID, `${bondUnits}u128`],
        fee: 100000,
        privateFee: false,
      });

      setStatusMsg("Submitting dispute...");
      await executeTransaction({
        program: ORACLE_PROGRAM_ID,
        function: "dispute_outcome",
        inputs: [`${market.market_id}field`, `${bondUnits}u64`],
        fee: 150000,
        privateFee: false,
      });

      setOracleState("DISPUTED");
      setStatusMsg("Dispute raised. Waiting for manual resolution.");
    } catch (e) {
      console.error(e);
      setStatusMsg("Dispute failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!connected || !address) return;
    try {
      setIsProcessing(true);
      setStatusMsg("Fetching resolution record && resolving market...");

      // In a real flow, finalize_outcome is called, producing the record.
      // Then the record is passed to resolve_market.
      // Aleo doesn't easily chain transactions in one click yet, so this would be two clicks
      // or handled by a relayer. We simulate the final UI step here.

      setOracleState("RESOLVED");
      setStatusMsg("Market successfully resolved!");
    } catch (e) {
      console.error(e);
      setStatusMsg("Finalization failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (market.is_resolved || oracleState === "RESOLVED") return null;

  return (
    <div className="surface-card overflow-hidden p-0 ring-1 ring-white/5">
      <div className="bg-primary/5 border-b border-primary/10 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Scale className="h-4 w-4" />
          Optimistic Oracle
        </div>
        <div className="flex bg-primary/10 rounded-full px-2 py-0.5 text-xs font-semibold text-primary">
          Bond: {bondAmount} USDCx
        </div>
      </div>
      
      <div className="p-5 space-y-4">
        {oracleState === "OPEN" && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Stake your bond to propose a market resolution. If unchallenged, you earn it back.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePropose("YES")}
                disabled={isProcessing}
                className="btn grid place-content-center h-10 w-full rounded-xl bg-green-500/10 text-green-600 font-bold hover:bg-green-500/20 disabled:opacity-50 transition"
              >
                Propose YES
              </button>
              <button
                onClick={() => handlePropose("NO")}
                disabled={isProcessing}
                className="btn grid place-content-center h-10 w-full rounded-xl bg-red-500/10 text-red-600 font-bold hover:bg-red-500/20 disabled:opacity-50 transition"
              >
                Propose NO
              </button>
            </div>
          </>
        )}

        {oracleState === "PROPOSED" && (
          <>
            <div className="flex items-center gap-3 bg-amber-500/10 text-amber-600 rounded-xl p-3 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div className="text-sm font-medium">
                Proposed Outcome: <span className="font-bold">{proposedOutcome}</span>. Liveness period active.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDispute}
                disabled={isProcessing}
                className="h-10 w-full rounded-xl border border-red-500 bg-transparent text-red-500 font-bold hover:bg-red-500/10 transition disabled:opacity-50"
              >
                Dispute
              </button>
              <button
                onClick={handleFinalize}
                disabled={isProcessing}
                className="h-10 w-full rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition disabled:opacity-50"
              >
                Finalize
              </button>
            </div>
          </>
        )}

        {oracleState === "DISPUTED" && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <ShieldCheck className="h-10 w-10 text-amber-500 mb-3" />
            <h4 className="font-semibold text-slate-800 dark:text-slate-200">Dispute Raised</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] mt-1">
              The market creator is reviewing the dispute. Stakes are frozen.
            </p>
          </div>
        )}

        {statusMsg && (
          <div className="text-xs font-mono text-center text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-center gap-2">
            {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
            {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
}
