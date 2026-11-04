import { describe, it, expect, vi } from 'vitest';
import { createSystemCollector } from '../server/collect/system.js';
import { startMacmonStream } from '../server/collect/macmon.js';

const VM = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                   1000.
Pages active:                                 2000.
Pages inactive:                               500.
Pages speculative:                            100.
Pages wired down:                             300.
Pages occupied by compressor:                 50.
`;
const SWAP = 'vm.swapusage: total = 2048.00M  used = 100.00M  free = 1948.00M  (encrypted)';
const PMSET = `Now drawing from 'Battery Power'
 -InternalBattery-0 (id=1)\t63%; discharging; 4:30 remaining present: true`;
const NET1 = `Name       Mtu  Link/Ipacket/Ibytes/Oacket/Obytes
en0        1500  <Link#15>   aa:bb:cc:dd:ee:ff  1000  0  1000  1000  0  2000  0
`;
const NET2 = `Name       Mtu  Link/Ipacket/Ibytes/Oacket/Obytes
en0        1500  <Link#15>   aa:bb:cc:dd:ee:ff  1000  0  3000  1000  0  4000  0
`;
const PS_CPU = `  PID  %CPU %MEM      TIME COMM
  416  43.8  0.5   1:12.34 WindowServer
`;
const PS_MEM = `  PID  %CPU %MEM      TIME COMM
  416   4.8  3.1     0:08.10 com.apple.WebKit.WebContent
`;

function makeDeps({ net = NET1, disk = null, nowSeq = [0, 1000] } = {}) {
  let tick = 0;
  const run = vi.fn(async (cmd, args) => {
    const key = [cmd, ...args].join(' ');
    if (key.startsWith('vm_stat')) return VM;
    if (key.startsWith('sysctl')) return SWAP;
    if (key.startsWith('netstat')) return net;
    if (key.startsWith('pmset')) return PMSET;
    if (key.includes('-r')) return PS_CPU;
    if (key.includes('-m')) return PS_MEM;
    throw new Error(`unexpected command: ${key}`);
  });
  return {
    run,
    getDisk: () => disk,
    now: () => nowSeq[Math.min(tick++, nowSeq.length - 1)],
  };
}

describe('createSystemCollector', () => {
  it('merges every source into one snapshot object', async () => {
    const c = createSystemCollector(makeDeps());
    const s = await c.sample();
    expect(s.mem.wired).toBe(300 * 16384);
    expect(s.mem.swapUsed).toBe(100 * 1024 * 1024);
    expect(s.mem.pressure).toBe('normal');
    expect(s.battery).toEqual({
      ac: false,
      pct: 63,
      charging: false,
      remainingMin: 270,
      present: true,
    });
    expect(s.procs.cpu).toEqual([
      { pid: 416, cpu: 43.8, mem: 0.5, time: '1:12.34', name: 'WindowServer' },
    ]);
    expect(s.procs.mem[0].name).toBe('com.apple.WebKit.WebContent');
  });

  it('reports zero network rates on the very first sample', async () => {
    const c = createSystemCollector(makeDeps());
    const s = await c.sample();
    expect(s.net.rxRate).toBe(0);
    expect(s.net.txRate).toBe(0);
  });

  it('computes network rates between consecutive samples', async () => {
    let net = NET1;
    const deps = makeDeps();
    const baseRun = deps.run;
    deps.run = vi.fn(async (cmd, args) => {
      const key = [cmd, ...args].join(' ');
      if (key.startsWith('netstat')) return net;
      return baseRun(cmd, args);
    });
    const c = createSystemCollector(deps);
    await c.sample();
    net = NET2;
    const s = await c.sample();
    // +2000 bytes over 1000 ms → 2000 B/s both ways
    expect(s.net.rxRate).toBe(2000);
    expect(s.net.txRate).toBe(2000);
  });

  it('converts the latest iostat interval into bytes and ops per second', async () => {
    const deps = makeDeps({ disk: { ops: 120, mb: 2.5 } });
    const c = createSystemCollector(deps);
    const s = await c.sample();
    expect(s.disk.rate).toBe(2.5 * 1024 * 1024);
    expect(s.disk.ops).toBe(120);
  });

  it('falls back to zero disk activity when iostat has not produced a line yet', async () => {
    const c = createSystemCollector(makeDeps({ disk: null }));
    const s = await c.sample();
    expect(s.disk).toEqual({ rate: 0, ops: 0 });
  });
});

describe('startMacmonStream', () => {
  function fakeChild() {
    const handlers = {};
    const stdoutHandlers = {};
    return {
      stdout: {
        on: (ev, fn) => {
          (stdoutHandlers[ev] ??= []).push(fn);
        },
        emit(ev, ...args) {
          (stdoutHandlers[ev] ?? []).forEach((fn) => fn(...args));
        },
      },
      on: (ev, fn) => {
        (handlers[ev] ??= []).push(fn);
      },
      kill: vi.fn(),
      emit(ev, ...args) {
        (handlers[ev] ?? []).forEach((fn) => fn(...args));
      },
    };
  }

  it('delivers parsed snapshots from stdout lines', () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child);
    const onData = vi.fn();
    startMacmonStream({ spawn, onData });
    child.stdout.emit('data', Buffer.from('{"foo":1}\n'));
    child.stdout.emit(
      'data',
      Buffer.from(
        '{"cpu_active_ratio":0.5,"cpu_tiers":[],"gpu_active_ratio":0.1,"temp":{"cpu_temp_avg":40,"gpu_temp_avg":40}}\n'
      )
    );
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData.mock.calls[0][0].cpu.total).toBe(50);
  });

  it('respawns macmon when the process exits', () => {
    const spawn = vi.fn(() => fakeChild());
    startMacmonStream({ spawn, onData: vi.fn(), restartDelayMs: 0, now: () => 0 });
    expect(spawn).toHaveBeenCalledTimes(1);
    spawn.mock.results[0].value.emit('exit');
    // restart is scheduled via setTimeout; with 0 delay we only assert respawn was scheduled
    // by checking a new spawn happens after flushing the timer queue
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(spawn).toHaveBeenCalledTimes(2);
        resolve();
      }, 10);
    });
  });
});
