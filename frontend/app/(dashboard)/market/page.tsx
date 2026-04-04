"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import type { LucideIcon } from "lucide-react";
import {
  Bitcoin,
  Globe2,
  Landmark,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  Trophy,
  Tv,
  WandSparkles,
  X,
} from "lucide-react";
import { BetModeSwitch } from "@/components/BetModeSwitch";
import { MarketCard } from "@/components/MarketCard";
import {
  createCustomMarket,
  getStoredMarkets,
  mergeMarkets,
  upsertStoredMarket,
} from "@/lib/custom-markets";
import { data as allMarkets, type Market } from "@/lib/data";
import { cn } from "@/lib/utils";

const MARKET_PROGRAM_ID =
  process.env.NEXT_PUBLIC_MARKET_PROGRAM_ID ?? "true_prediction_market_v3.aleo";
const TOKEN_PROGRAM_ID = "test_usdcx_stablecoin.aleo";
const MARKET_SPENDER_ADDRESS =
  process.env.NEXT_PUBLIC_MARKET_SPENDER_ADDRESS ??
  process.env.NEXT_PUBLIC_MARKET_ADAPTER_ADDRESS ??
  MARKET_PROGRAM_ID;
const TOKEN_DECIMALS = 6;

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

type CreateFormState = {
  title: string;
  category: Exclude<CategoryFilter, "All">;
  outcomeA: string;
  outcomeB: string;
  description: string;
  closeHeight: string;
  initialLiquidity: string;
  sourceLink: string;
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

const defaultCreateForm: CreateFormState = {
  title: "",
  category: "Crypto",
  outcomeA: "YES",
  outcomeB: "NO",
  description: "",
  closeHeight: "",
  initialLiquidity: "",
  sourceLink: "",
};

function parseUnits(value: string, decimals = TOKEN_DECIMALS): bigint {
  if (!value) return 0n;
  const normalized = value.trim();
  if (!normalized) return 0n;
  const [wholeRaw, fracRaw = ""] = normalized.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const fraction = fracRaw.slice(0, decimals).padEnd(decimals, "0");
  if (!/^\d+$/.test(whole) || !/^\d+$/.test(fraction)) return 0n;
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction);
}

function nextMarketId(existingMarkets: Market[]) {
  const highestId = existingMarkets.reduce(
    (currentMax, market) => Math.max(currentMax, market.market_id),
    0
  );
  return highestId + 1;
}

