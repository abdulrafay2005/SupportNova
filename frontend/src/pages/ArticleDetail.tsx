import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ErrorState } from "@/components/ErrorState";
import { useData } from "@/context/DataContext";
import { formatDate } from "@/utils/dates";

export function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { articles } = useData();
  const article = articles.find((a) => a.id === id);

  if (!article) {
    return (
      <ErrorState
        title="Article not found"
        description="This article is not in the Help Center."
        onRetry={() => navigate("/help-center")}
      />
    );
  }

  const related = articles.filter((a) => article.relatedIds.includes(a.id));

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/help-center" className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} />
        Back to Help Center
      </Link>
      <Breadcrumbs items={[{ label: "Help Center", to: "/help-center" }, { label: article.category, to: "/help-center" }, { label: article.title }]} />
      <header className="mt-3 mb-5">
        <p className="text-[12px] font-medium text-ink-muted">{article.category}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">{article.title}</h1>
        <p className="mt-1 text-[12px] text-ink-faint">
          Updated {formatDate(article.updatedAt)}
          {article.version ? ` · Version ${article.version}` : ""}
          {article.effectiveDate ? ` · Effective ${formatDate(article.effectiveDate)}` : ""}
          {article.policyId ? ` · ${article.policyId}` : ""}
        </p>
      </header>
      <article className="panel space-y-4 p-5">
        {article.content.map((p) => (
          <p key={p} className="text-[14px] leading-relaxed text-ink-secondary">
            {p}
          </p>
        ))}
      </article>
      {related.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold text-ink">Related articles</h2>
          <ul className="panel divide-y divide-line overflow-hidden">
            {related.map((a) => (
              <li key={a.id}>
                <Link to={`/help-center/${a.id}`} className="block px-4 py-2.5 hover:bg-canvas-subtle">
                  <p className="text-[13px] font-medium text-ink">{a.title}</p>
                  <p className="text-[12px] text-ink-muted">{a.category}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
