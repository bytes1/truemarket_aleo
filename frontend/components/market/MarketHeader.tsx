"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  Users,
} from "lucide-react";
import type { Market } from "@/lib/data";

type MarketHeaderProps = {
  market: Market;
  details?: {
    mainDescription: string;
    categories: string[] | string;
    sourceLink: string;
    sourceName: string;
  };
};

export const MarketHeader = ({ market, details }: MarketHeaderProps) => {
  const resolvedDetails = details ?? {
    mainDescription: "",
    categories: [],
    sourceLink: "#",
    sourceName: "Resolution source",
  };
  const sourceHref =
    resolvedDetails.sourceLink !== "#" ? resolvedDetails.sourceLink : undefined;
  const categories = Array.isArray(resolvedDetails.categories)
    ? resolvedDetails.categories
    : resolvedDetails.categories
    ? [resolvedDetails.categories]
    : [];
  const hasSource = Boolean(sourceHref);

  return (
    <section className="space-y-4">
      <Link
        href="/market"
        className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition-colors hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
            {market.category}
          </span>
          <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
            {market.marketType}
          </span>
          {market.isCustom && (
            <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              Creator market
            </span>
          )}
          {market.isFlashMarket && (
            <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
              Flash
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              {market.market_title}
            </h1>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                <CalendarDays className="h-4 w-4" />
                {market.deadline}
              </div>
              {market.creatorAddress && (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                  Creator {market.creatorAddress.slice(0, 10)}...
                </div>
              )}
            </div>

            {categories.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="surface-muted p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{market.outcome_a}</span>
                <span>{market.outcome_b}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div className="flex h-full">
                  <div
                    className="h-full bg-slate-900 dark:bg-white"
                    style={{ width: `${market.yesPercentage}%` }}
                  />
                  <div
                    className="h-full bg-slate-300 dark:bg-white/25"
                    style={{ width: `${market.noPercentage}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xl font-semibold">
                <span>{market.yesPercentage}%</span>
                <span>{market.noPercentage}%</span>
              </div>
            </div>

            <div className="surface-muted p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleDollarSign className="h-4 w-4" />
                Volume
              </div>
              <p className="mt-2 font-display text-2xl font-bold">
                {market.currency} {market.volume}
              </p>
            </div>

            <div className="surface-muted p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Participants
              </div>
              <p className="mt-2 font-display text-2xl font-bold">
                {market.participants}
              </p>
            </div>

            {hasSource && (
              <div className="surface-muted p-4">
                <p className="text-sm text-muted-foreground">Source</p>
                <a
                  href={sourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:text-sky-600 dark:hover:text-sky-300"
                >
                  {resolvedDetails.sourceName}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
