import Card, { Big, Meter, Row } from './Card.jsx';
import { formatBytes } from '../lib/format.js';

const C = {
  cpu: '#56c7f5',
  gpu: '#a08bff',
  ram: '#3fd9a4',
  heat: '#ffb454',
  heatHigh: '#ff6b6b',
  down: '#62a8ff',
  up: '#f4779d',
  good: '#4ade80',
};

/* ------------------------------------------------------------------ CPU -- */

export function CpuCard({ cpu }) {
  const cores = cpu?.cores ?? [];
  const pCores = cores.filter((c) => c.cluster === 'P');
  const eCores = cores.filter((c) => c.cluster === 'E');
  const load = cpu?.load ?? [0, 0, 0];

  return (
    <Card
      title="CPU"
      right={<span className="num text-[11px] text-fog">{cpu?.p?.freqMhz ? `${(cpu.p.freqMhz / 1000).toFixed(1)} GHz` : '—'}</span>}
    >
      <Big color={C.cpu} suffix="%">{(cpu?.total ?? 0).toFixed(0)}</Big>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="num text-[10px] text-fog w-7">P·{pCores.length}</span>
          <Meter value={cpu?.p?.usage ?? 0} color={C.cpu} />
        </div>
        <div className="flex items-center gap-2">
          <span className="num text-[10px] text-fog w-7">E·{eCores.length}</span>
          <Meter value={cpu?.e?.usage ?? 0} color={`${C.cpu}99`} />
        </div>
      </div>
      <div className="flex items-end gap-[3px] h-8 mt-1" aria-label="utilizzo per core">
        {pCores.map((c, i) => (
          <CoreBar key={`p${i}`} usage={c.usage} color={C.cpu} />
        ))}
        <span className="w-2" />
        {eCores.map((c, i) => (
          <CoreBar key={`e${i}`} usage={c.usage} color={`${C.cpu}80`} />
        ))}
      </div>
      <Row label="Load medio 1m">{load[0]?.toFixed(2)}</Row>
    </Card>
  );
}

