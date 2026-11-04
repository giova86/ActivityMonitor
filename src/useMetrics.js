import { useEffect, useRef, useState } from 'react';

const WINDOW_POINTS = 300; // 5 minuti a 1 Hz

function push(buffer, key, ts, value) {
  const series = (buffer[key] ??= []);
  series.push([ts, Number.isFinite(value) ? value : 0]);
  if (series.length > WINDOW_POINTS) series.shift();
}

/**
 * Si collega al WebSocket del server e mantiene l'ultimo snapshot
 * più lo storico degli ultimi 5 minuti per i grafici a scorrimento.
 */
export function useMetrics() {
  const [snapshot, setSnapshot] = useState(null);
  const [hw, setHw] = useState(null);
  const [connected, setConnected] = useState(false);
  const historyRef = useRef({});

  useEffect(() => {
    let ws = null;
    let timer = null;
    let stopped = false;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}/ws`);

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) timer = setTimeout(connect, 1500);
      };
      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === 'hello') {
          setHw(msg.data);
          return;
        }
        if (msg.type !== 'snapshot') return;
        const d = msg.data;
        const h = historyRef.current;
        push(h, 'cpu', d.ts, d.cpu?.total);
        push(h, 'gpu', d.ts, d.gpu?.usage);
        push(h, 'tempCpu', d.ts, d.temp?.cpu);
        push(h, 'tempGpu', d.ts, d.temp?.gpu);
        push(h, 'memUsed', d.ts, d.mem?.used);
        push(h, 'netRx', d.ts, d.net?.rxRate);
        push(h, 'netTx', d.ts, d.net?.txRate);
        push(h, 'disk', d.ts, d.disk?.rate);
        setSnapshot(d);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return { snapshot, hw, connected, history: historyRef.current };
}
