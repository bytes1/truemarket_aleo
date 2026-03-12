import Image from "next/image";
import {
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  Flame,
  Sparkles,
  Users,
} from "lucide-react";
import type { Market } from "@/lib/data";
import { cn } from "@/lib/utils";

const categoryTheme = {
  Crypto: {
    accent: "from-amber-400 via-orange-400 to-pink-500",
    badge:
      "border-amber-300/30 bg-amber-300/12 text-amber-100",
    support:
      "border-amber-300/20 bg-amber-300/10 text-amber-100",
    outcome:
      "border-amber-300/25 bg-amber-300/10 text-amber-900 dark:text-amber-100",
  },
  Politics: {
    accent: "from-sky-500 via-indigo-400 to-cyan-300",
    badge: "border-sky-300/30 bg-sky-300/12 text-sky-100",
    support: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    outcome:
      "border-sky-300/25 bg-sky-300/10 text-sky-900 dark:text-sky-100",
  },
  Sports: {
    accent: "from-emerald-400 via-teal-400 to-cyan-400",
    badge:
      "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
    support:
      "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    outcome:
      "border-emerald-300/25 bg-emerald-300/10 text-emerald-900 dark:text-emerald-100",
  },
  Entertainment: {
    accent: "from-fuchsia-500 via-rose-400 to-orange-300",
    badge:
      "border-fuchsia-300/30 bg-fuchsia-300/12 text-fuchsia-100",
    support:
      "border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100",
    outcome:
      "border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-900 dark:text-fuchsia-100",
  },
} as const;

export const MarketCard = ({ market }: { market: Market }) => {
  const theme = categoryTheme[market.category];
  const shouldRenderImage = market.cardStyle !== "text" && Boolean(market.image);

  return (
    <article className="surface-card group flex h-full flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1">
      <div className="relative min-h-[15rem] overflow-hidden">
        {shouldRenderImage ? (
          <Image
            src={market.image || "/placeholder.svg"}
            alt={market.market_title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br",
              theme.accent
            )}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/18 to-slate-950/90" />
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-28 bg-gradient-to-r opacity-35 blur-3xl",
            theme.accent
          )}
        />

        <div className="relative flex min-h-[15rem] flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur-xl",
                  theme.badge
                )}
              >
                {market.category}
              </span>
              {market.isFlashMarket && (
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-300/30 bg-orange-300/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-100 backdrop-blur-xl">
                  <Flame className="h-3.5 w-3.5" />
                  Flash
                </span>
              )}
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-xl transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight className="h-4.5 w-4.5" />
            </div>
          </div>

          <div>
            <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-white line-clamp-3">
              {market.market_title}
            </h3>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/74">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur-xl",
                  theme.support
                )}
              >
                <CircleDollarSign className="h-4 w-4" />
                {market.currency} {market.volume}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-xl">
                <Clock3 className="h-4 w-4" />
                {market.deadline}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="rounded-[24px] border border-slate-200/70 bg-white/84 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span>{market.outcome_a}</span>
            <span>{market.outcome_b}</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <div className="flex h-full">
              <div
                className={cn("h-full bg-gradient-to-r", theme.accent)}
                style={{ width: `${market.yesPercentage}%` }}
              />
              <div
                className="h-full bg-slate-900/18 dark:bg-white/18"
                style={{ width: `${market.noPercentage}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm font-semibold">
            <span>{market.yesPercentage}% leaning yes</span>
            <span>{market.noPercentage}% leaning no</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div
            className={cn(
              "rounded-[20px] border px-4 py-3",
              theme.outcome
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Outcome A
            </p>
            <p className="mt-2 text-base font-semibold">{market.outcome_a}</p>
          </div>
          <div className="rounded-[20px] border border-slate-200/70 bg-white/84 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Outcome B
            </p>
            <p className="mt-2 text-base font-semibold">{market.outcome_b}</p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-200/70 pt-4 text-sm text-muted-foreground dark:border-white/10">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-500" />
            {market.participants} participants
          </span>
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            {market.marketType}
          </span>
        </div>
      </div>
    </article>
  );
};
