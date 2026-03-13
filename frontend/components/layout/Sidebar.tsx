"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  Compass,
  Droplets,
  Menu,
  Settings2,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  name: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

const mainNavigation: NavItem[] = [
  {
    name: "Markets",
    href: "/market",
    description: "Discover fresh narratives",
    icon: Compass,
  },
  {
    name: "Launchpad",
    href: "/launchpad",
    description: "Seed pre-live liquidity",
    icon: Sparkles,
  },
  {
    name: "Leaderboard",
    href: "/leaderboard",
    description: "Track top forecasters",
    icon: Trophy,
  },
  {
    name: "Faucet",
    href: "/faucet",
    description: "Top up your trading balance",
    icon: Droplets,
  },
];

const bottomNavigation: NavItem[] = [
  {
    name: "Settings",
    href: "/settings",
    description: "Personalize your workspace",
    icon: Settings2,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen((prev) => !prev);

  const renderNavItem = (item: NavItem) => {
    const isActive =
      item.href === "/market"
        ? pathname.startsWith("/market")
        : pathname === item.href;
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-300 whitespace-nowrap",
          isActive
            ? "border-transparent bg-gradient-to-r from-sky-500 via-cyan-400 to-amber-300 text-slate-950 shadow-[0_20px_40px_-24px_rgba(14,165,233,0.9)]"
            : "border-white/55 bg-white/60 text-foreground hover:-translate-y-0.5 hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
        )}
        onClick={() => {
          if (isMobile) {
            setIsOpen(false);
          }
        }}
      >
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
            isActive
              ? "bg-slate-950/12"
              : "bg-slate-950/5 text-sky-600 group-hover:bg-sky-500/10 dark:bg-white/5 dark:text-sky-300 dark:group-hover:bg-sky-400/10"
          )}
        >
          <Icon size={18} />
        </div>

        {isOpen && (
          <>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.name}</p>
              <p
                className={cn(
                  "truncate text-xs",
                  isActive ? "text-slate-900/72" : "text-muted-foreground"
                )}
              >
                {item.description}
              </p>
            </div>
            <ArrowUpRight
              className={cn(
                "h-4 w-4 transition-transform",
                isActive
                  ? "translate-x-0 text-slate-900/72"
                  : "text-muted-foreground group-hover:translate-x-0.5"
              )}
            />
          </>
        )}
      </Link>
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="fixed left-5 top-5 z-50 rounded-2xl border border-white/60 bg-white/75 shadow-lg backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-950/55"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {isOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed bottom-3 left-3 top-3 z-40 flex flex-col transition-all duration-300 md:sticky md:top-4 md:bottom-auto md:left-auto",
          isMobile && !isOpen ? "-translate-x-[120%]" : "translate-x-0",
          isOpen ? "w-[18rem]" : "w-[5.75rem]"
        )}
      >
        <div className="surface-panel flex h-full flex-col overflow-hidden bg-sidebar/92">
          <div className="flex items-center justify-between border-b border-white/45 px-4 py-4 dark:border-white/10">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-400 to-amber-300 text-sm font-black text-slate-950 shadow-[0_18px_35px_-20px_rgba(14,165,233,0.85)]">
                TM
              </div>
              {isOpen && (
                <div className="min-w-0">
                  <h1 className="font-display text-lg font-bold tracking-tight">
                    True Markets
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Beautiful forecasts, built for conviction
                  </p>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="hidden rounded-2xl border border-white/55 bg-white/70 shadow-none hover:bg-white md:flex dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <ChevronLeft
                className={cn(
                  "h-5 w-5 transition-transform duration-300",
                  !isOpen && "rotate-180"
                )}
              />
            </Button>
          </div>

          {isOpen && (
            <div className="px-4 pt-4">
              <div className="rounded-[22px] border border-sky-500/15 bg-gradient-to-br from-sky-500/14 via-white/65 to-amber-300/14 p-4 dark:from-sky-400/12 dark:via-white/5 dark:to-amber-300/10">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-sky-900 dark:text-sky-100">
                  <Sparkles className="h-4 w-4" />
                  Prediction workspace
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Move faster with curated markets, refined discovery, and a
                  calmer trading surface.
                </p>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
            {mainNavigation.map(renderNavItem)}
          </nav>

          <div className="border-t border-white/45 px-3 py-4 dark:border-white/10">
            <nav className="space-y-2">{bottomNavigation.map(renderNavItem)}</nav>
          </div>
        </div>
      </aside>
    </>
  );
}
