# Monitor · MacBook Pro

Dashboard web per il monitoraggio in tempo reale del MacBook Pro (Apple Silicon):
CPU con core P/E e frequenze, GPU, RAM e pressione memoria, temperature, potenza,
ventole, batteria, rete, disco e processi principali. I grafici scorrono sugli
ultimi 5 minuti, aggiornati a 1 Hz via WebSocket.

## Avvio

Prerequisiti: macOS su Apple Silicon, Node.js ≥ 20, `macmon` per sensori e temperature
(`brew install macmon`).

```bash
npm install
npm run build
npm start
```

Apri **http://localhost:5178** nel browser.

## Sviluppo

```bash
npm run dev    # server + client con hot reload (client su :5173, proxy su :5178)
npm test       # suite di test (vitest)
```

## Come funziona

- `server/collect/macmon.js` — tiene vivo `macmon pipe` (CPU per core, GPU,
  temperature, potenza, ventole) e lo riavvia se muore.
- `server/collect/system.js` — raccoglie a 1 Hz `vm_stat`, `sysctl`, `netstat`,
  `pmset -g batt` e `ps` per memoria, swap, rete, batteria e processi.
- `server/collect/iostat` (in `server/index.js`) — stream persistente di
  `iostat -Id -w 1` per il throughput del disco.
- `server/lib/parsers.js` — tutti i parser puri, coperti da test.
- `src/` — dashboard React + ECharts + Tailwind; lo storico a 300 punti vive nel browser.

## Note

- Le temperature richiedono `macmon`, che non ha bisogno di admin su Apple Silicon.
- `ps` di macOS non espone i thread per processo: la tabella mostra il tempo CPU.
- Il disco è combinato (lettura+scrittura) perché i contatori separati non sono
  esposti dai driver NVMe di Apple senza privilegi elevati.
