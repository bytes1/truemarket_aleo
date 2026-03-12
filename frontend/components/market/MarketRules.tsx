"use client";

import ReactMarkdown from "react-markdown";
import { ArrowUpRight, FileCheck2, ShieldCheck } from "lucide-react";

type MarketRulesProps = {
  details?: {
    mainDescription: string;
    categories: string[] | string;
    sourceLink: string;
    sourceName: string;
  };
};

export const MarketRules = ({ details }: MarketRulesProps) => {
  const resolvedDetails = details ?? {
    mainDescription: "",
    categories: [],
    sourceLink: "#",
    sourceName: "Resolution source",
  };
  const sourceHref =
    resolvedDetails.sourceLink !== "#" ? resolvedDetails.sourceLink : null;
  const categories = Array.isArray(resolvedDetails.categories)
    ? resolvedDetails.categories
    : resolvedDetails.categories
    ? [resolvedDetails.categories]
    : [];
  const hasDescription = Boolean(resolvedDetails.mainDescription.trim());
  const hasSource = Boolean(sourceHref);

  if (!hasDescription && !hasSource) {
    return null;
  }

  return (
    <section className="surface-card p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="eyebrow">
            <FileCheck2 className="h-3.5 w-3.5" />
            Resolution framework
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
            Rules and resolution criteria
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            These terms define how the market resolves. When in doubt, the
            written conditions and referenced source govern the outcome.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
            {categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                {category}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        {hasDescription ? (
          <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="max-w-none space-y-4 text-sm leading-7 text-muted-foreground">
              <ReactMarkdown
                components={{
                  p: ({ ...props }) => <p {...props} className="leading-7" />,
                  a: ({ ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-300"
                    />
                  ),
                  ul: ({ ...props }) => (
                    <ul {...props} className="list-disc space-y-2 pl-5" />
                  ),
                  ol: ({ ...props }) => (
                    <ol {...props} className="list-decimal space-y-2 pl-5" />
                  ),
                  li: ({ ...props }) => <li {...props} className="leading-7" />,
                  strong: ({ ...props }) => (
                    <strong {...props} className="font-semibold text-foreground" />
                  ),
                }}
              >
                {resolvedDetails.mainDescription}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="space-y-4">
          <div className="rounded-[28px] border border-emerald-500/15 bg-emerald-500/8 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Resolution principle</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This market should resolve from the explicit written rules,
                  not from vibes or implied interpretation.
                </p>
              </div>
            </div>
          </div>

          {hasSource && (
            <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Resolution source
              </p>
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition-colors hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
              >
                {resolvedDetails.sourceName}
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Use this reference when reviewing whether the market should settle
                to outcome A or outcome B.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
