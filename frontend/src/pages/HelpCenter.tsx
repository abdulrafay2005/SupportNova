import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { useData } from "@/context/DataContext";
import { kbCategories } from "@/data/mockData";
import { formatDate } from "@/utils/dates";
import { cn } from "@/utils/cn";

export function HelpCenter() {
  const { articles } = useData();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (category && a.category !== category) return false;
      if (!q) return true;
      return `${a.title} ${a.summary} ${a.content.join(" ")}`.toLowerCase().includes(q);
    });
  }, [articles, query, category]);

  const counts = Object.fromEntries(
    kbCategories.map((c) => [c, articles.filter((a) => a.category === c).length]),
  );

  return (
    <div>
      <PageHeader
        title="Help Center"
        description="Procedures for orders, payments, delivery, accounts, returns, and security."
      />
      <div className="mb-4 max-w-xl">
        <SearchBar value={query} onChange={setQuery} placeholder="Search articles..." />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={cn(
            "rounded-md border px-2.5 py-1 text-[12px] font-medium",
            !category ? "border-primary bg-primary-subtle text-primary" : "border-line bg-surface text-ink-secondary hover:bg-canvas",
          )}
        >
          All
        </button>
        {kbCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[12px] font-medium",
              category === c ? "border-primary bg-primary-subtle text-primary" : "border-line bg-surface text-ink-secondary hover:bg-canvas",
            )}
          >
            {c}
            <span className="ml-1 text-ink-faint">{counts[c]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No articles found"
          description="Nothing matches that search. Try another term or clear the category filter."
        />
      ) : (
        <ul className="divide-y divide-line panel overflow-hidden">
          {filtered.map((a) => (
            <li key={a.id}>
              <Link to={`/help-center/${a.id}`} className="block px-4 py-3 hover:bg-canvas-subtle">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-medium text-ink">{a.title}</p>
                  <p className="text-[11px] text-ink-faint">Updated {formatDate(a.updatedAt)}</p>
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-ink-muted">{a.category}</p>
                <p className="mt-1 text-[13px] text-ink-secondary">{a.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