export default function MarketPage() {
  const wallet = useWallet();
  const { connected, address, executeTransaction } = wallet;

  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>("All");
  const [sortBy, setSortBy] = useState<SortBy>("trending");
  const [searchTerm, setSearchTerm] = useState("");
  const [storedMarkets, setStoredMarkets] = useState<Market[]>([]);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateForm);
  const [createStatus, setCreateStatus] = useState("");
  const [isCreatingMarket, setIsCreatingMarket] = useState(false);

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

  const totalParticipants = useMemo(
    () => markets.reduce((sum, market) => sum + market.participants, 0),
    [markets]
  );
  const flashCount = useMemo(
    () => markets.filter((market) => market.isFlashMarket).length,
    [markets]
  );
  const customCount = useMemo(
    () => markets.filter((market) => market.isCustom).length,
    [markets]
  );

  const resetFilters = () => {
    setSelectedCategory("All");
    setSearchTerm("");
  };

  const updateCreateForm = <Key extends keyof CreateFormState>(
    key: Key,
    value: CreateFormState[Key]
  ) => {
    setCreateForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleCreateMarket = async () => {
    if (!connected || !address) {
      setCreateStatus("Connect a wallet to create a market.");
      return;
    }

    const closeHeight = Number(createForm.closeHeight);
    const initialLiquidity = parseUnits(createForm.initialLiquidity);
    if (
      !createForm.title.trim() ||
      !createForm.outcomeA.trim() ||
      !createForm.outcomeB.trim() ||
      !createForm.description.trim()
    ) {
      setCreateStatus("Fill in the market title, outcomes, and rules first.");
      return;
    }
    if (!Number.isInteger(closeHeight) || closeHeight <= 0) {
      setCreateStatus("Enter a valid future block height.");
      return;
    }
    if (initialLiquidity <= 0n) {
      setCreateStatus("Enter a valid initial liquidity amount.");
      return;
    }

    const marketId = nextMarketId(markets);
    const marketField = `${marketId}field`;

    try {
      setIsCreatingMarket(true);
      setCreateStatus("Approving USDCx spending...");
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        inputs: [MARKET_SPENDER_ADDRESS, `${initialLiquidity}u128`],
        fee: 100000,
        privateFee: false,
      });

      setCreateStatus("Creating market on-chain...");
      await executeTransaction({
        program: MARKET_PROGRAM_ID,
        function: "create_market",
        inputs: [marketField, `${closeHeight}u32`, `${initialLiquidity}u64`],
        fee: 180000,
        privateFee: false,
      });

      const customMarket = createCustomMarket({
        marketId,
        title: createForm.title,
        category: createForm.category,
        outcomeA: createForm.outcomeA,
        outcomeB: createForm.outcomeB,
        description: createForm.description,
        closeHeight,
        initialLiquidity,
        creatorAddress: address,
        sourceLink: createForm.sourceLink,
      });
      upsertStoredMarket(customMarket);
      setStoredMarkets((current) => mergeMarkets(current, [customMarket]));
      setCreateForm(defaultCreateForm);
      setCreateStatus("Market created and saved to your dashboard.");
    } catch (error) {
      console.error("Market creation failed:", error);
      setCreateStatus("Market creation failed.");
    } finally {
      setIsCreatingMarket(false);
    }
  };

  return (
    <div className="space-y-6">
      <BetModeSwitch active="amm" />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_460px]">
        <div className="surface-card relative overflow-hidden p-6 md:p-8">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_55%),radial-gradient(circle_at_top_right,rgba(248,113,113,0.14),transparent_50%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/15 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
              <Sparkles className="h-3.5 w-3.5" />
              Creator-ready binary markets
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
              True Markets <span className="font-mono font-light opacity-80 text-primary">AMM</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Spin up custom binary markets, seed them on-chain, and trade private positions.
              Funding and settlement transfers are public today, so this page now calls that out
              directly instead of implying full transaction privacy.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <div className="surface-muted px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Markets
                </p>
                <p className="mt-2 font-display text-3xl font-bold">
                  {markets.length}
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
              <div className="surface-muted px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Custom
                </p>
                <p className="mt-2 font-display text-3xl font-bold">
                  {customCount}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-amber-300/30 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-100">
              <div className="flex gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Privacy boundary</p>
                  <p className="mt-1 leading-6 text-amber-900/80 dark:text-amber-100/80">
                    Position records remain private, but USDCx approvals and token transfers are still
                    public on-chain. This UI now treats privacy as position privacy, not full flow privacy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <WandSparkles className="h-4 w-4" />
            Launch a market
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Title</span>
              <input
                type="text"
                value={createForm.title}
                onChange={(event) => updateCreateForm("title", event.target.value)}
                placeholder="Will Aleo DeFi TVL cross $100M?"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Outcome A</span>
                <input
                  type="text"
                  value={createForm.outcomeA}
                  onChange={(event) => updateCreateForm("outcomeA", event.target.value)}
                  placeholder="YES"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Outcome B</span>
                <input
                  type="text"
                  value={createForm.outcomeB}
                  onChange={(event) => updateCreateForm("outcomeB", event.target.value)}
                  placeholder="NO"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Category</span>
                <select
                  value={createForm.category}
                  onChange={(event) =>
                    updateCreateForm(
                      "category",
                      event.target.value as CreateFormState["category"]
                    )
                  }
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
                >
                  {categories
                    .filter((category) => category !== "All")
                    .map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Close Height</span>
                <input
                  type="number"
                  value={createForm.closeHeight}
                  onChange={(event) => updateCreateForm("closeHeight", event.target.value)}
                  placeholder="15340000"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">Rules and resolution notes</span>
              <textarea
                value={createForm.description}
                onChange={(event) => updateCreateForm("description", event.target.value)}
                placeholder="Describe the exact resolution condition, cancellation criteria, and trusted sources."
                className="h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Seed Liquidity</span>
                <input
                  type="number"
                  value={createForm.initialLiquidity}
                  onChange={(event) =>
                    updateCreateForm("initialLiquidity", event.target.value)
                  }
                  placeholder="100"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Reference Link</span>
                <input
                  type="url"
                  value={createForm.sourceLink}
                  onChange={(event) => updateCreateForm("sourceLink", event.target.value)}
                  placeholder="https://..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleCreateMarket}
              disabled={isCreatingMarket}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-primary/50 bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreatingMarket ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating market
                </>
              ) : (
                "Create market"
              )}
            </button>

            <p className="text-xs leading-5 text-muted-foreground">
              Custom labels are supported here, but the current AMM is still binary under the hood.
              Full multi-outcome markets will need a different pool model.
            </p>

            {createStatus && (
              <div className="rounded-2xl border border-sky-500/15 bg-sky-500/8 px-4 py-3 text-sm font-medium text-sky-700 dark:text-sky-300">
                {createStatus}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl font-bold tracking-tight">
                Browse markets
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Search built-in markets and any creator-launched markets saved in this browser.
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
                  className="h-10 w-full rounded border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E] dark:text-white dark:placeholder:text-slate-500"
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
                          ? "border-primary bg-primary/10 font-medium text-primary"
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
                          ? "border-primary bg-primary/10 font-medium text-primary"
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
                className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 transition-all hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
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
