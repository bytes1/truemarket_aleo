"use client";

import { useState, useMemo, useEffect } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import type { LucideIcon } from "lucide-react";
import {
  Bitcoin,
  Globe2,
  Landmark,
  Loader2,
  Trophy,
  Tv,
  WandSparkles,
  Rocket
} from "lucide-react";
import {
  createCustomMarket,
  getStoredMarkets,
  mergeMarkets,
  upsertStoredMarket,
} from "@/lib/custom-markets";
import { data as allMarkets, type Market } from "@/lib/data";

const MARKET_PROGRAM_ID =
  process.env.NEXT_PUBLIC_MARKET_PROGRAM_ID ?? "true_prediction_market_v4.aleo";
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
  oracleStake: string;
  sourceLink: string;
};

const categoryConfig: Record<CategoryFilter, CategoryConfig> = {
  All: { icon: Globe2 },
  Crypto: { icon: Bitcoin },
  Politics: { icon: Landmark },
  Sports: { icon: Trophy },
  Entertainment: { icon: Tv },
};

const categories = Object.keys(categoryConfig) as CategoryFilter[];

const defaultCreateForm: CreateFormState = {
  title: "",
  category: "Crypto",
  outcomeA: "YES",
  outcomeB: "NO",
  description: "",
  closeHeight: "",
  initialLiquidity: "",
  oracleStake: "100", // Default 10 USDCx bond
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

export default function CreateMarketPage() {
  const wallet = useWallet();
  const { connected, address, executeTransaction } = wallet;

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
    const bondAmount = parseUnits(createForm.oracleStake);
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
    if (bondAmount <= 0n) {
      setCreateStatus("Enter a valid oracle bond amount.");
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
        inputs: [marketField, `${closeHeight}u32`, `${initialLiquidity}u64`, `${bondAmount}u64`],
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
      setCreateStatus("Market created successfully! Return to Markets to view.");
    } catch (error) {
      console.error("Market creation failed:", error);
      setCreateStatus("Market creation failed.");
    } finally {
      setIsCreatingMarket(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="mb-8">
        <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Create Market
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Design your own binary market, fund the initial liquidity pool natively, and open it for public trading.
        </p>
      </div>

      <div className="surface-card p-6 md:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <WandSparkles className="h-4 w-4" />
          Market configuration
        </div>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Title</span>
            <input
              type="text"
              value={createForm.title}
              onChange={(event) => updateCreateForm("title", event.target.value)}
              placeholder="Will Aleo DeFi TVL cross $100M?"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Outcome A</span>
              <input
                type="text"
                value={createForm.outcomeA}
                onChange={(event) => updateCreateForm("outcomeA", event.target.value)}
                placeholder="YES"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Outcome B</span>
              <input
                type="text"
                value={createForm.outcomeB}
                onChange={(event) => updateCreateForm("outcomeB", event.target.value)}
                placeholder="NO"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
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
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E] appearance-none"
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
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Rules and resolution notes</span>
            <textarea
              value={createForm.description}
              onChange={(event) => updateCreateForm("description", event.target.value)}
              placeholder="Describe the exact resolution condition, cancellation criteria, and trusted sources."
              className="h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Seed Liquidity (USDCx)</span>
              <input
                type="number"
                value={createForm.initialLiquidity}
                onChange={(event) =>
                  updateCreateForm("initialLiquidity", event.target.value)
                }
                placeholder="100"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Oracle Stake (USDCx)</span>
              <input
                type="number"
                value={createForm.oracleStake}
                onChange={(event) =>
                  updateCreateForm("oracleStake", event.target.value)
                }
                placeholder="10"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Reference Link</span>
              <input
                type="url"
                value={createForm.sourceLink}
                onChange={(event) => updateCreateForm("sourceLink", event.target.value)}
                placeholder="https://..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/50 dark:border-white/10 dark:bg-[#1C1C1E]"
              />
            </label>
            <div className="hidden sm:block"></div>
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={handleCreateMarket}
              disabled={isCreatingMarket}
              className="inline-flex h-14 w-full items-center justify-center rounded-xl border border-primary/50 bg-primary text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreatingMarket ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Deploying to Network
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-5 w-5" />
                  Launch Market
                </>
              )}
            </button>
          </div>

          {createStatus && (
            <div className="mt-4 rounded-xl border border-sky-500/15 bg-sky-500/8 px-4 py-3 text-sm font-medium text-sky-700 dark:text-sky-300">
              {createStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
