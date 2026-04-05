import Image from "next/image";
import { BarChart3, Sparkles } from "lucide-react";
import type { Market } from "@/lib/data";

function compactLabel(value: string) {
  return value.length > 10 ? `${value.slice(0, 9)}…` : value;
}

export const MarketCard = ({ market }: { market: Market }) => {
  const shouldRenderImage = Boolean(market.image);

  return (
    <article className="surface-card surface-card-hover relative flex h-full flex-col justify-between p-5 group cursor-pointer">
      <div className="absolute inset-x-0 -top-px h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="flex gap-4">
        {shouldRenderImage ? (
          <div className="relative shrink-0 w-[52px] h-[52px] rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 shadow-sm">
            <Image
              src={market.image || "/placeholder.svg"}
              alt={market.market_title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              unoptimized
            />
          </div>
        ) : (
          <div className="shrink-0 w-[52px] h-[52px] rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 flex items-center justify-center text-slate-400 shadow-inner">
            <BarChart3 className="w-6 h-6 transition-transform duration-300 group-hover:text-primary" />
          </div>
        )}
        
        <div className="flex flex-col flex-1 gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              {market.category}
              {market.isCustom && <Sparkles className="h-3.5 w-3.5 text-primary drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-white/5">
              {market.currency} {market.volume}
            </span>
          </div>
          <h3 className="font-semibold text-base leading-snug text-slate-900 dark:text-slate-100 line-clamp-3 mt-1.5">
            {market.market_title}
          </h3>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <div className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 px-3 py-2.5 flex justify-between items-center transition-all duration-300 group-hover:bg-primary/5 dark:group-hover:bg-primary/10 group-hover:border-primary/20 dark:group-hover:border-primary/30 shadow-sm shadow-blue-500/0 group-hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10 -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out_infinite]" />
            <span className="text-sm font-semibold text-primary/80 dark:text-primary z-10">
              {compactLabel(market.outcome_a)}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white z-10 drop-shadow-sm">{market.yesPercentage}%</span>
        </div>
        <div className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 px-3 py-2.5 flex justify-between items-center transition-all duration-300 group-hover:bg-red-500/5 dark:group-hover:bg-red-500/10 group-hover:border-red-500/20 dark:group-hover:border-red-500/30 shadow-sm shadow-red-500/0 group-hover:shadow-[0_0_15px_-3px_rgba(239,68,68,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10 -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out_infinite_0.1s]" />
            <span className="text-sm font-semibold text-red-500 z-10">
              {compactLabel(market.outcome_b)}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white z-10 drop-shadow-sm">{market.noPercentage}%</span>
        </div>
      </div>
    </article>
  );
};
