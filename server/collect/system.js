import { execFile } from 'node:child_process';
import { parseVmStat, parseSwap, computeMem, parseNetstat, parsePmset, parsePs, rateDiff } from '../lib/parsers.js';

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    );
  });

const PAGE_SIZE = 16384;
const TOP_CPU_COUNT = 8;
const TOP_MEM_COUNT = 6;

/**
 * Polls the BSD tools once per second and merges them into one snapshot.
 * All deps are injectable for testing: { run, getDisk, now, totalMem }.
 */
export function createSystemCollector(deps = {}) {
  const {
    run: runCmd = run,
    getDisk = () => null,
    now = Date.now,
  } = deps;

  let totalMem = deps.totalMem ?? 0;
  let prev = null;
  let prevAt = null;

  async function sample() {
    const [vmOut, swapOut, netOut, battOut, psCpuOut, psMemOut] = await Promise.all([
      runCmd('vm_stat', []),
      runCmd('sysctl', ['vm.swapusage']),
      runCmd('netstat', ['-ibn']),
      runCmd('pmset', ['-g', 'batt']),
      runCmd('ps', ['-Aceo', 'pid,pcpu,pmem,time,comm', '-r']),
      runCmd('ps', ['-Amco', 'pid,pcpu,pmem,time,comm', '-m']),
    ]);

    if (!totalMem) {
      const memOut = await runCmd('sysctl', ['-n', 'hw.memsize']);
      totalMem = Number(memOut.trim()) || 0;
    }

    const t = now();
    const dt = prevAt == null ? 0 : t - prevAt;
    const counters = parseNetstat(netOut);
    const net = prev
      ? {
          rxRate: rateDiff(prev.rx, counters.rx, dt),
          txRate: rateDiff(prev.tx, counters.tx, dt),
        }
      : { rxRate: 0, txRate: 0 };
    prev = counters;
    prevAt = t;

    const disk = getDisk();

    return {
      mem: computeMem(parseVmStat(vmOut, PAGE_SIZE), parseSwap(swapOut), totalMem),
      net,
      disk: disk
        ? { rate: disk.mb * 1024 * 1024, ops: disk.ops }
        : { rate: 0, ops: 0 },
      battery: parsePmset(battOut),
      procs: {
        cpu: parsePs(psCpuOut).slice(0, TOP_CPU_COUNT),
        mem: parsePs(psMemOut).slice(0, TOP_MEM_COUNT),
      },
    };
  }

  return { sample };
}
