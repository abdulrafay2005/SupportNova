import type { Sentiment } from "@/types";
import { cn } from "@/utils/cn";

const styles: Record<Sentiment, string> = {
  Positive: "text-success",
  Neutral: "text-ink-muted",
  Negative: "text-warning",
  "Strongly Negative": "text-danger",
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", styles[sentiment])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {sentiment}
    </span>
  );
}
