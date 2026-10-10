import type { ReactNode } from "react";

// A tiled window: title row (title, count, right-side hint) and its own scroll body.
export function Pane({
  title, count, right, className = "", body = true, children, active,
}: {
  title: ReactNode;
  count?: ReactNode;
  right?: ReactNode;
  className?: string;
  body?: boolean; // false: children supply their own body rows (filter bar + list)
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`pane ${className}${active ? " active" : ""}`}>
      <div className="ph">
        <span className="pt">{title}</span>
        {count !== undefined && <span className="pn">{count}</span>}
        <span className="sp" />
        {right}
      </div>
      {body ? <div className="pb">{children}</div> : children}
    </section>
  );
}
