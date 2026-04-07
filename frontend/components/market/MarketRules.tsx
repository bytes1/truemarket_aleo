"use client";

import ReactMarkdown from "react-markdown";
import { BookOpen, ExternalLink } from "lucide-react";

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
    resolvedDetails.sourceLink !== "#" ? resolvedDetails.sourceLink : undefined;
  const hasDescription = Boolean(resolvedDetails.mainDescription.trim());
  const hasSource = Boolean(sourceHref);

  if (!hasDescription && !hasSource) return null;

  return (
    <section className="surface-card overflow-hidden" style={{ padding: 0 }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <BookOpen size={16} style={{ color: "#818cf8" }} />
        </div>
        <div>
          <h2 className="font-display text-base font-bold tracking-tight">
            Resolution Rules
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How this market will be resolved
          </p>
        </div>

        {hasSource && (
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:scale-105"
            style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.18)",
              color: "#818cf8",
            }}
          >
            <ExternalLink size={12} />
            Source
          </a>
        )}
      </div>

      {/* Content */}
      {hasDescription && (
        <div className="px-6 py-5">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="prose-sm max-w-none text-sm leading-relaxed text-muted-foreground">
              <ReactMarkdown
                components={{
                  p: ({ ...props }) => (
                    <p {...props} className="mb-3 last:mb-0 leading-7 text-foreground/75" />
                  ),
                  a: ({ ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline underline-offset-4 transition-colors"
                      style={{ color: "#818cf8" }}
                    />
                  ),
                  ul: ({ ...props }) => (
                    <ul {...props} className="mb-3 space-y-1.5 pl-5 list-disc marker:text-primary/50" />
                  ),
                  ol: ({ ...props }) => (
                    <ol {...props} className="mb-3 space-y-1.5 pl-5 list-decimal marker:text-primary/50" />
                  ),
                  li: ({ ...props }) => (
                    <li {...props} className="leading-relaxed text-foreground/70" />
                  ),
                  strong: ({ ...props }) => (
                    <strong {...props} className="font-semibold text-foreground" />
                  ),
                  h3: ({ ...props }) => (
                    <h3 {...props} className="mb-2 mt-4 text-sm font-bold text-foreground first:mt-0" />
                  ),
                }}
              >
                {resolvedDetails.mainDescription}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
