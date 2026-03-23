"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { data as allMarkets } from "@/lib/data";
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

  const filteredMarkets = useMemo(() => {
    let filtered = allMarkets;
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (market) => market.category === selectedCategory
      );
    }

    if (normalizedSearch) {
      filtered = filtered.filter((market) => {
        const haystack = `${market.market_title} ${market.market_data}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    const sorted = [...filtered];

    if (sortBy === "newest") {
      sorted.reverse();
    } else {
      sorted.sort((a, b) => {
        const aVolume = parseInt(a.volume, 10) || 0;
        const bVolume = parseInt(b.volume, 10) || 0;
        return bVolume - aVolume;
      });
    }

    return sorted;
  }, [searchTerm, selectedCategory, sortBy]);

  const totalParticipants = useMemo(
    () => allMarkets.reduce((sum, market) => sum + market.participants, 0),
    []
  );
  const flashCount = useMemo(
    () => allMarkets.filter((market) => market.isFlashMarket).length,
    []
  );

  const resetFilters = () => {
    setSelectedCategory("All");
    setSearchTerm("");
  };

  return (
    <div className="space-y-6">
      <BetModeSwitch active="amm" />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="surface-card p-6 md:p-8 relative overflow-hidden">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl text-slate-900 dark:text-white">
            True Markets <span className="text-primary font-mono font-light opacity-80">AMM</span>
          </h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Markets
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {allMarkets.length}
              </p>
            </div>
            <div className="surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Participants
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {totalParticipants}
              </p>
            </div>
            <div className="surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Flash
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {flashCount}
              </p>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search markets"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full rounded border border-slate-200 bg-white dark:border-white/10 dark:bg-[#1C1C1E] px-4 pl-10 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
                />
              </div>
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium">Category</span>
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
                        "inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition-all duration-200",
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium">Sort</span>
              <div className="flex flex-wrap gap-2">
                {sortOptions.map((option) => {
                  const isActive = sortBy === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSortBy(option.value)}
                      className={cn(
                        "rounded border px-4 py-1.5 text-sm transition-all duration-200",
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
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
                className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 px-4 py-1.5 text-sm dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-all"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {filteredMarkets.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
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
        <div className="surface-card flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
          <h3 className="font-display text-2xl font-bold tracking-tight">
            No markets found
          </h3>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/20 hover:shadow-[0_0_20px_rgba(var(--primary),0.2)]"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
