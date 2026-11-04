import { describe, it, expect } from 'vitest';
import {
  parseMacmon,
  parseVmStat,
  computeMem,
  parseSwap,
  parseNetstat,
  parsePmset,
  parsePs,
  parseIostatLine,
  rateDiff,
} from '../server/lib/parsers.js';

// ---------------------------------------------------------------- macmon ---

const MACMON_FIXTURE = JSON.stringify({
  all_power: 11.6,
  ane_power: 0.0,
  cpu_active_ratio: 0.0998,
  cpu_scaled_ratio: 0.0711,
  cpu_power: 0.72,
  cpu_tiers: [
    {
      label: 'E',
      active_ratio: 0.2447,
      freq_mhz: 2170,
      cores: [
        { core_id: 0, active_ratio: 0.372, freq_mhz: 2080 },
        { core_id: 10, active_ratio: 0.303, freq_mhz: 2122 },
        { core_id: 20, active_ratio: 0.189, freq_mhz: 2235 },
        { core_id: 30, active_ratio: 0.114, freq_mhz: 2245 },
      ],
    },
    {
      label: 'P',
      active_ratio: 0.0418,
      freq_mhz: 1260,
      cores: Array.from({ length: 10 }, (_, i) => ({
        core_id: i * 10,
        active_ratio: i >= 5 ? 0.1 : 0.0,
        freq_mhz: i >= 5 ? 1911 : 0,
      })),
    },
  ],
  cpu_usage_pct: 0.0711,
  ecpu_active_ratio: 0.2447,
  ecpu_freq_mhz: 2170,
  gpu_active_ratio: 0.3067,
  gpu_freq_mhz: 338,
  gpu_power: 0.91,
  gpu_ram_power: 0.09,
  pcpu_active_ratio: 0.0418,
  pcpu_freq_mhz: 1260,
  ram_power: 0.0,
  sys_power: 9.97,
  fans: [
    { name: 'fan0', rpm: 0, max_rpm: 7826 },
    { name: 'fan1', rpm: 2100, max_rpm: 7826 },
  ],
  memory: {
    ram_total: 38654705664,
    ram_usage: 19297632256,
    swap_total: 2147483648,
    swap_usage: 1055719424,
  },
  temp: { cpu_temp_avg: 43.70493, gpu_temp_avg: 43.28343 },
  timestamp: '2026-11-03T16:37:45.584275+00:00',
});

describe('parseMacmon', () => {
  it('reads total CPU usage as a percentage of the active ratio', () => {
    const s = parseMacmon(MACMON_FIXTURE);
    expect(s.cpu.total).toBeCloseTo(10.0, 1);
  });

  it('reads per-cluster usage and frequency', () => {
    const s = parseMacmon(MACMON_FIXTURE);
    expect(s.cpu.p.usage).toBeCloseTo(4.2, 1);
    expect(s.cpu.p.freqMhz).toBe(1260);
    expect(s.cpu.e.usage).toBeCloseTo(24.5, 1);
    expect(s.cpu.e.freqMhz).toBe(2170);
  });

  it('flattens per-core data with cluster and usage percent', () => {
    const s = parseMacmon(MACMON_FIXTURE);
    expect(s.cpu.cores).toHaveLength(14);
    const first = s.cpu.cores.find((c) => c.cluster === 'E' && c.id === 0);
    expect(first.usage).toBeCloseTo(37.2, 1);
    expect(first.freqMhz).toBe(2080);
    const pCores = s.cpu.cores.filter((c) => c.cluster === 'P');
    expect(pCores).toHaveLength(10);
    expect(pCores[5].usage).toBeCloseTo(10, 1);
  });

  it('reads GPU usage and frequency', () => {
    const s = parseMacmon(MACMON_FIXTURE);
    expect(s.gpu.usage).toBeCloseTo(30.7, 1);
    expect(s.gpu.freqMhz).toBe(338);
  });

  it('reads temperatures rounded to one decimal', () => {
    const s = parseMacmon(MACMON_FIXTURE);
    expect(s.temp.cpu).toBe(43.7);
    expect(s.temp.gpu).toBe(43.3);
  });

  it('folds gpu ram power into gpu power and exposes total and sys power', () => {
    const s = parseMacmon(MACMON_FIXTURE);
    expect(s.power.gpu).toBeCloseTo(1.0, 1);
    expect(s.power.cpu).toBeCloseTo(0.7, 1);
    expect(s.power.total).toBeCloseTo(11.6, 1);
    expect(s.power.sys).toBeCloseTo(10.0, 1);
  });

  it('reads memory totals and swap usage', () => {
    const s = parseMacmon(MACMON_FIXTURE);
    expect(s.memory.total).toBe(38654705664);
    expect(s.memory.swapUsed).toBe(1055719424);
  });

  it('reads fans', () => {
    const s = parseMacmon(MACMON_FIXTURE);
    expect(s.fans).toEqual([
      { name: 'fan0', rpm: 0, maxRpm: 7826 },
      { name: 'fan1', rpm: 2100, maxRpm: 7826 },
    ]);
  });

  it('returns null for malformed input instead of throwing', () => {
    expect(parseMacmon('not json')).toBeNull();
    expect(parseMacmon('{"foo":1}')).toBeNull();
  });
});

