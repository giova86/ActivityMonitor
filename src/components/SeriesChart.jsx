import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const AXIS_LABEL = {
  color: '#5b6478',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 10,
};

/**
 * Grafico a linee a scorrimento su ECharts.
 * series: [{ name, color, data: [[ts, v], ...], area?: boolean }]
 */
export default function SeriesChart({
  series,
  height = 150,
  yMax,
  yMin = 0,
  yFormat = (v) => `${v}`,
  legend = false,
}) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    chartRef.current = echarts.init(ref.current, null, { renderer: 'canvas' });
    const observer = new ResizeObserver(() => chartRef.current.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chartRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    chartRef.current.setOption({
      animation: !reduced,
      animationDuration: 300,
      animationDurationUpdate: 700,
      animationEasingUpdate: 'linear',
      grid: { left: 6, right: 10, top: legend ? 26 : 10, bottom: 2, containLabel: true },
      legend: legend
        ? {
            top: 0,
            right: 0,
            icon: 'roundRect',
            itemWidth: 10,
            itemHeight: 3,
            textStyle: { color: '#8d97ab', fontSize: 11 },
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#161c2b',
        borderColor: '#242d41',
        textStyle: { color: '#e8edf6', fontSize: 11 },
        axisPointer: { type: 'line', lineStyle: { color: '#3a4560' } },
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: '#242d41' } },
        axisTick: { show: false },
        axisLabel: {
          ...AXIS_LABEL,
          hideOverlap: true,
          formatter: (v) => new Date(v).toTimeString().slice(0, 8),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        axisLabel: { ...AXIS_LABEL, formatter: yFormat },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: series.map((s) => ({
        name: s.name,
        type: 'line',
        showSymbol: false,
        smooth: 0.3,
        sampling: 'lttb',
        lineStyle: { width: 1.6, color: s.color },
        itemStyle: { color: s.color },
        areaStyle:
          s.area === false
            ? undefined
            : {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: `${s.color}3a` },
                  { offset: 1, color: `${s.color}00` },
                ]),
              },
        data: s.data,
      })),
    });
  }, [series, yMax, yMin, legend]);

  return <div ref={ref} style={{ height }} role="img" aria-label="grafico andamento" />;
}
