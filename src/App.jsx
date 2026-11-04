import { useMetrics } from './useMetrics.js';
import Header from './components/Header.jsx';
import SeriesChart from './components/SeriesChart.jsx';
import ProcessTable from './components/ProcessTable.jsx';
import {
  CpuCard,
  GpuCard,
  RamCard,
  TempCard,
  PowerCard,
  BatteryCard,
  NetCard,
  DiskCard,
} from './components/panels.jsx';

export default function App() {
  const { snapshot, hw, connected, history } = useMetrics();

  if (!snapshot) {
    return (
      <main className="max-w-[1380px] mx-auto px-6 py-16 text-center">
        <p className="text-fog text-[14px]">
          {connected
            ? 'In attesa dei primi campioni dai sensori…'
            : 'Connessione al server persa, nuovo tentativo in corso…'}
        </p>
      </main>
    );
  }

  const tempMax = Math.max(40, ...history.tempCpu.map(([, v]) => v), ...history.tempGpu.map(([, v]) => v));

  return (
    <main className="max-w-[1380px] mx-auto px-6 py-5">
      <Header hw={hw} connected={connected} cpuTotal={snapshot.cpu?.total ?? 0} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <CpuCard cpu={snapshot.cpu} />
        <GpuCard gpu={snapshot.gpu} power={snapshot.power} hw={hw} />
        <RamCard mem={snapshot.mem} />
        <TempCard temp={snapshot.temp} />
        <PowerCard power={snapshot.power} fans={snapshot.fans} />
        <BatteryCard battery={snapshot.battery} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2 card p-5">
          <h2 className="text-[13px] font-medium tracking-wide text-fog mb-3">
            CPU &amp; GPU · ultimi 5 minuti
          </h2>
          <SeriesChart
            legend
            yMax={100}
            yFormat={(v) => `${v}%`}
            series={[
              { name: 'CPU', color: '#56c7f5', data: history.cpu },
              { name: 'GPU', color: '#a08bff', data: history.gpu },
            ]}
            height={170}
          />
          <div className="mt-4 mb-2">
            <h2 className="text-[13px] font-medium tracking-wide text-fog">Temperature</h2>
          </div>
          <SeriesChart
            legend
            yMax={Math.ceil(tempMax / 10) * 10 + 10}
            yMin={30}
            yFormat={(v) => `${v}°`}
            series={[
              { name: 'CPU', color: '#ffb454', data: history.tempCpu },
              { name: 'GPU', color: '#ff6b6b', data: history.tempGpu },
            ]}
            height={140}
          />
        </div>
        <div className="flex flex-col gap-4">
          <NetCard net={snapshot.net} history={history} />
          <DiskCard disk={snapshot.disk} history={history} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ProcessTable procs={snapshot.procs} memTotal={snapshot.mem?.total ?? 0} />
        </div>
        <div className="card p-5">
          <h2 className="text-[13px] font-medium tracking-wide text-fog mb-3">Carico di memoria</h2>
          <SeriesChart
            yMax={Math.ceil(((snapshot.mem?.total ?? 1) / 1024 ** 3) / 8) * 8}
            yMin={0}
            yFormat={(v) => `${v} GB`}
            series={[
              {
                name: 'Usata',
                color: '#3fd9a4',
                data: history.memUsed.map(([t, v]) => [t, v / 1024 ** 3]),
              },
            ]}
            height={230}
          />
        </div>
      </div>

      <footer className="mt-6 pb-4 flex justify-between text-[11px] text-fog/70">
        <span>macmon · vm_stat · netstat · pmset · ps · iostat — 1 Hz</span>
        <span>{hw?.hostname}</span>
      </footer>
    </main>
  );
}
