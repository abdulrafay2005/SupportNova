import { Link } from "react-router-dom";
import { Button } from "@/components/Button";

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-[13px] text-ink-muted">404</p>
      <h1 className="mt-2 text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-1 max-w-sm text-[13px] text-ink-muted">
        That address is not a page in SupportNova. Check the URL or return to the workspace.
      </p>
      <Link to="/" className="mt-4">
        <Button>Back to overview</Button>
      </Link>
    </div>
  );
}