function CoreBar({ usage, color }) {
  return (
    <div className="flex-1 h-full rounded-[2px] bg-white/[0.05] flex items-end overflow-hidden">
      <div
        className="meter w-full rounded-[2px]"
        style={{ height: `${Math.max(2, Math.min(100, usage))}%`, background: color }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ GPU -- */

export function GpuCard({ gpu, power, hw }) {
  return (
    <Card title="GPU" right={<span className="num text-[11px] text-fog">{gpu?.freqMhz ? `${gpu.freqMhz} MHz` : '—'}</span>}>
      <Big color={C.gpu} suffix="%">{(gpu?.usage ?? 0).toFixed(0)}</Big>
      <Meter value={gpu?.usage ?? 0} color={C.gpu} />
      <Row label="Assorbita">{(power?.gpu ?? 0).toFixed(1)} W</Row>
      <Row label="Modello">
        <span className="text-[11.5px]">{hw?.chip ?? 'Apple Silicon'}</span>
      </Row>
    </Card>
  );
}

/* ------------------------------------------------------------------ RAM -- */

const PRESSURE = {
  normal: { label: 'Normale', color: C.good },
  warning: { label: 'Attenzione', color: C.heat },
  critical: { label: 'Critica', color: C.heatHigh },
};

export function RamCard({ mem }) {
  const pct = mem?.total ? (mem.used / mem.total) * 100 : 0;
  const p = PRESSURE[mem?.pressure] ?? PRESSURE.normal;
  return (
    <Card
      title="RAM"
      right={
        <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: p.color }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          {p.label}
        </span>
      }
    >
      <Big color={C.ram} suffix={mem?.total ? `/ ${(mem.total / 1024 ** 3).toFixed(0)} GB` : undefined}>
        {mem ? formatBytes(mem.used).replace(' ', '') : '—'}
      </Big>
      <Meter value={pct} color={C.ram} />
      <Row label="App">{mem ? formatBytes(mem.app) : '—'}</Row>
      <Row label="Wired + compressa">{mem ? formatBytes(mem.wired + mem.compressed) : '—'}</Row>
      <Row label="Swap">{mem ? formatBytes(mem.swapUsed) : '—'}</Row>
    </Card>
  );
}

/* --------------------------------------------------------- Temperature -- */

function tempColor(t) {
  if (t >= 85) return C.heatHigh;
  if (t >= 68) return C.heat;
  return C.cpu;
}

export function TempCard({ temp }) {
  return (
    <Card title="Temperature">
      <TempRow label="CPU" value={temp?.cpu ?? 0} />
      <TempRow label="GPU" value={temp?.gpu ?? 0} />
    </Card>
  );
}

function TempRow({ label, value }) {
  const color = tempColor(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-fog">{label}</span>
        <span className="num text-[26px] font-semibold leading-none" style={{ color }}>
          {value.toFixed(0)}
          <span className="text-[13px] text-fog">°C</span>
        </span>
      </div>
      <Meter value={(value / 100) * 100} color={color} />
    </div>
  );
}

/* -------------------------------------------------------------- Potenza -- */

export function PowerCard({ power, fans }) {
  const activeFan = (fans ?? []).find((f) => f.rpm > 0);
  return (
    <Card title="Potenza">
      <Big suffix="W">{(power?.total ?? 0).toFixed(1)}</Big>
      <div className="space-y-1">
        <Row label="CPU">{(power?.cpu ?? 0).toFixed(1)} W</Row>
        <Row label="GPU">{(power?.gpu ?? 0).toFixed(1)} W</Row>
        <Row label="ANE">{(power?.ane ?? 0).toFixed(1)} W</Row>
        <Row label="Sistema">{(power?.sys ?? 0).toFixed(1)} W</Row>
        <Row label="Ventole">
          {activeFan ? `${Math.round(activeFan.rpm)} rpm` : 'ferme'}
        </Row>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- Batteria -- */

export function BatteryCard({ battery }) {
  const pct = battery?.pct ?? 0;
  const color = battery?.charging ? C.good : pct < 20 ? C.heatHigh : C.ram;
  const state = !battery?.present
    ? 'Nessuna batteria'
    : battery.charging
      ? 'In carica'
      : battery.ac && pct >= 100
        ? 'Carica completa'
        : battery.ac
          ? 'In carica'
          : 'Su batteria';
  const remaining = battery?.remainingMin != null ? `· ${Math.floor(battery.remainingMin / 60)}h ${String(battery.remainingMin % 60).padStart(2, '0')}m` : '';
  return (
    <Card title="Batteria" right={<span className="text-[11.5px] text-fog">{state} {remaining}</span>}>
      <Big color={color} suffix="%">{pct}</Big>
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-11 rounded-[5px] border border-fog/50 p-[2px] relative">
          <div
            className="meter h-full rounded-[3px]"
            style={{ width: `${pct}%`, background: color }}
          />
          <span className="absolute -right-[5px] top-1/2 -translate-y-1/2 h-2 w-[3px] rounded-r bg-fog/50" />
        </div>
        <Meter value={pct} color={color} className="flex-1" />
      </div>
      <Row label="Autonomia residua">
        {battery?.remainingMin != null
          ? `${Math.floor(battery.remainingMin / 60)}h ${String(battery.remainingMin % 60).padStart(2, '0')}m`
          : battery?.ac
            ? 'alimentata'
            : '—'}
      </Row>
    </Card>
  );
}

/* ------------------------------------------------------- Rete / Disco --- */

export function NetCard({ net, history }) {
  return (
    <Card title="Rete">
      <div className="flex justify-between gap-4">
        <div>
          <div className="text-[11px] text-fog mb-1">Ricezione</div>
          <div className="num text-[22px] font-semibold" style={{ color: C.down }}>
            {formatBytes(net?.rxRate ?? 0)}/s
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-fog mb-1">Invio</div>
          <div className="num text-[22px] font-semibold" style={{ color: C.up }}>
            {formatBytes(net?.txRate ?? 0)}/s
          </div>
        </div>
      </div>
      <div className="flex gap-2 items-end">
        <Spark data={history.netRx} color={C.down} />
        <Spark data={history.netTx} color={C.up} invert />
      </div>
    </Card>
  );
}

export function DiskCard({ disk, history }) {
  return (
    <Card title="Disco">
      <Big suffix="MB/s">{((disk?.rate ?? 0) / 1024 ** 2).toFixed(1)}</Big>
      <Row label="Operazioni">{Math.round(disk?.ops ?? 0)} ops/s</Row>
      <Spark data={history.disk} color={C.gpu} />
    </Card>
  );
}

function Spark({ data = [], color, invert = false }) {
  const values = data.map(([, v]) => v);
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * 100;
      const y = invert ? (v / max) * 10 : 10 - (v / max) * 10;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-8 flex-1" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        opacity="0.9"
      />
    </svg>
  );
}
