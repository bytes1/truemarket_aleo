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
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  color?: string;
}

const mainNavigation: NavItem[] = [
  { name: "Markets", href: "/market", icon: Compass },
  { name: "Create Market", href: "/create", icon: Sparkles },
  { name: "P2P Bets", href: "/p2p", icon: HandCoins },
  { name: "Launchpad", href: "/launchpad", icon: Rocket, badge: "NEW" },
  { name: "Oracle", href: "/oracle", icon: Scale },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  // { name: "Faucet", href: "/faucet", icon: Droplets },
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
      if (mobile) setIsOpen(false);
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
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
          isActive
            ? "nav-active-glow text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => {
          if (isMobile) setIsOpen(false);
        }}
      >
        {/* Active left border indicator */}
        {isActive && (
          <span
            className="absolute left-0 inset-y-2 w-0.5 rounded-full bg-primary"
            style={{ boxShadow: "0 0 12px 1px rgba(99,102,241,0.8)" }}
          />
        )}

        {/* Active background */}
        {isActive && (
          <span className="absolute inset-0 rounded-xl opacity-[0.08] bg-primary" />
        )}

        {/* Icon container */}
        <div
          className={cn(
            "relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200",
            isActive
              ? "bg-primary/15 text-primary"
              : "bg-white/5 text-muted-foreground group-hover:bg-white/8 group-hover:text-foreground"
          )}
        >
          <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
          {isActive && (
            <span
              className="absolute inset-0 rounded-lg"
              style={{ boxShadow: "inset 0 0 10px rgba(99,102,241,0.2)" }}
            />
          )}
        </div>

        {isOpen && (
          <div className="flex min-w-0 flex-1 items-center justify-between">
            <span
              className={cn(
                "text-sm font-medium truncate",
                isActive ? "text-primary font-semibold" : ""
              )}
            >
              {item.name}
            </span>
            {item.badge && (
              <span className="ml-2 flex-shrink-0 rounded-full bg-primary/15 border border-primary/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary dark:text-indigo-300">
                {item.badge}
              </span>
            )}
          </div>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="fixed left-4 top-4 z-50 rounded-xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 shadow-lg backdrop-blur-xl md:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile backdrop */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed bottom-3 left-3 top-3 z-40 flex flex-col transition-all duration-300 ease-in-out md:sticky md:top-4 md:bottom-auto md:left-auto",
          isMobile && !isOpen ? "-translate-x-[120%]" : "translate-x-0",
          isOpen ? "w-[220px]" : "w-[68px]"
        )}
      >
        <div
          className="surface-panel flex h-full flex-col overflow-hidden"
          style={{
            background: "var(--sidebar)",
            borderColor: "var(--sidebar-border)",
          }}
        >
          {/* Logo */}
          <div
            className="flex items-center justify-between border-b px-4 py-4"
            style={{ borderColor: "var(--sidebar-border)" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xs font-black text-white font-mono"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #06b6d4 100%)",
                  boxShadow:
                    "0 0 24px rgba(99,102,241,0.5), 0 0 8px rgba(99,102,241,0.3)",
                }}
              >
                <Zap size={16} strokeWidth={2.5} />
                <span
                  className="absolute inset-0 rounded-xl animate-pulse-glow"
                  style={{ opacity: 0 }}
                />
              </div>

              {isOpen && (
                <div className="min-w-0">
                  <h1 className="font-display text-[15px] font-bold tracking-tight">
                    True{" "}
                    <span className="text-gradient-brand">Markets</span>
                  </h1>
                  <p className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">
                    ZK Darkpool
                  </p>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="hidden h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 md:flex"
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-transform duration-300 text-muted-foreground",
                  !isOpen && "rotate-180"
                )}
              />
            </Button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-0.5">
            {isOpen && (
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
                Navigation
              </p>
            )}
            {mainNavigation.map(renderNavItem)}
          </nav>

          {/* Bottom nav */}
          <div
            className="border-t px-2.5 py-3"
            style={{ borderColor: "var(--sidebar-border)" }}
          >
            {bottomNavigation.map(renderNavItem)}

            {isOpen && (
              <div
                className="mt-3 rounded-xl p-3"
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.12)",
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Network
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #34d399" }} />
                  <span className="text-xs font-medium text-foreground/80">Aleo Testnet</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
