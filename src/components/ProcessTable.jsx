import { useState } from 'react';
import Card from './Card.jsx';
import { formatBytes } from '../lib/format.js';

export default function ProcessTable({ procs, memTotal }) {
  const [sortBy, setSortBy] = useState('cpu');
  const rows = sortBy === 'cpu' ? (procs?.cpu ?? []) : (procs?.mem ?? []);
  const maxCpu = Math.max(1, ...(procs?.cpu ?? []).map((p) => p.cpu));

  const tab = (key, label) => (
    <button
      onClick={() => setSortBy(key)}
      className={`px-2.5 py-1 rounded-full text-[11.5px] transition-colors ${
        sortBy === key
          ? 'bg-white/[0.09] text-snow'
          : 'text-fog hover:text-snow hover:bg-white/[0.04]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card
      title="Processi principali"
      right={
        <div className="flex gap-1">
          {tab('cpu', 'Più CPU')}
          {tab('mem', 'Più memoria')}
        </div>
      }
      className="min-h-[260px]"
    >
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-fog text-left text-[11px] border-b border-line/60">
            <th className="font-medium py-1.5">Processo</th>
            <th className="font-medium py-1.5 w-[34%]">CPU</th>
            <th className="font-medium py-1.5 text-right w-20">RAM</th>
            <th className="font-medium py-1.5 text-right w-24">Tempo CPU</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-fog">
                In attesa dei primi campioni…
              </td>
            </tr>
          )}
          {rows.map((p) => (
            <tr key={`${sortBy}-${p.pid}`} className="border-b border-line/30 last:border-0">
              <td className="py-[7px] pr-3 truncate max-w-0 text-snow/95" title={p.name}>
                {p.name}
              </td>
              <td className="py-[7px] pr-4">
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="meter h-full rounded-full"
                      style={{
                        width: `${(p.cpu / maxCpu) * 100}%`,
                        background: 'linear-gradient(90deg,#56c7f588,#56c7f5)',
                      }}
                    />
                  </div>
                  <span className="num w-12 text-right text-snow/90">{p.cpu.toFixed(1)}%</span>
                </div>
              </td>
              <td className="num py-[7px] text-right text-snow/80">
                {formatBytes((p.mem / 100) * memTotal)}
              </td>
              <td className="num py-[7px] text-right text-fog">{p.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
