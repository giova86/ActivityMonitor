export default function Card({ title, right, children, className = '' }) {
  return (
    <section className={`card p-5 flex flex-col ${className}`}>
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-[13px] font-medium tracking-wide text-fog">{title}</h2>
        {right}
      </header>
      <div className="flex-1 flex flex-col justify-between gap-3">{children}</div>
    </section>
  );
}

export function Meter({ value, color, className = '' }) {
  return (
    <div
      className={`h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden ${className}`}
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="meter h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
        }}
      />
    </div>
  );
}

export function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between text-[12.5px]">
      <span className="text-fog">{label}</span>
      <span className="num text-snow/90">{children}</span>
    </div>
  );
}

export function Big({ children, color = 'var(--color-snow)', suffix }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="num text-[38px] leading-none font-semibold" style={{ color }}>
        {children}
      </span>
      {suffix && <span className="text-[13px] text-fog">{suffix}</span>}
    </div>
  );
}
