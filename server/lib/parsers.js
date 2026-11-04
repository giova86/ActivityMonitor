/**
 * Pure parsing helpers for macOS system metrics.
 * Everything here is side-effect free: text or JSON in, plain objects out.
 * The raw sources are `macmon pipe` JSON lines, `vm_stat`, `sysctl`,
 * `netstat -ibn`, `pmset -g batt`, `ps` and `iostat -Id`.
 */

const round1 = (n) => Math.round(n * 10) / 10;
const pct1 = (ratio) => round1((Number(ratio) || 0) * 100);

export function parseMacmon(line) {
  let d;
  try {
    d = JSON.parse(line);
  } catch {
    return null;
  }
  if (!d || typeof d.cpu_active_ratio !== 'number' || !Array.isArray(d.cpu_tiers)) {
    return null;
  }

  const cores = [];
  for (const tier of d.cpu_tiers) {
    const cluster = tier.label === 'E' ? 'E' : 'P';
    (tier.cores ?? []).forEach((c, id) => {
      cores.push({
        cluster,
        id,
        usage: pct1(c.active_ratio),
        freqMhz: c.freq_mhz ?? 0,
      });
    });
  }

  return {
    ts: d.timestamp ?? new Date().toISOString(),
    cpu: {
      total: pct1(d.cpu_active_ratio),
      p: { usage: pct1(d.pcpu_active_ratio), freqMhz: d.pcpu_freq_mhz ?? 0 },
      e: { usage: pct1(d.ecpu_active_ratio), freqMhz: d.ecpu_freq_mhz ?? 0 },
      cores,
    },
    gpu: {
      usage: pct1(d.gpu_active_ratio),
      freqMhz: d.gpu_freq_mhz ?? 0,
    },
    temp: {
      cpu: round1(d.temp?.cpu_temp_avg ?? 0),
      gpu: round1(d.temp?.gpu_temp_avg ?? 0),
    },
    power: {
      total: round1(d.all_power ?? 0),
      cpu: round1(d.cpu_power ?? 0),
      gpu: round1((d.gpu_power ?? 0) + (d.gpu_ram_power ?? 0)),
      ane: round1(d.ane_power ?? 0),
      sys: round1(d.sys_power ?? 0),
    },
    memory: {
      total: d.memory?.ram_total ?? 0,
      used: d.memory?.ram_usage ?? 0,
      swapTotal: d.memory?.swap_total ?? 0,
      swapUsed: d.memory?.swap_usage ?? 0,
    },
    fans: (d.fans ?? []).map((f) => ({ name: f.name, rpm: f.rpm ?? 0, maxRpm: f.max_rpm ?? 0 })),
  };
}

const VM_STAT_KEYS = {
  'Pages free': 'free',
  'Pages active': 'active',
  'Pages inactive': 'inactive',
  'Pages speculative': 'speculative',
  'Pages wired down': 'wired',
  'Pages occupied by compressor': 'compressed',
};

export function parseVmStat(text, pageSize) {
  const out = { free: 0, active: 0, inactive: 0, speculative: 0, wired: 0, compressed: 0 };
  for (const raw of text.split('\n')) {
    const m = raw.match(/^(.*?)\s*:\s*([\d,.]+)\s*\.?$/);
    if (!m) continue;
    const key = VM_STAT_KEYS[m[1].trim()];
    if (key) out[key] = Math.round(parseFloat(m[2].replace(/,/g, '')) * pageSize);
  }
  return out;
}

export function computeMem(vm, swap, totalBytes) {
  const wired = vm.wired ?? 0;
  const active = vm.active ?? 0;
  const compressed = vm.compressed ?? 0;
  const used = wired + active + compressed;
  const pct = totalBytes > 0 ? used / totalBytes : 0;
  const pressure = pct >= 0.9 ? 'critical' : pct >= 0.75 ? 'warning' : 'normal';
  return {
    total: totalBytes,
    used,
    wired,
    compressed,
    app: used - wired - compressed,
    swapTotal: swap?.total ?? 0,
    swapUsed: swap?.used ?? 0,
    pressure,
  };
}

export function parseSwap(text) {
  const read = (label) => {
    const m = text.match(new RegExp(`${label}\\s*=\\s*([\\d.]+)\\s*([BKMG])`));
    if (!m) return 0;
    const mult = { B: 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[2]];
    return Math.round(parseFloat(m[1]) * mult);
  };
  return { total: read('total'), used: read('used') };
}

export function parseNetstat(text) {
  let rx = 0;
  let tx = 0;
  const seen = new Set();
  for (const raw of text.split('\n')) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 10 || !/^en\d+$/.test(parts[0]) || !parts[2]?.startsWith('<Link#')) continue;
    if (seen.has(parts[0])) continue;
    seen.add(parts[0]);
    rx += Number(parts[6]) || 0;
    tx += Number(parts[9]) || 0;
  }
  return { rx, tx };
}

export function rateDiff(prev, cur, dtMs) {
  if (!dtMs || dtMs <= 0) return 0;
  if (cur < prev) return 0; // counter reset (e.g. interface re-created)
  return (cur - prev) / (dtMs / 1000);
}

export function parsePmset(text) {
  const ac = /'AC Power'/.test(text);
  const m = text.match(/(\d+)%;\s*(\w+);\s*(\d+):(\d+)\s+remaining\s+present:\s*(true|false)/);
  if (!m) {
    return { ac, pct: 0, charging: false, remainingMin: null, present: false };
  }
  const [, pct, state, h, min, present] = m;
  const remainingMin = `${h}:${min}` === '0:00' ? null : Number(h) * 60 + Number(min);
  return {
    ac,
    pct: Number(pct),
    charging: state === 'charging',
    remainingMin,
    present: present === 'true',
  };
}

export function parsePs(text) {
  const rows = [];
  for (const raw of text.split('\n')) {
    const m = raw.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d:.]+)\s+(.+)$/);
    if (!m) continue;
    rows.push({
      pid: Number(m[1]),
      cpu: Number(m[2]),
      mem: Number(m[3]),
      time: m[4],
      name: m[5].trim(),
    });
  }
  return rows;
}

export function parseIostatLine(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0 || tokens.length % 3 !== 0) return null;
  let ops = 0;
  let mb = 0;
  for (let i = 0; i < tokens.length; i += 3) {
    const xfrs = Number(tokens[i + 1]);
    const mbs = Number(tokens[i + 2]);
    if (!Number.isFinite(xfrs) || !Number.isFinite(mbs)) return null;
    ops += xfrs;
    mb += mbs;
  }
  return { ops, mb };
}
