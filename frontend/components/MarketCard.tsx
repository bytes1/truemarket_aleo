import Image from "next/image";
import { Clock3, Users, BarChart3 } from "lucide-react";
import type { Market } from "@/lib/data";
import { cn } from "@/lib/utils";

export const MarketCard = ({ market }: { market: Market }) => {
  const shouldRenderImage = Boolean(market.image);

  return (
    <article className="surface-card flex h-full flex-col justify-between p-4 group cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <div className="flex gap-4">
        {shouldRenderImage ? (
          <div className="relative shrink-0 w-[52px] h-[52px] rounded-lg overflow-hidden border border-slate-200/50 dark:border-white/5">
            <Image
              src={market.image || "/placeholder.svg"}
              alt={market.market_title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="shrink-0 w-[52px] h-[52px] rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 flex items-center justify-center text-slate-400">
            <BarChart3 className="w-6 h-6" />
          </div>
        )}
        
        <div className="flex flex-col flex-1 gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
               {market.category}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              ${market.volume} Vol
            </span>
          </div>
          <h3 className="font-semibold text-base leading-snug text-slate-900 dark:text-slate-100 line-clamp-3 mt-0.5">
            {market.market_title}
          </h3>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <div className="flex-1 rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 flex justify-between items-center transition-all group-hover:bg-blue-50/50 dark:group-hover:bg-[#0041FF]/10 group-hover:border-blue-200 dark:group-hover:border-[#0041FF]/30">
            <span className="text-sm font-semibold text-blue-600 dark:text-[#0041FF]">Yes</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400">{market.yesPercentage}%</span>
        </div>
        <div className="flex-1 rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 flex justify-between items-center transition-all group-hover:bg-red-50/50 dark:group-hover:bg-[#FF0054]/10 group-hover:border-red-200 dark:group-hover:border-[#FF0054]/30">
            <span className="text-sm font-semibold text-red-500 dark:text-[#FF0054]">No</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-700 dark:group-hover:text-red-400">{market.noPercentage}%</span>
        </div>
      </div>
    </article>
  );
};
