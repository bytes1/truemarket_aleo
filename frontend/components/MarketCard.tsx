import Image from "next/image";
import { Clock3, Users } from "lucide-react";
import type { Market } from "@/lib/data";
import { cn } from "@/lib/utils";

const categoryClassName = {
  Crypto:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100",
  Politics:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100",
  Sports:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100",
  Entertainment:
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-300/20 dark:bg-fuchsia-300/10 dark:text-fuchsia-100",
} as const;

export const MarketCard = ({ market }: { market: Market }) => {
  const shouldRenderImage = market.cardStyle !== "text" && Boolean(market.image);

  return (
    <article className="surface-card flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-[0_20px_50px_-32px_rgba(15,23,42,0.32)]">
      {shouldRenderImage ? (
        <div className="relative h-44 overflow-hidden border-b border-slate-200/70 dark:border-white/10">
          <Image
            src={market.image || "/placeholder.svg"}
            alt={market.market_title}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              categoryClassName[market.category]
            )}
          >
            {market.category}
          </span>
          <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {market.marketType}
          </span>
        </div>

        <div>
          <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground line-clamp-3">
            {market.market_title}
          </h3>
        </div>

        <div className="surface-muted p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>{market.outcome_a}</span>
            <span>{market.outcome_b}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div className="flex h-full">
              <div
                className="h-full bg-slate-900 dark:bg-white"
                style={{ width: `${market.yesPercentage}%` }}
              />
              <div
                className="h-full bg-slate-300 dark:bg-white/25"
                style={{ width: `${market.noPercentage}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm font-semibold">
            <span>{market.yesPercentage}%</span>
            <span>{market.noPercentage}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Volume
            </p>
            <p className="mt-2 text-base font-semibold">
              {market.currency} {market.volume}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Deadline
            </p>
            <p className="mt-2 text-base font-semibold">{market.deadline}</p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-200/70 pt-4 text-sm text-muted-foreground dark:border-white/10">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" />
            {market.participants}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            {market.isFlashMarket ? "Flash" : "Standard"}
          </span>
        </div>
      </div>
    </article>
  );
};
