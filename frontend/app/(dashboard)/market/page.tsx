"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bitcoin,
  Flame,
  Globe2,
  Landmark,
  Search,
  Sparkles,
  Trophy,
  Tv,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { AIChat } from "@/components/AIChat";
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
  description: string;
  icon: LucideIcon;
  accent: string;
  chipClassName: string;
};

const categoryConfig: Record<CategoryFilter, CategoryConfig> = {
  All: {
    description: "Scan every active market",
    icon: Globe2,
    accent: "from-slate-900/80 via-sky-600/70 to-cyan-400/70",
    chipClassName:
      "border-slate-300/70 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
  },
  Crypto: {
    description: "Bitcoin, ETH, macro, and token narratives",
    icon: Bitcoin,
    accent: "from-amber-400 via-orange-400 to-pink-500",
    chipClassName:
      "border-amber-300/40 bg-amber-300/14 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100",
  },
  Politics: {
    description: "Power shifts, elections, and global policy",
    icon: Landmark,
    accent: "from-sky-500 via-indigo-400 to-cyan-300",
    chipClassName:
      "border-sky-300/40 bg-sky-300/14 text-sky-900 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100",
  },
  Sports: {
    description: "Score races, title runs, and big upsets",
    icon: Trophy,
    accent: "from-emerald-400 via-teal-400 to-cyan-400",
    chipClassName:
      "border-emerald-300/40 bg-emerald-300/14 text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100",
  },
  Entertainment: {
    description: "Culture moments, launches, and blockbuster bets",
    icon: Tv,
    accent: "from-fuchsia-500 via-rose-400 to-orange-300",
    chipClassName:
      "border-fuchsia-300/40 bg-fuchsia-300/14 text-fuchsia-900 dark:border-fuchsia-300/20 dark:bg-fuchsia-300/10 dark:text-fuchsia-100",
  },
};

