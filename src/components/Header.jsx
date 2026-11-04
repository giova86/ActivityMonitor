import { useEffect, useState } from 'react';

export default function Header({ hw, connected, cpuTotal }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="mb-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1l6 7-6 7-6-7z" fill="url(#g)" />
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#56c7f5" />
                <stop offset="1" stopColor="#a08bff" />
              </linearGradient>
            </defs>
          </svg>
          <h1 className="text-[15px] font-semibold tracking-tight">Monitor</h1>
          <span className="text-[12.5px] text-fog">
            {hw ? `${hw.chip} · ${hw.cores} core · ${(hw.memTotal / 1024 ** 3).toFixed(0)} GB` : '…'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-2 text-[12px]"
            style={{ color: connected ? 'var(--color-good)' : 'var(--color-heat2)' }}
            role="status"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${connected ? 'pulse-dot' : ''}`}
              style={{ background: connected ? 'var(--color-good)' : 'var(--color-heat2)' }}
            />
            {connected ? 'Live' : 'Connessione persa…'}
          </span>
          <span className="num text-[13px] text-fog">
            {now.toTimeString().slice(0, 8)}
          </span>
        </div>
      </div>
      {/* Il "polso" della macchina: la fascia pulsa con l'uso CPU */}
      <div className="mt-4 h-[3px] w-full rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="meter h-full rounded-full"
          style={{
            width: `${Math.max(1.5, Math.min(100, cpuTotal))}%`,
            background: 'linear-gradient(90deg, #56c7f5, #a08bff)',
            boxShadow: '0 0 12px #56c7f577',
          }}
        />
      </div>
    </header>
  );
}
