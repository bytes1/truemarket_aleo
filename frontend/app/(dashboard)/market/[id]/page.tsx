"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { MarketChart } from "@/components/market/MarketChart";
import { MarketHeader } from "@/components/market/MarketHeader";
import { MarketRules } from "@/components/market/MarketRules";
import { TradeCard } from "@/components/market/TradeCard";
import { getStoredMarkets, mergeMarkets } from "@/lib/custom-markets";
import { OraclePanel } from "@/components/market/OraclePanel";
import { data as allMarkets } from "@/lib/data";
import { Scale, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

function getMarketById(id: string, storedMarkets = getStoredMarkets()) {
  return mergeMarkets(allMarkets, storedMarkets).find(
    (market) => market.market_id.toString() === id
  );
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s)>]+/i)?.[0] ?? "";
}

function parseMarketData(
  dataString: string,
  fallbackCategory: string,
  fallbackSourceLink?: string
) {
  try {
    const mainDescription = dataString
      .split(/â Ÿ|␟|Ã¢Â Å¸/)
      .filter(Boolean)[0]
      ?.trim();

    const sourceLink = extractFirstUrl(dataString) || fallbackSourceLink || "#";
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

type RightPanelTab = "trade" | "oracle";

export default function MarketPage() {
  const params = useParams();
  const id = params?.id as string;
  const [storedMarkets, setStoredMarkets] = useState(() => getStoredMarkets());
  const [rightTab, setRightTab] = useState<RightPanelTab>("trade");

  useEffect(() => {
    setStoredMarkets(getStoredMarkets());
  }, []);

  const market = useMemo(
    () => (id ? getMarketById(id, storedMarkets) : null),
    [id, storedMarkets]
  );

  if (!market) {
    notFound();
  }

  const details = parseMarketData(
    market.market_data,
    market.category,
    market.sourceLink
  );

  const tabs: Array<{ id: RightPanelTab; label: string; icon: typeof TrendingUp }> = [
    { id: "trade", label: "Trade", icon: TrendingUp },
    { id: "oracle", label: "Oracle", icon: Scale },
  ];

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Market header hero */}
      <MarketHeader market={market} details={details} />

      {/* Two-column grid */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left column: chart + rules */}
        <div className="space-y-5">
          <MarketChart market={market} />
          <MarketRules details={details} />
        </div>

        {/* Right column: trade/oracle panel */}
        <div className="space-y-4">
          {/* Tab switcher */}
          <div
            className="flex items-center gap-1 rounded-2xl p-1"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {tabs.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setRightTab(tabId)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200"
                )}
                style={
                  rightTab === tabId
                    ? {
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "#fff",
                      boxShadow: "0 4px 16px -4px rgba(99,102,241,0.6)",
                    }
                    : { color: "#94a3b8" }
                }
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          {rightTab === "trade" ? (
            <TradeCard market={market} />
          ) : (
            <OraclePanel market={market} />
          )}
        </div>
      </div>
    </div>
  );
}
