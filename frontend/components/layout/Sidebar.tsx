"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Compass,
  Droplets,
  HandCoins,
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
  icon: LucideIcon;
}

const mainNavigation: NavItem[] = [
  { name: "Markets", href: "/market", icon: Compass },
  { name: "P2P Bets", href: "/p2p", icon: HandCoins },
  { name: "Launchpad", href: "/launchpad", icon: Sparkles },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Faucet", href: "/faucet", icon: Droplets },
];

const bottomNavigation: NavItem[] = [
  { name: "Settings", href: "/settings", icon: Settings2 },
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
          "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
          isActive
            ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
            : "text-foreground hover:bg-slate-100 dark:hover:bg-white/8"
        )}
        onClick={() => {
          if (isMobile) {
            setIsOpen(false);
          }
        }}
      >
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border",
            isActive
              ? "border-white/15 bg-white/10 dark:border-slate-300/20 dark:bg-slate-900/10"
              : "border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5"
          )}
        >
          <Icon size={18} />
        </div>

        {isOpen && <span className="font-medium">{item.name}</span>}
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
          isOpen ? "w-[16rem]" : "w-[5.75rem]"
        )}
      >
        <div className="surface-panel flex h-full flex-col overflow-hidden bg-sidebar/92">
          <div className="flex items-center justify-between border-b border-white/45 px-4 py-4 dark:border-white/10">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                TM
              </div>
              {isOpen && (
                <div className="min-w-0">
                  <h1 className="font-display text-lg font-bold tracking-tight">
                    True Markets
                  </h1>
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
