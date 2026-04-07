"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  ExternalLink,
  Users,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
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

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  Crypto: { bg: "rgba(99,102,241,0.1)", text: "#818cf8", border: "rgba(99,102,241,0.25)" },
  Politics: { bg: "rgba(236,72,153,0.1)", text: "#f472b6", border: "rgba(236,72,153,0.25)" },
  Sports: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24", border: "rgba(245,158,11,0.25)" },
  Entertainment: { bg: "rgba(139,92,246,0.1)", text: "#c084fc", border: "rgba(139,92,246,0.25)" },
  Macro: { bg: "rgba(6,182,212,0.1)", text: "#22d3ee", border: "rgba(6,182,212,0.25)" },
  Aleo: { bg: "rgba(16,185,129,0.1)", text: "#34d399", border: "rgba(16,185,129,0.25)" },
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
  const hasSource = Boolean(sourceHref);
  const cat = categoryColors[market.category] ?? categoryColors.Crypto;

  const yesLeading = market.yesPercentage >= market.noPercentage;
  const spread = Math.abs(market.yesPercentage - market.noPercentage);

  return (
    <section className="space-y-4">
      {/* Back nav */}
      <Link
        href="/market"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        All Markets
      </Link>

      {/* Hero banner */}
      <div
        className="surface-card overflow-hidden"
        style={{ padding: 0 }}
      >
        {/* Image banner (if available) */}
        {market.image && (
          <div className="relative h-[200px] w-full overflow-hidden">
            <Image
              src={market.image}
              alt={market.market_title}
              fill
              className="object-cover"
              unoptimized
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(5,5,10,0.2) 0%, rgba(5,5,10,0.85) 100%)",
              }}
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text }}
            >
              {market.category}
            </span>
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#94a3b8",
              }}
            >
              {market.marketType}
            </span>
            {market.isCustom && (
              <span
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  color: "#818cf8",
                }}
              >
                Creator market
              </span>
            )}
            {market.isFlashMarket && (
              <span
                className="inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                  boxShadow: "0 2px 12px -2px rgba(239,68,68,0.4)",
                }}
              >
                ⚡ Flash
              </span>
            )}
            {market.isClosed && (
              <span
                className="inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#f87171",
                }}
              >
                Resolved
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="font-display text-2xl font-bold tracking-tight leading-snug md:text-3xl lg:text-4xl max-w-3xl">
            {market.market_title}
          </h1>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground/80">{market.deadline}</span>
            </div>

            {market.creatorAddress && (
              <div
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-foreground/70">
                  {market.creatorAddress.slice(0, 10)}…{market.creatorAddress.slice(-6)}
                </span>
              </div>
            )}

            {hasSource && (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition-all duration-200 hover:scale-105"
                style={{
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.18)",
                  color: "#818cf8",
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="font-medium text-xs">
                  {resolvedDetails.sourceName.split("/")[0].slice(0, 24)}
                </span>
              </a>
            )}
          </div>

          {/* Probability + stats row */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* YES probability */}
            <div
              className="relative overflow-hidden rounded-2xl p-4"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.18)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#818cf8" }}>
                  {market.outcome_a}
                </p>
                {yesLeading ? (
                  <TrendingUp size={14} style={{ color: "#818cf8" }} />
                ) : (
                  <TrendingDown size={14} style={{ color: "#818cf8", opacity: 0.5 }} />
                )}
              </div>
              <p className="font-display text-4xl font-bold" style={{ color: "#a5b4fc" }}>
                {market.yesPercentage}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-widest">
                probability
              </p>
            </div>

            {/* NO probability */}
            <div
              className="relative overflow-hidden rounded-2xl p-4"
              style={{
                background: "rgba(6,182,212,0.07)",
                border: "1px solid rgba(6,182,212,0.18)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>
                  {market.outcome_b}
                </p>
                {!yesLeading ? (
                  <TrendingUp size={14} style={{ color: "#22d3ee" }} />
                ) : (
                  <TrendingDown size={14} style={{ color: "#22d3ee", opacity: 0.5 }} />
                )}
              </div>
              <p className="font-display text-4xl font-bold" style={{ color: "#67e8f9" }}>
                {market.noPercentage}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-widest">
                probability
              </p>
            </div>

            {/* Volume */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <CircleDollarSign size={12} className="text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Volume
                </p>
              </div>
              <p className="font-display text-4xl font-bold">
                {market.volume}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-widest">
                {market.currency}
              </p>
            </div>

            {/* Participants */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={12} className="text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Participants
                </p>
              </div>
              <p className="font-display text-4xl font-bold">
                {market.participants}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-widest">
                traders
              </p>
            </div>
          </div>

          {/* Probability bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2">
              <span style={{ color: "#818cf8" }}>{market.outcome_a} {market.yesPercentage}%</span>
              {spread > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {spread}pt spread
                </span>
              )}
              <span style={{ color: "#22d3ee" }}>{market.noPercentage}% {market.outcome_b}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="flex h-full">
                <div
                  className="h-full rounded-l-full transition-all duration-700"
                  style={{
                    width: `${market.yesPercentage}%`,
                    background: "linear-gradient(90deg, #6366f1, #818cf8)",
                  }}
                />
                <div
                  className="h-full rounded-r-full transition-all duration-700"
                  style={{
                    width: `${market.noPercentage}%`,
                    background: "linear-gradient(90deg, #06b6d4, #22d3ee)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
