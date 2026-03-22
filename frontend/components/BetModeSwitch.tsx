"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type BetModeSwitchProps = {
  active: "amm" | "p2p";
};

export function BetModeSwitch({ active }: BetModeSwitchProps) {
  return (
    <div className="inline-flex rounded-full border border-slate-200/80 bg-white p-1 dark:border-white/10 dark:bg-white/5">
      <Link
        href="/market"
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition-colors",
          active === "amm"
            ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        )}
      >
        AMM
      </Link>
      <Link
        href="/p2p"
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition-colors",
          active === "p2p"
            ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        )}
      >
        P2P
      </Link>
    </div>
  );
}
