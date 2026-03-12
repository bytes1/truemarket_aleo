"use client";

import { MessageSquareText, Newspaper, Radio, Users2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MarketOpinionsProps = {
  marketTitle: string;
};

export const MarketOpinions = ({ marketTitle }: MarketOpinionsProps) => (
  <section className="surface-card p-5 md:p-6">
    <div className="mb-5">
      <div className="eyebrow">
        <MessageSquareText className="h-3.5 w-3.5" />
        Community
      </div>
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
        Discussion and activity
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Follow conversation, market participation, activity, and related
        updates for this question.
      </p>
    </div>

    <Tabs defaultValue="discussion" className="space-y-5">
      <TabsList className="h-auto flex-wrap gap-2 rounded-[24px] border border-slate-200/70 bg-white/88 p-2 dark:border-white/10 dark:bg-white/5">
        <TabsTrigger value="discussion" className="rounded-full px-4 py-2">
          Discussion
        </TabsTrigger>
        <TabsTrigger value="holders" className="rounded-full px-4 py-2">
          Holders
        </TabsTrigger>
        <TabsTrigger value="activity" className="rounded-full px-4 py-2">
          Activity
        </TabsTrigger>
        <TabsTrigger value="news" className="rounded-full px-4 py-2">
          News
        </TabsTrigger>
      </TabsList>

      <TabsContent value="discussion" className="mt-0">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-600 dark:text-sky-300">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Discussion is quiet</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Community commentary for "{marketTitle}" will appear here.
              </p>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="holders" className="mt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-300">
                <Users2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Private positions</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Holder visibility depends on private wallet records rather than
                  public balances for this market.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-5 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Holder overview
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Market participation and position trends appear here without
              exposing private user data.
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="activity" className="mt-0">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-400/12 p-3 text-amber-600 dark:text-amber-300">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Recent activity</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Trade fills, approvals, and settlement activity appear in this
                feed.
              </p>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="news" className="mt-0">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-fuchsia-500/10 p-3 text-fuchsia-600 dark:text-fuchsia-300">
              <Newspaper className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Related updates</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Relevant articles, official updates, and source-linked context
                appear here.
              </p>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </section>
);
