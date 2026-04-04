"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { MarketChart } from "@/components/market/MarketChart";
import { MarketHeader } from "@/components/market/MarketHeader";
import { MarketRules } from "@/components/market/MarketRules";
import { TradeCard } from "@/components/market/TradeCard";
import { getStoredMarkets, mergeMarkets } from "@/lib/custom-markets";
import { data as allMarkets } from "@/lib/data";

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
      .split(/âŸ|␟|Ã¢ÂÅ¸/)
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

export default function MarketPage() {
  const params = useParams();
  const id = params?.id as string;
  const [storedMarkets, setStoredMarkets] = useState(() => getStoredMarkets());

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

  return (
    <div className="space-y-6">
      <MarketHeader market={market} details={details} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <MarketChart market={market} />
          <MarketRules details={details} />
        </div>

        <div className="space-y-6">
          <TradeCard market={market} />
        </div>
      </div>
    </div>
  );
}
