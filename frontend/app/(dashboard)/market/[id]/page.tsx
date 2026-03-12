"use client";

import { useMemo } from "react";
import { notFound, useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { MarketChart } from "@/components/market/MarketChart";
import { MarketHeader } from "@/components/market/MarketHeader";
import { MarketOpinions } from "@/components/market/MarketOpinions";
import { MarketRules } from "@/components/market/MarketRules";
import { TradeCard } from "@/components/market/TradeCard";
import { data as allMarkets } from "@/lib/data";

function getMarketById(id: string) {
  return allMarkets.find((market) => market.market_id.toString() === id);
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s)>]+/i)?.[0] ?? "";
}

function parseMarketData(dataString: string, fallbackCategory: string) {
  try {
    const mainDescription = dataString
      .split(/âŸ|␟|Ã¢ÂÅ¸/)
      .filter(Boolean)[0]
      ?.trim();

    const sourceLink = extractFirstUrl(dataString) || "#";
    const sourceName =
      sourceLink !== "#"
        ? sourceLink.replace(/^https?:\/\//, "").replace(/\/$/, "")
        : "Resolution source";

    return {
      mainDescription: mainDescription || "",
      categories: mainDescription ? [fallbackCategory] : [],
      sourceLink,
      sourceName,
    };
  } catch (error) {
    console.error("Failed to parse market data:", error);
    return {
      mainDescription: "",
      categories: [],
      sourceLink: "#",
      sourceName: "Resolution source",
    };
  }
}

export default function MarketPage() {
  const params = useParams();
  const id = params?.id as string;

  const market = useMemo(() => (id ? getMarketById(id) : null), [id]);

  if (!market) {
    notFound();
  }

  const details = parseMarketData(market.market_data, market.category);

  return (
    <div className="space-y-6">
      <MarketHeader market={market} details={details} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="surface-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Verification
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Rule-based resolution</p>
                  <p className="text-sm text-muted-foreground">
                    Outcome follows the written market terms and listed source.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Liquidity
              </p>
              <p className="mt-4 font-display text-3xl font-bold tracking-tight">
                {market.currency} {market.volume}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Current displayed market volume on this listing.
              </p>
            </div>

            <div className="surface-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Participation
              </p>
              <p className="mt-4 font-display text-3xl font-bold tracking-tight">
                {market.participants}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Represented participants following this market so far.
              </p>
            </div>
          </section>

          <MarketChart market={market} />
          <MarketRules details={details} />
          <MarketOpinions marketTitle={market.market_title} />
        </div>

        <div className="space-y-6">
          <TradeCard market={market} />
        </div>
      </div>
    </div>
  );
}
