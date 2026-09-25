import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/Button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Unable to load data",
  description = "Something went wrong while retrieving this information.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="panel flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-danger-muted bg-danger-subtle text-danger">
        <AlertTriangle size={18} />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-[13px] text-ink-muted">{description}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
