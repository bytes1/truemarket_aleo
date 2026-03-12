"use client";

import {
  Command,
  Moon,
  Search,
  SunMedium,
  TrendingUp,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { WalletButton } from "@/components/common/WalletButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export default function Header() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/45 bg-white/60 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/45">
      <div className="flex flex-col gap-4 px-4 py-4 md:px-8 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 lg:min-w-[15rem]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-400 to-amber-300 text-sm font-black text-slate-950 shadow-[0_18px_35px_-20px_rgba(14,165,233,0.85)]">
            TM
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tracking-tight">
              Forecast Studio
            </p>
            <p className="text-xs text-muted-foreground">
              Discover signal-rich markets on Aleo
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search trending markets, narratives, sectors..."
              className="h-12 rounded-2xl border-white/60 bg-white/70 pl-11 pr-24 text-sm shadow-none placeholder:text-muted-foreground/80 dark:border-white/10 dark:bg-white/5"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-white/55 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:border-white/10 dark:bg-white/6 md:flex">
              <Command className="h-3.5 w-3.5" />
              K
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/55 bg-white/68 px-4 py-2 text-sm text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5 xl:flex">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <TrendingUp className="h-4 w-4 text-sky-500" />
            <span>Live on-chain markets updating now</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {mounted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-2xl border border-white/55 bg-white/70 shadow-none hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <SunMedium className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="rounded-2xl border-white/60 bg-white/92 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92"
              >
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="rounded-full border border-white/55 bg-white/65 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
