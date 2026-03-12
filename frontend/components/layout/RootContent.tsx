"use client";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

interface RootContentProps {
  children: React.ReactNode;
}

export default function RootContent({ children }: RootContentProps) {
  return (
    <div className="relative flex min-h-screen text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-sky-500/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-1/4 h-80 w-80 rounded-full bg-amber-400/16 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-96 w-96 rounded-full bg-cyan-400/14 blur-3xl" />
      </div>

      <div className="relative flex w-full gap-3 p-3 md:gap-4 md:p-4">
        <Sidebar />
        <div className="surface-panel relative flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col overflow-hidden md:min-h-[calc(100vh-2rem)]">
          <Header />
          <main className="relative flex-1 overflow-auto">
            <div className="min-h-full px-4 pb-8 pt-6 md:px-8 md:pb-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
