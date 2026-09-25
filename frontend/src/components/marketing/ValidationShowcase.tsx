import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowRight, Check } from "lucide-react";
import { useData } from "@/context/DataContext";
import { cn } from "@/utils/cn";

/** Dark-section comparison: generated recommendation → Python ground truth → result. */
export function ValidationShowcase() {
  const { complaints } = useData();
  const [mode, setMode] = useState<"match" | "mismatch">("match");
  const c = complaints.find((x) => x.id === (mode === "match" ? "SN-000124" : "SN-000131"));
  if (!c) return null;
  const fields = c.validationDetail.fields;
  const ok = c.validationDetail.overall === "Match";

  return (
    <div>
      <div role="tablist" aria-label="Validation example" className="inline-flex rounded-md border border-white/15 p-0.5">
        {(
          [
            ["match", "When they agree"],
            ["mismatch", "When they don't"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              "rounded px-3 py-1.5 text-[13px] font-medium transition-colors",
              mode === id ? "bg-white text-primary-dark" : "text-white/70 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-white/60">
        <span className="font-mono text-soft-green">{c.id}</span> · {c.subject}
      </p>

      <div key={mode} className="fade-in mt-5 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Column title="Generated recommendation" rows={fields.map((f) => [f.field, f.genai])} />
        <Connector />
        <Column
          title="Ground-truth validation"
          rows={fields.map((f) => [f.field, f.python])}
          flags={fields.map((f) => f.result === "Mismatch")}
        />
        <Connector />
        <div
          className={cn(
            "flex flex-col justify-center rounded-lg border p-5",
            ok ? "border-soft-green/40 bg-soft-green/10" : "border-warning-muted/40 bg-warning/10",
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Result</p>
          <p className={cn("mt-2 flex items-center gap-2 text-[22px] font-semibold", ok ? "text-soft-green" : "text-warning-muted")}>
            {ok ? <Check size={22} strokeWidth={3} aria-hidden /> : <AlertTriangle size={20} aria-hidden />}
            {ok ? "Validated" : "Mismatch"}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/75">
            {ok
              ? "Policy and resolution requirements satisfied. The recommendation can move forward to the agent."
              : c.validationDetail.reviewReason ?? "Manual review required before anyone acts on it."}
          </p>
          {!ok && (
            <p className="mt-3 inline-block self-start rounded border border-white/20 px-2 py-1 text-[12px] text-white">
              Sent to manual review
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Column({ title, rows, flags }: { title: string; rows: [string, string][]; flags?: boolean[] }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/[0.04] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">{title}</p>
      <dl className="mt-3 space-y-3">
        {rows.map(([k, v], i) => (
          <div key={k}>
            <dt className="text-[12px] text-white/50">{k}</dt>
            <dd className={cn("text-[15px] font-medium", flags?.[i] ? "text-warning-muted" : "text-white")}>
              {v}
              {flags?.[i] && <span className="ml-2 text-[11px] font-normal">differs</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center justify-center text-soft-green" aria-hidden>
      <ArrowRight size={18} className="hidden lg:block" />
      <ArrowDown size={18} className="lg:hidden" />
    </div>
  );
}
