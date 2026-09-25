import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((item, i) => {
        const isOpen = open === i;
        const btnId = `${base}-q-${i}`;
        const panelId = `${base}-a-${i}`;
        return (
          <li key={item.q}>
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className={cn("text-[15px] font-medium", isOpen ? "text-ink" : "text-ink-secondary")}>{item.q}</span>
                <ChevronDown
                  size={18}
                  className={cn("shrink-0 text-ink-muted transition-transform duration-200", isOpen && "rotate-180 text-primary")}
                  aria-hidden
                />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={btnId} className="accordion-panel" data-open={isOpen}>
              <div>
                <p className="pb-5 pr-8 text-[14px] leading-relaxed text-ink-muted">{item.a}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
