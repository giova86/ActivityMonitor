import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createSystemCollector } from './collect/system.js';
import { startMacmonStream } from './collect/macmon.js';
import { parseIostatLine } from './lib/parsers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5178);
const TICK_MS = 1000;

const exec = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, (err, stdout) => resolve(err ? '' : stdout));
  });

/** Latest per-second disk throughput from a persistent `iostat -Id -w 1`. */
function startDiskStream() {
  let latest = null;
  let child;
  const launch = () => {
    child = spawn('iostat', ['-Id', '-w', '1']);
    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        if (!line.trim()) continue;
        const parsed = parseIostatLine(line);
        if (!parsed) continue;
        latest = parsed; // first line is a boot-average; it self-corrects next tick
      }
    });
    child.on('exit', () => {
      if (!stopped) setTimeout(launch, 2000);
    });
  };
  let stopped = false;
  launch();
  return {
    get: () => latest,
    stop() {
      stopped = true;
      child?.kill();
    },
  };
}

async function hardwareInfo() {
  const [chipOut, modelOut] = await Promise.all([
    exec('sysctl', ['-n', 'machdep.cpu.brand_string']),
    exec('sysctl', ['-n', 'hw.model']),
  ]);
  return {
    chip: chipOut.trim() || 'Apple Silicon',
    model: modelOut.trim() || 'Mac',
    hostname: os.hostname(),
    cores: os.cpus().length,
    memTotal: os.totalmem(),
    osVersion: `macOS ${os.release()}`,
  };
}

async function main() {
  const hw = await hardwareInfo();
  const disk = startDiskStream();
  const collector = createSystemCollector({ getDisk: disk.get });

  let macmonData = null;
  const macmon = startMacmonStream({ onData: (d) => (macmonData = d) });

  let snapshot = null;
  const tick = async () => {
    try {
      const sys = await collector.sample();
      const [l1, l5, l15] = os.loadavg();
      snapshot = {
        ts: Date.now(),
        cpu: macmonData
          ? { ...macmonData.cpu, load: [l1, l5, l15] }
          : { total: 0, p: { usage: 0, freqMhz: 0 }, e: { usage: 0, freqMhz: 0 }, cores: [], load: [l1, l5, l15] },
        gpu: macmonData?.gpu ?? { usage: 0, freqMhz: 0 },
        temp: macmonData?.temp ?? { cpu: 0, gpu: 0 },
        power: macmonData?.power ?? { total: 0, cpu: 0, gpu: 0, ane: 0, sys: 0 },
        fans: macmonData?.fans ?? [],
        mem: sys.mem,
        net: sys.net,
        disk: sys.disk,
        battery: sys.battery,
        procs: sys.procs,
      };
      wss.clients.forEach((c) => {
        if (c.readyState === 1) c.send(JSON.stringify({ type: 'snapshot', data: snapshot }));
      });
    } catch (err) {
      console.error('[tick]', err.message);
    }
  };

  const app = express();
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/api/snapshot', (_req, res) => res.json(snapshot ?? {}));
  app.get('/api/hw', (_req, res) => res.json(hw));

  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) =>
      req.path.startsWith('/api') ? next() : res.sendFile(path.join(distDir, 'index.html'))
    );
  }

  const server = app.listen(PORT, () => {
    console.log(`mac-monitor server → http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello', data: hw }));
    if (snapshot) ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }));
  });

  const timer = setInterval(tick, TICK_MS);
  tick();

  const shutdown = () => {
    clearInterval(timer);
    macmon.stop();
    disk.stop();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
