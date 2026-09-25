export function LoadingState({ rows = 6, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="skeleton h-3.5 w-20" />
            <div className="skeleton h-3.5 w-32" />
            <div className="skeleton hidden h-3.5 flex-1 sm:block" />
            <div className="skeleton h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-6 w-48" />
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel p-4">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-3 h-7 w-12" />
          </div>
        ))}
      </div>
      <LoadingState />
    </div>
  );
}
