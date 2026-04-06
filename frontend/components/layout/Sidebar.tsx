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
  Rocket,
  Scale,
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
  { name: "Create Market", href: "/create", icon: Sparkles },
  { name: "P2P Bets", href: "/p2p", icon: HandCoins },
  { name: "Launchpad", href: "/launchpad", icon: Rocket },
  { name: "Oracle", href: "/oracle", icon: Scale },
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
          "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-300",
          isActive
            ? "bg-primary/10 text-primary font-medium dark:bg-primary/15"
            : "text-foreground hover:bg-white/5 dark:hover:bg-white/5"
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
              ? "border-primary/30 bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]"
              : "border-slate-800 bg-white/5 text-muted-foreground group-hover:text-foreground group-hover:border-slate-700"
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
        <div className="surface-panel flex h-full flex-col overflow-hidden bg-sidebar/80 backdrop-blur-3xl shadow-xl">
          <div className="flex items-center justify-between border-b border-white/45 px-4 py-4 dark:border-white/[0.08]">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-sm font-black text-primary font-mono shadow-[0_0_20px_rgba(99,102,241,0.3)] backdrop-blur-md">
                ZK
              </div>
              {isOpen && (
                <div className="min-w-0">
                  <h1 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    True <span className="text-primary font-light">Markets</span>
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
