import { spawn } from 'node:child_process';
import { parseMacmon } from '../lib/parsers.js';

/**
 * Keeps `macmon pipe` alive and pushes each parsed JSON line to onData.
 * Respawns with a backoff if the child dies. deps injectable for testing.
 */
export function startMacmonStream({
  spawn: spawnFn = spawn,
  onData,
  restartDelayMs = 2000,
} = {}) {
  let child = null;
  let stopped = false;
  let timer = null;

  const launch = () => {
    child = spawnFn('macmon', ['pipe', '-i', '1000']);
    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        const parsed = parseMacmon(line);
        if (parsed) onData(parsed);
      }
    });
    child.on('exit', () => {
      if (stopped) return;
      timer = setTimeout(launch, restartDelayMs);
    });
  };

  launch();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      child?.kill();
    },
  };
}