const sortOptions: Array<{
  value: SortBy;
  label: string;
  description: string;
}> = [
  {
    value: "trending",
    label: "Trending",
    description: "Most active volume first",
  },
  {
    value: "newest",
    label: "Newest",
    description: "Freshly added markets",
  },
  {
    value: "volume",
    label: "Volume",
    description: "Highest notional traded",
  },
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
  const activeFilters =
    Number(selectedCategory !== "All") + Number(Boolean(searchTerm));
  const SelectedCategoryIcon =
    selectedCategory !== "All" ? categoryConfig[selectedCategory].icon : null;

  const resetFilters = () => {
    setSelectedCategory("All");
    setSearchTerm("");
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/55 bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-950 p-6 text-white shadow-[0_28px_70px_-40px_rgba(2,6,23,0.9)] md:p-8 lg:p-10">
        <div className="section-grid absolute inset-0 opacity-15" />
        <div className="absolute inset-y-0 right-[-10%] w-[40%] bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.34),transparent_58%)]" />
        <div className="absolute left-[-8rem] top-[-10rem] h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-1/4 h-64 w-64 rounded-full bg-cyan-300/16 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="eyebrow border-white/15 bg-white/10 text-white">
              <Sparkles className="h-3.5 w-3.5" />
              True Markets on Aleo
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl xl:text-6xl">
                Explore verifiable prediction markets built for real conviction.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                Discover True Markets questions across crypto and beyond, track
                where the crowd is leaning, and enter markets through a cleaner
                onchain experience designed for fast decisions.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-muted border-white/12 bg-white/9 p-4 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-white/55">
                  Live markets
                </p>
                <p className="mt-3 font-display text-3xl font-bold">
                  {allMarkets.length}
                </p>
                <p className="mt-1 text-sm text-white/62">
                  Always-on discovery board
                </p>
              </div>
              <div className="surface-muted border-white/12 bg-white/9 p-4 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-white/55">
                  Participants
                </p>
                <p className="mt-3 font-display text-3xl font-bold">
                  {totalParticipants}
                </p>
                <p className="mt-1 text-sm text-white/62">
                  Total positions represented
                </p>
              </div>
              <div className="surface-muted border-white/12 bg-white/9 p-4 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-white/55">
                  Flash setups
                </p>
                <p className="mt-3 font-display text-3xl font-bold">
                  {flashCount}
                </p>
                <p className="mt-1 text-sm text-white/62">
                  Fast markets worth watching
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="#market-grid"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform duration-200 hover:-translate-y-0.5"
              >
                Browse markets
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/faucet"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/12"
              >
                Grab faucet funds
              </Link>
            </div>
          </div>

          <div className="surface-card relative overflow-hidden p-5 text-foreground md:p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/88 to-sky-50/88 dark:from-slate-950/85 dark:via-slate-900/86 dark:to-sky-950/48" />
            <div className="relative space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-sky-700 dark:text-sky-300">
                    Discovery controls
                  </p>
                  <h2 className="font-display text-2xl font-bold tracking-tight">
                    Shape the tape
                  </h2>
                </div>
                <div className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-sky-200">
                  {activeFilters} active
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Search
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search markets, contexts, outcomes..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200/80 bg-white/92 px-4 pl-11 text-sm outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
              </label>

              <div>
                <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Categories
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => {
                    const config = categoryConfig[category];
                    const Icon = config.icon;
                    const isActive = selectedCategory === category;

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                          "rounded-[22px] border p-3 text-left transition-all duration-200",
                          isActive
                            ? "border-transparent bg-slate-950 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.85)] dark:bg-white dark:text-slate-950"
                            : config.chipClassName
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm",
                              config.accent
                            )}
                          >
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold">{category}</p>
                            <p
                              className={cn(
                                "mt-1 text-xs leading-5",
                                isActive
                                  ? "text-white/70 dark:text-slate-700"
                                  : "text-muted-foreground"
                              )}
                            >
                              {config.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Sort by
                </span>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((option) => {
                    const isActive = sortBy === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSortBy(option.value)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "border-transparent bg-slate-950 text-white shadow-[0_16px_30px_-22px_rgba(15,23,42,0.9)] dark:bg-white dark:text-slate-950"
                            : "border-slate-200/80 bg-white/88 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/8"
                        )}
                        title={option.description}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/8"
                >
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">
                <TrendingUp className="h-3.5 w-3.5" />
                Live board
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                Markets built for quick reads
              </h2>
              <p className="mt-2 text-base text-muted-foreground">
                Showing {filteredMarkets.length} of {allMarkets.length} markets
                {searchTerm ? ` for "${searchTerm}"` : ""}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedCategory !== "All" && (
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium",
                    categoryConfig[selectedCategory].chipClassName
                  )}
                >
                  {SelectedCategoryIcon && (
                    <SelectedCategoryIcon className="h-4 w-4" />
                  )}
                  {selectedCategory}
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/75 px-3 py-2 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
                <Users className="h-4 w-4 text-sky-500" />
                {totalParticipants} represented participants
              </span>
              {flashCount > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  <Flame className="h-4 w-4" />
                  {flashCount} flash setups
                </span>
              )}
            </div>
          </div>

          {filteredMarkets.length > 0 ? (
            <div
              id="market-grid"
              className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3"
            >
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
            <div className="surface-card flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 rounded-full bg-sky-500/10 p-4 text-sky-700 dark:text-sky-200">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="font-display text-2xl font-bold tracking-tight">
                No markets match this view
              </h3>
              <p className="mt-3 max-w-md text-muted-foreground">
                Try loosening the search, switching categories, or jumping back
                to the full market board.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
              >
                Reset view
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <aside className="surface-card hidden h-fit p-6 xl:block">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sky-700 dark:text-sky-300">
                Market radar
              </p>
              <h3 className="font-display text-2xl font-bold tracking-tight">
                Category pulse
              </h3>
            </div>
            <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white dark:bg-white dark:text-slate-950">
              Snapshot
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {categories
              .filter((category) => category !== "All")
              .map((category) => {
                const config = categoryConfig[category];
                const count = allMarkets.filter(
                  (market) => market.category === category
                ).length;
                const percentage = allMarkets.length
                  ? Math.max((count / allMarkets.length) * 100, 8)
                  : 0;
                const Icon = config.icon;

                return (
                  <div
                    key={category}
                    className="rounded-[22px] border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white",
                            config.accent
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="font-semibold">{category}</p>
                          <p className="text-xs text-muted-foreground">
                            {count} active market{count === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {Math.round((count / allMarkets.length) * 100) || 0}%
                      </p>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r", config.accent)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </aside>
      </section>

      <AIChat />
    </div>
  );
}
