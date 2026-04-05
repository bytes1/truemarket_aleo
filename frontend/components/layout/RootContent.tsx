"use client";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

interface RootContentProps {
  children: React.ReactNode;
}

export default function RootContent({ children }: RootContentProps) {
  return (
    <div className="relative flex min-h-screen text-foreground bg-ambient-mesh">
      <div className="relative flex w-full gap-3 p-3 md:gap-4 md:p-4 section-grid">
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
