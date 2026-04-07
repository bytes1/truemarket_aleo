"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { Activity } from "lucide-react";
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
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl p-3 shadow-xl"
      style={{
        background: "rgba(12,12,22,0.95)",
        border: "1px solid rgba(99,102,241,0.25)",
        backdropFilter: "blur(12px)",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium" style={{ color: entry.color }}>
              {entry.name}
            </span>
            <span className="text-xs font-bold text-foreground">
              {entry.value.toFixed(1)}%
            </span>
          </div>
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

  const latestYes = chartData[chartData.length - 1]?.yesProbability ?? market.yesPercentage;
  const prevYes = chartData[0]?.yesProbability ?? market.yesPercentage;
  const delta = latestYes - prevYes;

  return (
    <section className="surface-card overflow-hidden" style={{ padding: 0 }}>
      {/* Card header */}
      <div
        className="flex flex-col gap-4 px-6 pt-6 pb-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
          >
            <Activity size={16} style={{ color: "#818cf8" }} />
          </div>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight">
              Price History
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Probability simulation
              {delta !== 0 && (
                <span
                  className="ml-2 font-semibold"
                  style={{ color: delta >= 0 ? "#34d399" : "#f87171" }}
                >
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}pt
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Timeframe selector */}
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {(["24h", "7d", "30d", "All"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTimeframe(value)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200"
              style={
                timeframe === value
                  ? {
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: "#fff",
                    boxShadow: "0 2px 10px -2px rgba(99,102,241,0.5)",
                  }
                  : { color: "#94a3b8" }
              }
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* Outcome probability tiles */}
      <div className="grid grid-cols-2 gap-3 px-6 py-4">
        <div
          className="group relative overflow-hidden rounded-2xl p-4 cursor-pointer transition-all duration-300"
          style={{
            background: "rgba(99,102,241,0.07)",
            border: "1px solid rgba(99,102,241,0.15)",
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: "rgba(99,102,241,0.08)" }}
          />
          <p className="relative text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#818cf8" }}>
            {market.outcome_a}
          </p>
          <p className="relative font-display text-3xl font-bold" style={{ color: "#a5b4fc" }}>
            {market.yesPercentage}%
          </p>
        </div>
        <div
          className="group relative overflow-hidden rounded-2xl p-4 cursor-pointer transition-all duration-300"
          style={{
            background: "rgba(6,182,212,0.07)",
            border: "1px solid rgba(6,182,212,0.15)",
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: "rgba(6,182,212,0.08)" }}
          />
          <p className="relative text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#22d3ee" }}>
            {market.outcome_b}
          </p>
          <p className="relative font-display text-3xl font-bold" style={{ color: "#67e8f9" }}>
            {market.noPercentage}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-6">
        <div
          className="h-[260px] rounded-2xl p-2"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 16, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="noGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tick={{ fill: "#64748b", fontSize: 11 }}
              />
              <ReferenceLine
                y={50}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 4"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="yesProbability"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#yesGrad)"
                dot={false}
                name={market.outcome_a}
              />
              <Area
                type="monotone"
                dataKey="noProbability"
                stroke="#06b6d4"
                strokeWidth={2.5}
                fill="url(#noGrad)"
                dot={false}
                name={market.outcome_b}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
