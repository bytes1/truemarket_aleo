"use client";

import ReactMarkdown from "react-markdown";
import { ArrowUpRight } from "lucide-react";

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
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Rules
          </h2>
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
          {hasSource && (
            <div className="rounded-[28px] border border-slate-200/70 bg-white/86 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Source
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
