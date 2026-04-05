"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bitcoin,
  Globe2,
  Landmark,
  Search,
  Trophy,
  Tv,
  X,
} from "lucide-react";
import { BetModeSwitch } from "@/components/BetModeSwitch";
import { MarketCard } from "@/components/MarketCard";
import {
  getStoredMarkets,
  mergeMarkets,
} from "@/lib/custom-markets";
import { data as allMarkets, type Market } from "@/lib/data";
import { cn } from "@/lib/utils";

type CategoryFilter =
  | "All"
  | "Crypto"
  | "Politics"
  | "Sports"
  | "Entertainment";

type SortBy = "newest" | "trending" | "volume";

type CategoryConfig = {
  icon: LucideIcon;
};

const categoryConfig: Record<CategoryFilter, CategoryConfig> = {
  All: { icon: Globe2 },
  Crypto: { icon: Bitcoin },
  Politics: { icon: Landmark },
  Sports: { icon: Trophy },
  Entertainment: { icon: Tv },
};

const sortOptions: Array<{ value: SortBy; label: string }> = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "volume", label: "Volume" },
];

const categories = Object.keys(categoryConfig) as CategoryFilter[];

export default function MarketPage() {
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>("All");
  const [sortBy, setSortBy] = useState<SortBy>("trending");
  const [searchTerm, setSearchTerm] = useState("");
  const [storedMarkets, setStoredMarkets] = useState<Market[]>([]);

  useEffect(() => {
    setStoredMarkets(getStoredMarkets());
  }, []);

  const markets = useMemo(
    () => mergeMarkets(allMarkets, storedMarkets),
    [storedMarkets]
  );

  const filteredMarkets = useMemo(() => {
    let filtered = markets;
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (market) => market.category === selectedCategory
      );
    }

    if (normalizedSearch) {
      filtered = filtered.filter((market) => {
        const haystack =
          `${market.market_title} ${market.market_data} ${market.outcome_a} ${market.outcome_b}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    const sorted = [...filtered];

    if (sortBy === "newest") {
      sorted.sort((a, b) => b.market_id - a.market_id);
    } else {
      sorted.sort((a, b) => {
        const aVolume = parseFloat(a.volume) || 0;
        const bVolume = parseFloat(b.volume) || 0;
        return sortBy === "volume" ? bVolume - aVolume : b.market_id - a.market_id;
      });
    }

    return sorted;
  }, [markets, searchTerm, selectedCategory, sortBy]);

  const resetFilters = () => {
    setSelectedCategory("All");
    setSearchTerm("");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <BetModeSwitch active="amm" />
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="surface-card p-6 xl:col-span-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 space-y-5">
            <label className="block max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E] dark:text-white dark:placeholder:text-slate-500"
                />
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Category:</span>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const Icon = categoryConfig[category].icon;
                    const isActive = selectedCategory === category;

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-all duration-200",
                          isActive
                            ? "border-primary bg-primary/10 font-medium text-primary shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden md:block" />

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Sort by:</span>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((option) => {
                    const isActive = sortBy === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSortBy(option.value)}
                        className={cn(
                          "rounded-xl border px-4 py-1.5 text-sm transition-all duration-200",
                          isActive
                            ? "border-primary bg-primary/10 font-medium text-primary shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(selectedCategory !== "All" || searchTerm) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 transition-all hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200 ml-auto"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {filteredMarkets.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
          {filteredMarkets.map((market) => (
            <Link
              key={market.market_id}
              href={`/market/${market.market_id}`}
              className="outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            >
              <MarketCard market={market} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="surface-card flex min-h-[300px] flex-col items-center justify-center p-8 text-center rounded-2xl">
          <h3 className="font-display text-2xl font-bold tracking-tight">
            No markets found
          </h3>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">
            Try adjusting your search or filters. You can also create your own custom market using the Create Market tab.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-6 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-primary/20"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
