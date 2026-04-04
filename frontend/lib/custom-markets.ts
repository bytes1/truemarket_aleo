"use client";

import type { Market } from "@/lib/data";

const STORAGE_KEY = "true-markets.custom-markets";

export type CustomMarketInput = {
  marketId: number;
  title: string;
  category: Market["category"];
  outcomeA: string;
  outcomeB: string;
  description: string;
  closeHeight: number;
  initialLiquidity: bigint;
  creatorAddress?: string;
  sourceLink?: string;
};

function formatAtomicUnits(value: bigint, decimals = 6) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, 2)
    .replace(/0+$/, "");
  return `${whole.toString()}${fractionStr ? `.${fractionStr}` : ""}`;
}

function buildMarketData(input: CustomMarketInput) {
  const lines = [
    input.description.trim(),
    "",
    "**Market Rules:**",
    `- Outcome A: ${input.outcomeA}`,
    `- Outcome B: ${input.outcomeB}`,
    `- Close height: ${input.closeHeight}`,
    `- Seed liquidity: ${formatAtomicUnits(input.initialLiquidity)} USDCx`,
  ];

  if (input.sourceLink?.trim()) {
    lines.push(`- Reference: ${input.sourceLink.trim()}`);
  }

  return lines.join("\n");
}

export function createCustomMarket(input: CustomMarketInput): Market {
  return {
    market_id: input.marketId,
    market_title: input.title.trim(),
    category: input.category,
    outcome_a: input.outcomeA.trim(),
    outcome_b: input.outcomeB.trim(),
    yesPercentage: 50,
    noPercentage: 50,
    volume: formatAtomicUnits(input.initialLiquidity),
    participants: input.creatorAddress ? 1 : 0,
    deadline: `Block ${input.closeHeight}`,
    marketType: "Custom Binary",
    currency: "USDCx",
    market_data: buildMarketData(input),
    image: "",
    cardStyle: "text",
    creatorAddress: input.creatorAddress?.trim(),
    closeHeight: input.closeHeight,
    sourceLink: input.sourceLink?.trim(),
    isCustom: true,
  };
}

export function getStoredMarkets() {
  if (typeof window === "undefined") {
    return [] as Market[];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [] as Market[];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Market[]) : [];
  } catch {
    return [] as Market[];
  }
}

export function saveStoredMarkets(markets: Market[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(markets));
}

export function upsertStoredMarket(market: Market) {
  const existing = getStoredMarkets().filter(
    (entry) => entry.market_id !== market.market_id
  );
  saveStoredMarkets([market, ...existing]);
}

export function mergeMarkets(baseMarkets: Market[], storedMarkets: Market[]) {
  const merged = new Map<number, Market>();

  for (const market of baseMarkets) {
    merged.set(market.market_id, market);
  }

  for (const market of storedMarkets) {
    merged.set(market.market_id, market);
  }

  return [...merged.values()];
}
