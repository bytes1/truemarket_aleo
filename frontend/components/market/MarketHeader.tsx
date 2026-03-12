"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Market } from "@/lib/data";
import { cn } from "@/lib/utils";

type MarketHeaderProps = {
  market: Market;
  details?: {
    mainDescription: string;
    categories: string[] | string;
    sourceLink: string;
    sourceName: string;
  };
};

const categoryTheme = {
  Crypto: "from-amber-400 via-orange-400 to-pink-500",
  Politics: "from-sky-500 via-indigo-400 to-cyan-300",
  Sports: "from-emerald-400 via-teal-400 to-cyan-400",
  Entertainment: "from-fuchsia-500 via-rose-400 to-orange-300",
} as const;

export const MarketHeader = ({ market, details }: MarketHeaderProps) => {
  const accent = categoryTheme[market.category];
  const resolvedDetails = details ?? {
    mainDescription: "",
    categories: [],
    sourceLink: "#",
    sourceName: "Resolution source",
  };
  const sourceHref =
    resolvedDetails.sourceLink !== "#" ? resolvedDetails.sourceLink : null;
  const categories = Array.isArray(resolvedDetails.categories)
    ? resolvedDetails.categories
    : resolvedDetails.categories
    ? [resolvedDetails.categories]
    : [];
  const hasDescription = Boolean(resolvedDetails.mainDescription.trim());
  const hasSource = Boolean(sourceHref);

  return (
    <section className="space-y-4">
      <Link
        href="/market"
        className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition-colors hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to markets
      </Link>

      <div className="relative overflow-hidden rounded-[32px] border border-white/55 bg-slate-950 text-white shadow-[0_28px_70px_-40px_rgba(2,6,23,0.92)]">
        <div className="absolute inset-0">
          {market.image ? (
            <Image
              src={market.image}
              alt={market.market_title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/88 to-sky-950/85" />
          <div
            className={cn(
              "absolute inset-x-0 top-0 h-48 bg-gradient-to-r opacity-35 blur-3xl",
              accent
            )}
          />
          <div className="absolute left-[-6rem] top-[-6rem] h-64 w-64 rounded-full bg-sky-400/16 blur-3xl" />
          <div className="absolute bottom-[-8rem] right-0 h-72 w-72 rounded-full bg-amber-300/14 blur-3xl" />
        </div>

        <div className="relative grid gap-8 p-6 md:p-8 xl:grid-cols-[minmax(0,1.25fr)_340px] xl:p-10">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-xl",
                  "border-white/15 bg-white/10"
                )}
              >
                {market.category}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-xl">
                {market.marketType}
              </span>
              {market.isFlashMarket && (
                <span className="inline-flex items-center rounded-full border border-orange-300/30 bg-orange-300/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-100 backdrop-blur-xl">
                  Flash market
                </span>
              )}
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
                {market.market_title}
              </h1>
              {hasDescription && (
                <p className="max-w-3xl text-base leading-7 text-white/72 md:text-lg">
                  {resolvedDetails.mainDescription.slice(0, 260)}
                  {resolvedDetails.mainDescription.length > 260 ? "..." : ""}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/78 backdrop-blur-xl">
                <CalendarDays className="h-4 w-4" />
                Closes {market.deadline}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/78 backdrop-blur-xl">
                <ShieldCheck className="h-4 w-4" />
                Rule-based resolution
              </div>
            </div>
          </div>

          <div className="surface-muted border-white/12 bg-white/8 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
              Market snapshot
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] border border-white/12 bg-white/8 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/65">Current leaning</p>
                  <div
                    className={cn(
                      "h-2.5 w-2.5 rounded-full bg-gradient-to-r",
                      accent
                    )}
                  />
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                      {market.outcome_a}
                    </p>
                    <p className="font-display text-3xl font-bold">
                      {market.yesPercentage}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                      {market.outcome_b}
                    </p>
                    <p className="font-display text-3xl font-bold text-white/78">
                      {market.noPercentage}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/12 bg-white/8 p-4">
                <div className="flex items-center gap-2 text-sm text-white/65">
                  <CircleDollarSign className="h-4 w-4" />
                  Volume
                </div>
                <p className="mt-3 font-display text-3xl font-bold">
                  {market.currency} {market.volume}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/12 bg-white/8 p-4">
                <div className="flex items-center gap-2 text-sm text-white/65">
                  <Users className="h-4 w-4" />
                  Participants
                </div>
                <p className="mt-3 font-display text-3xl font-bold">
                  {market.participants}
                </p>
              </div>

              {hasSource && (
                <div className="rounded-[24px] border border-white/12 bg-white/8 p-4">
                  <p className="text-sm text-white/65">Resolution source</p>
                  <a
                    href={sourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-sky-200"
                  >
                    {resolvedDetails.sourceName}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>

            {categories.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                  Tagged topics
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/82"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
