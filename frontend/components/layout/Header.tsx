"use client";

import { Moon, SunMedium, SearchIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WalletButton } from "@/components/common/WalletButton";
import { Button } from "@/components/ui/button";

const pageTitles: Array<{
  match: (pathname: string) => boolean;
  title: string;
  subtitle?: string;
}> = [
  { match: (p) => p.startsWith("/market/"), title: "Market Detail", subtitle: "Active prediction market" },
  { match: (p) => p === "/market", title: "Markets", subtitle: "Explore prediction markets" },
  { match: (p) => p === "/create", title: "Create Market", subtitle: "Launch a new prediction" },
  { match: (p) => p === "/p2p", title: "P2P Bets", subtitle: "Private peer-to-peer trading" },
  { match: (p) => p === "/launchpad", title: "Launchpad", subtitle: "Bootstrap market liquidity" },
  { match: (p) => p === "/oracle", title: "Oracle", subtitle: "Optimistic resolution layer" },
  { match: (p) => p === "/leaderboard", title: "Leaderboard", subtitle: "Top traders & forecasters" },
  { match: (p) => p === "/faucet", title: "Faucet", subtitle: "Get testnet USDCx tokens" },
  { match: (p) => p === "/settings", title: "Settings", subtitle: "Preferences & configuration" },
];

export default function Header() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pageInfo = useMemo(() => {
    return pageTitles.find((e) => e.match(pathname)) ?? {
      title: "True Markets",
      subtitle: "ZK prediction protocol",
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 w-full">
      {/* Backdrop */}
      <div className="absolute inset-0 border-b backdrop-blur-3xl"
        style={{
          background: "rgba(255,255,255,0.55)",
          borderColor: "rgba(99,102,241,0.1)",
        }}
      />
      <div className="dark:block hidden absolute inset-0 border-b backdrop-blur-3xl"
        style={{
          background: "rgba(5,5,10,0.7)",
          borderColor: "rgba(99,102,241,0.12)",
        }}
      />

      <div className="relative flex items-center justify-between gap-4 px-5 py-3.5 md:px-7">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 md:hidden">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow: "0 0 16px rgba(99,102,241,0.5)",
            }}
          >
            <span className="text-xs font-black font-mono">ZK</span>
          </div>
          <span className="font-display font-bold text-base tracking-tight">
            True <span className="text-gradient-brand">Markets</span>
          </span>
        </div>

        {/* Desktop page title */}
        <div className="hidden md:flex items-center gap-3">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight leading-none">
              {pageInfo.title}
            </h1>
            {pageInfo.subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                {pageInfo.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Theme toggle */}
          {mounted && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="h-9 w-9 rounded-xl border transition-all duration-200"
              style={{
                borderColor: "rgba(99,102,241,0.15)",
                background: "rgba(99,102,241,0.05)",
              }}
            >
              {resolvedTheme === "dark" ? (
                <Moon className="h-4 w-4 text-indigo-300" />
              ) : (
                <SunMedium className="h-4 w-4 text-indigo-600" />
              )}
            </Button>
          )}

          {/* Wallet */}
          <div
            className="rounded-xl border p-1"
            style={{
              borderColor: "rgba(99,102,241,0.15)",
              background: "rgba(99,102,241,0.04)",
            }}
          >
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
