"use client";

import { CalendarClock, CircleDot, ShieldCheck } from "lucide-react";
import type { Market } from "@/lib/data";

export const TimelineCard = ({ market }: { market: Market }) => (
  <div className="space-y-4">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Timeline
      </p>
      <h4 className="mt-2 font-display text-xl font-bold tracking-tight">
        Market lifecycle
      </h4>
    </div>

    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="rounded-full bg-sky-500/10 p-2 text-sky-600 dark:text-sky-300">
            <CircleDot className="h-4 w-4" />
          </div>
          <div className="mt-2 h-full w-px bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="pb-2">
          <p className="font-semibold">Live for trading</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            This market is currently available to browse and trade while active.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="rounded-full bg-amber-400/12 p-2 text-amber-600 dark:text-amber-300">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="mt-2 h-full w-px bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="pb-2">
          <p className="font-semibold">Closes {market.deadline}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Trading should stop once the market reaches its stated close window.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">Resolution review</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            After close, the outcome should be checked against the written rules
            and listed source before settlement.
          </p>
        </div>
      </div>
    </div>
  </div>
);