// --------------------------------------------------------------- vm_stat ---

const VM_STAT_FIXTURE = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                   511591.
Pages active:                                 728445.
Pages inactive:                               700720.
Pages speculative:                             29100.
Pages throttled:                                   0.
Pages wired down:                             277542.
Pages purgeable:                              162512.
"Translation faults":                      358957197.
Pages copy-on-write:                        14040105.
Pages zero filled:                         712943469.
Pages reactivated:                           7651568.
Pages purged:                                4038897.
File-backed pages:                            448141.
Anonymous pages:                             1010124.
Pages stored in compressor:                   137941.
Pages occupied by compressor:                  55353.
Decompressions:                              9939476.
Compressions:                              13318107.
Pageins:                                    17449259.
Pageouts:                                       2556.
Swapins:                                      270597.
Swapouts:                                     493622.
`;

describe('parseVmStat', () => {
  it('converts page counters to bytes using the page size', () => {
    const v = parseVmStat(VM_STAT_FIXTURE, 16384);
    expect(v.free).toBe(511591 * 16384);
    expect(v.active).toBe(728445 * 16384);
    expect(v.wired).toBe(277542 * 16384);
    expect(v.compressed).toBe(55353 * 16384);
    expect(v.inactive).toBe(700720 * 16384);
    expect(v.speculative).toBe(29100 * 16384);
  });
});

describe('computeMem', () => {
  const pageSize = 16384;
  const vm = parseVmStat(VM_STAT_FIXTURE, pageSize);
  const total = 38654705664;
  const swap = { total: 2048 * 1024 * 1024, used: 1006.81 * 1024 * 1024 };

  it('counts used memory as wired + active + compressed', () => {
    const m = computeMem(vm, swap, total);
    expect(m.used).toBe((277542 + 728445 + 55353) * pageSize);
  });

  it('reports app memory as the remainder of used after wired and compressed', () => {
    const m = computeMem(vm, swap, total);
    expect(m.app).toBe(m.used - m.wired - m.compressed);
  });

  it('passes swap through in bytes', () => {
    const m = computeMem(vm, swap, total);
    expect(m.swapTotal).toBe(swap.total);
    expect(m.swapUsed).toBeCloseTo(swap.used, 0);
  });

  it('classifies pressure as normal under 75%', () => {
    const lowVm = { free: 0, active: 1, inactive: 0, speculative: 0, wired: 0, compressed: 0 };
    expect(computeMem(lowVm, { total: 0, used: 0 }, total).pressure).toBe('normal');
  });

  it('classifies pressure as warning between 75% and 90%', () => {
    const vmWarn = { free: 0, active: total * 0.8, inactive: 0, speculative: 0, wired: 0, compressed: 0 };
    expect(computeMem(vmWarn, { total: 0, used: 0 }, total).pressure).toBe('warning');
  });

  it('classifies pressure as critical at 90% or above', () => {
    const vmCrit = { free: 0, active: total * 0.95, inactive: 0, speculative: 0, wired: 0, compressed: 0 };
    expect(computeMem(vmCrit, { total: 0, used: 0 }, total).pressure).toBe('critical');
  });
});

describe('parseSwap', () => {
  it('reads total and used swap in bytes from sysctl output', () => {
    const out = 'vm.swapusage: total = 2048.00M  used = 1006.81M  free = 1041.19M  (encrypted)';
    const s = parseSwap(out);
    expect(s.total).toBe(2048 * 1024 * 1024);
    expect(s.used).toBeCloseTo(1006.81 * 1024 * 1024, 0);
  });

  it('reads K and G suffixes too', () => {
    expect(parseSwap('vm.swapusage: total = 1.00G  used = 512.00K  free = 0B').used).toBe(512 * 1024);
  });
});

// --------------------------------------------------------------- network ---

const NETSTAT_FIXTURE = `Name       Mtu  Link/Ipacket/Ibytes/Oacket/Obytes
en0        1500  <Link#15>   16:50:49:76:cf:6f  6891988     0 8479923644   787772     0  261602670     0
en0        1500  fe80::14af: fe80:f::14af:93b0  6891988     - 8479923644   787772     -  261602670     -
en0        1500  10.90/16      10.90.3.199      6891988     - 8479923644   787772     -  261602670     -
en4        1500  <Link#20>   aa:bb:cc:dd:ee:ff      1000     0      123456       900     0       654321     0
lo0        16384 <Link#1>                        12345678     0  999999999 12345678     0  999999999     0
gif0       1280  <Link#2>                             0     0          0        0     0          0     0
utun4      1380  <Link#40>                            0     0          0        0     0          0     0
`;

describe('parseNetstat', () => {
  it('aggregates rx and tx bytes over physical en interfaces only', () => {
    const n = parseNetstat(NETSTAT_FIXTURE);
    expect(n.rx).toBe(8479923644 + 123456);
    expect(n.tx).toBe(261602670 + 654321);
  });

  it('returns zeros for empty output', () => {
    expect(parseNetstat('Name Mtu\n')).toEqual({ rx: 0, tx: 0 });
  });
});

describe('rateDiff', () => {
  it('computes a per-second byte rate between two counter readings', () => {
    expect(rateDiff(1000, 3000, 2000)).toBe(1000);
  });

  it('clamps counter resets to zero instead of going negative', () => {
    expect(rateDiff(3000, 1000, 1000)).toBe(0);
  });

  it('returns zero on a non-positive time delta', () => {
    expect(rateDiff(1000, 2000, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------- battery --

describe('parsePmset', () => {
  it('reads a charging laptop on AC power', () => {
    const out = `Now drawing from 'AC Power'
 -InternalBattery-0 (id=23527523)\t84%; charging; 1:05 remaining present: true`;
    expect(parsePmset(out)).toEqual({
      ac: true,
      pct: 84,
      charging: true,
      remainingMin: 65,
      present: true,
    });
  });

  it('reads a charged machine with no time remaining', () => {
    const out = `Now drawing from 'AC Power'
 -InternalBattery-0 (id=23527523)\t100%; charged; 0:00 remaining present: true`;
    expect(parsePmset(out)).toEqual({
      ac: true,
      pct: 100,
      charging: false,
      remainingMin: null,
      present: true,
    });
  });

  it('reads a discharging laptop on battery', () => {
    const out = `Now drawing from 'Battery Power'
 -InternalBattery-0 (id=23527523)\t63%; discharging; 4:30 remaining present: true`;
    const b = parsePmset(out);
    expect(b.ac).toBe(false);
    expect(b.charging).toBe(false);
    expect(b.remainingMin).toBe(270);
  });

  it('marks present false for desktops without a battery', () => {
    expect(parsePmset("Now drawing from 'AC Power'").present).toBe(false);
  });
});

// -------------------------------------------------------------- processes --

describe('parsePs', () => {
  it('parses pid, cpu, mem and cpu-time columns with spaces in the name', () => {
    const out = `  PID  %CPU %MEM      TIME COMM
  416  43.8  0.5   1:12.34 WindowServer
71665  29.1  0.3     0:04.21 OpenCode Helper (Renderer)
`;
    expect(parsePs(out)).toEqual([
      { pid: 416, cpu: 43.8, mem: 0.5, time: '1:12.34', name: 'WindowServer' },
      { pid: 71665, cpu: 29.1, mem: 0.3, time: '0:04.21', name: 'OpenCode Helper (Renderer)' },
    ]);
  });
});

// ------------------------------------------------------------------ disk --

describe('parseIostatLine', () => {
  it('sums transfers and MB across disks on a numeric sample line', () => {
    const d = parseIostatLine('   41.91 9791121 400758.21     5.05 774  3.82     5.04 781  3.85 ');
    expect(d.ops).toBe(9791121 + 774 + 781);
    expect(d.mb).toBeCloseTo(400758.21 + 3.82 + 3.85, 2);
  });

  it('returns null for header lines', () => {
    expect(parseIostatLine('              disk0               disk4 ')).toBeNull();
    expect(parseIostatLine('    KB/t xfrs   MB     KB/t xfrs   MB ')).toBeNull();
  });
});
