import Image from "next/image";
import { BarChart3, Sparkles, TrendingUp } from "lucide-react";
import type { Market } from "@/lib/data";

function compactLabel(value: string) {
  return value.length > 12 ? `${value.slice(0, 11)}…` : value;
}

const categoryColors: Record<string, string> = {
  Crypto: "#6366f1",
  Politics: "#ec4899",
  Sports: "#f59e0b",
  Entertainment: "#8b5cf6",
};

export const MarketCard = ({ market }: { market: Market }) => {
  const shouldRenderImage = Boolean(market.image);
  const catColor = categoryColors[market.category] ?? "#6366f1";

  return (
    <article
      className="surface-card surface-card-hover relative flex h-full flex-col justify-between group cursor-pointer overflow-hidden"
      style={{ padding: 0 }}
    >
      {/* Top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${catColor}80, transparent)` }}
      />

      {/* Flash market badge */}
      {market.isFlashMarket && (
        <div
          className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white"
          style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", boxShadow: "0 4px 12px -2px rgba(239,68,68,0.4)" }}
        >
          ⚡ Flash
        </div>
      )}

      {/* Image / icon section */}
      <div className="relative">
        {shouldRenderImage ? (
          <div className="relative h-[140px] w-full overflow-hidden">
            <Image
              src={market.image || "/placeholder.svg"}
              alt={market.market_title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              unoptimized
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(5,5,10,0.85) 100%)" }} />
          </div>
        ) : (
          <div className="flex h-[100px] w-full items-center justify-center"
            style={{ background: `radial-gradient(ellipse at center, ${catColor}15 0%, transparent 70%)` }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border"
              style={{ borderColor: `${catColor}20`, background: `${catColor}10` }}>
              <BarChart3 size={24} style={{ color: catColor }} className="transition-transform duration-300 group-hover:scale-110" />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{ background: `${catColor}12`, border: `1px solid ${catColor}25`, color: catColor }}
            >
              {market.category}
              {market.isCustom && <Sparkles size={8} />}
            </span>
            {market.isClosed && (
              <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                Closed
              </span>
            )}
          </div>
          <span className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold font-mono"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#94a3b8" }}>
            {market.currency} {market.volume}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display text-sm font-semibold leading-snug text-foreground line-clamp-3 flex-1">
          {market.market_title}
        </h3>

        {/* Deadline */}
        {market.deadline && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Closes:</span>
            <span className="font-semibold text-foreground/70">{market.deadline}</span>
          </div>
        )}

        {/* Outcome bars */}
        <div className="mt-auto flex gap-1.5">
          <div
            className="relative flex flex-1 items-center justify-between overflow-hidden rounded-lg px-2.5 py-2 transition-all duration-300 group/yes"
            style={{
              background: "rgba(99,102,241,0.07)",
              border: "1px solid rgba(99,102,241,0.15)",
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover/yes:opacity-100 transition-opacity duration-300"
              style={{ background: "rgba(99,102,241,0.12)" }}
            />
            <span className="relative z-10 text-[11px] font-semibold" style={{ color: "#818cf8" }}>
              {compactLabel(market.outcome_a)}
            </span>
            <div className="relative z-10 flex items-center gap-0.5">
              <TrendingUp size={9} style={{ color: "#818cf8" }} />
              <span className="text-xs font-black" style={{ color: "#a5b4fc" }}>
                {market.yesPercentage}%
              </span>
            </div>
          </div>

          <div
            className="relative flex flex-1 items-center justify-between overflow-hidden rounded-lg px-2.5 py-2 transition-all duration-300 group/no"
            style={{
              background: "rgba(6,182,212,0.07)",
              border: "1px solid rgba(6,182,212,0.15)",
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover/no:opacity-100 transition-opacity duration-300"
              style={{ background: "rgba(6,182,212,0.12)" }}
            />
            <span className="relative z-10 text-[11px] font-semibold" style={{ color: "#22d3ee" }}>
              {compactLabel(market.outcome_b)}
            </span>
            <span className="relative z-10 text-xs font-black" style={{ color: "#67e8f9" }}>
              {market.noPercentage}%
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
