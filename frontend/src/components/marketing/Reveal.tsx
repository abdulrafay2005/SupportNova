import type React from "react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export function useInView<T extends Element = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const props = {
    className: cn("reveal", inView && "is-visible", className),
    style: { transitionDelay: `${delay}ms` },
  };
  if (as === "li") {
    return (
      <li ref={ref as React.RefObject<HTMLLIElement>} {...props}>
        {children}
      </li>
    );
  }
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} {...props}>
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  dark = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  body?: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && (
        <p className={cn("text-[12px] font-semibold uppercase tracking-[0.14em]", dark ? "text-soft-green" : "text-primary")}>
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "mt-2 text-[26px] font-semibold leading-[1.15] tracking-tight sm:text-[32px]",
          dark ? "text-white" : "text-ink",
        )}
      >
        {title}
      </h2>
      {body && (
        <div className={cn("mt-3 text-[15px] leading-relaxed", dark ? "text-white/75" : "text-ink-secondary")}>{body}</div>
      )}
    </div>
  );
}
