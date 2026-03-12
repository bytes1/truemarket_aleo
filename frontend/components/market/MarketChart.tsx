"use client";

import { useMemo, useState } from "react";
import { Activity, Sparkles } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type TimeFrame = "24h" | "7d" | "30d" | "All";

type MarketChartProps = {
  market: {
    market_id: number;
    market_title: string;
    outcome_a: string;
    outcome_b: string;
    yesPercentage: number;
    noPercentage: number;
  };
};

type ChartPoint = {
  label: string;
  yesProbability: number;
  noProbability: number;
};

const pointCountByTimeframe: Record<TimeFrame, number> = {
  "24h": 8,
  "7d": 14,
  "30d": 30,
  All: 48,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildPreviewSeries(marketId: number, baseYes: number, count: number) {
  const points: ChartPoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const progress = count === 1 ? 1 : index / (count - 1);
    const wave =
      Math.sin((index + marketId) * 0.45) * 5 +
      Math.cos((index + marketId) * 0.23) * 3;
    const drift = (progress - 0.5) * (baseYes - 50) * 0.7;
    const easedBase = baseYes - (1 - progress) * 4;
    const yesProbability =
      index === count - 1
        ? baseYes
        : clamp(easedBase + drift + wave, 3, 97);

    points.push({
      label:
        count <= 8
          ? `${index * 3}h`
          : count <= 14
          ? `D${index + 1}`
          : count <= 30
          ? `W${index + 1}`
          : `P${index + 1}`,
      yesProbability,
      noProbability: 100 - yesProbability,
    });
  }

  return points;
}

type TooltipPayload = Array<{
  value: number;
  name: string;
  color: string;
}>;

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white/96 p-3 shadow-lg dark:border-white/10 dark:bg-slate-950/96">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <p
            key={entry.name}
            className="text-sm font-medium"
            style={{ color: entry.color }}
          >
            {entry.name}: {entry.value.toFixed(1)}%
          </p>
        ))}
      </div>
    </div>
  );
}

export const MarketChart = ({ market }: MarketChartProps) => {
  const [timeframe, setTimeframe] = useState<TimeFrame>("7d");

  const chartData = useMemo(
    () =>
      buildPreviewSeries(
        market.market_id,
        market.yesPercentage,
        pointCountByTimeframe[timeframe]
      ),
    [market.market_id, market.yesPercentage, timeframe]
  );

  return (
    <section className="surface-card p-5 md:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow">
              <Activity className="h-3.5 w-3.5" />
              Market curve
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
              Market history
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Track how the current market leans across the selected range.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["24h", "7d", "30d", "All"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimeframe(value)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                  timeframe === value
                    ? "border-transparent bg-slate-950 text-white shadow-[0_16px_30px_-22px_rgba(15,23,42,0.9)] dark:bg-white dark:text-slate-950"
                    : "border-slate-200/80 bg-white/88 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/8"
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200/70 bg-white/84 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {market.outcome_a}
            </p>
            <p className="mt-2 font-display text-4xl font-bold tracking-tight text-sky-600 dark:text-sky-300">
              {market.yesPercentage}%
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200/70 bg-white/84 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {market.outcome_b}
            </p>
            <p className="mt-2 font-display text-4xl font-bold tracking-tight text-amber-500 dark:text-amber-300">
              {market.noPercentage}%
            </p>
          </div>
        </div>

        <div className="h-[360px] rounded-[28px] border border-slate-200/70 bg-gradient-to-br from-white via-sky-50/30 to-white p-4 dark:border-white/10 dark:bg-gradient-to-br dark:from-slate-950 dark:via-sky-950/20 dark:to-slate-950">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 12, left: -16, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.22)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-muted-foreground"
              />
              <ReferenceLine
                y={50}
                stroke="rgba(148,163,184,0.35)"
                strokeDasharray="4 4"
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="yesProbability"
                stroke="#0ea5e9"
                strokeWidth={3}
                dot={false}
                name={market.outcome_a}
              />
              <Line
                type="monotone"
                dataKey="noProbability"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={false}
                name={market.outcome_b}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[24px] border border-sky-500/15 bg-sky-500/8 p-4 text-sm text-muted-foreground dark:border-sky-400/15 dark:bg-sky-400/8">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-500/10 p-2 text-sky-600 dark:text-sky-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-foreground">Market view</p>
              <p className="mt-1 leading-6">
                Use this chart to compare both sides and follow the current
                market leaning.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
