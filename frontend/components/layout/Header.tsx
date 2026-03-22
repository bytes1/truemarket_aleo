"use client";

import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WalletButton } from "@/components/common/WalletButton";
import { Button } from "@/components/ui/button";

const pageTitles: Array<{
  match: (pathname: string) => boolean;
  title: string;
}> = [
  { match: (pathname) => pathname.startsWith("/market/"), title: "Market" },
  { match: (pathname) => pathname === "/market", title: "Markets" },
  { match: (pathname) => pathname === "/p2p", title: "P2P Bets" },
  { match: (pathname) => pathname === "/launchpad", title: "Launchpad" },
  { match: (pathname) => pathname === "/leaderboard", title: "Leaderboard" },
  { match: (pathname) => pathname === "/faucet", title: "Faucet" },
  { match: (pathname) => pathname === "/settings", title: "Settings" },
];

export default function Header() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const title = useMemo(() => {
    return pageTitles.find((entry) => entry.match(pathname))?.title ?? "True Markets";
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/45 bg-white/60 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/45">
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white dark:bg-white dark:text-slate-950">
            TM
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {title}
          </h1>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {mounted && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="h-11 w-11 rounded-2xl border border-white/55 bg-white/70 shadow-none hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              {resolvedTheme === "dark" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <SunMedium className="h-5 w-5" />
              )}
            </Button>
          )}

          <div className="rounded-full border border-white/55 bg-white/65 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
