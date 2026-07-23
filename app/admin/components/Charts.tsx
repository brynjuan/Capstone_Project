// File: app/admin/components/Charts.tsx

import { Activity, Clock, PieChart } from "lucide-react";

export function TrafficPanel({ activeRange, onRangeChange, dailyData, monthlyData, yearlyData }: any) {
  const rangeOptions = [ { value: "daily", label: "Harian", data: dailyData }, { value: "monthly", label: "Bulanan", data: monthlyData }, { value: "yearly", label: "Tahunan", data: yearlyData } ] as const;
  const data = rangeOptions.find((option) => option.value === activeRange)?.data ?? dailyData;
  const chartWidth = 760; const chartHeight = 260; const paddingX = 30; const paddingTop = 26; const paddingBottom = 42;
  const maxValue = Math.max(1, ...data.map((item: any) => item.value));
  const xStep = data.length > 1 ? (chartWidth - paddingX * 2) / (data.length - 1) : 0;
  const xFor = (index: number) => paddingX + xStep * index;
  const yFor = (value: number) => chartHeight - paddingBottom - (value / maxValue) * (chartHeight - paddingTop - paddingBottom);
  const points = data.map((item: any, index: number) => ({ ...item, x: xFor(index), y: yFor(item.value) }));
  const linePath = points.map((point: any, index: number) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1]; const controlOffset = xStep * 0.45;
    return `C ${previous.x + controlOffset} ${previous.y}, ${point.x - controlOffset} ${point.y}, ${point.x} ${point.y}`;
  }).join(" ");

  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 className="text-lg font-bold">Statistik Kunjungan</h3></div>
        <div className="grid h-12 grid-cols-3 rounded-xl bg-[#fdebe7] p-1 text-sm font-bold text-[#6f5752] sm:w-[340px]">
          {rangeOptions.map((opt) => (
            <button key={opt.value} type="button" onClick={() => onRangeChange(opt.value)} className={`rounded-lg transition ${activeRange === opt.value ? "bg-white text-[#b3261e] shadow-sm" : "hover:bg-white/45 hover:text-[#b3261e]"}`}>{opt.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-6 h-72">
        {data.length > 0 ? (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" role="img">
            {points.map((point: any) => <line key={`traffic-guide-${point.label}`} x1={point.x} x2={point.x} y1={paddingTop + 12} y2={chartHeight - paddingBottom + 18} stroke="#f4e3df" strokeWidth="4" strokeLinecap="round" /> )}
            <path d={linePath} fill="none" stroke="#b3261e" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point: any) => (
              <g key={`traffic-point-${point.label}`}>
                <circle cx={point.x} cy={point.y} r="8" fill="#b3261e" />
                <text x={point.x} y={chartHeight - 10} textAnchor="middle" className="fill-[#a8918c] text-[13px] font-bold">{point.label}</text>
                <text x={point.x} y={Math.max(18, point.y - 16)} textAnchor="middle" className="fill-[#b3261e] text-[13px] font-bold">{point.value}</text>
              </g>
            ))}
          </svg>
        ) : ( <div className="flex h-full w-full items-center justify-center text-sm text-[#806762]">Belum ada data statistik.</div> )}
      </div>
    </section>
  );
}

export function ProblemPanel({ activeRange, onRangeChange, dailyData, monthlyData, yearlyData }: any) {
  const rangeOptions = [ { value: "daily", label: "Harian", data: dailyData }, { value: "monthly", label: "Bulanan", data: monthlyData }, { value: "yearly", label: "Tahunan", data: yearlyData } ] as const;
  const series = rangeOptions.find((option) => option.value === activeRange)?.data ?? monthlyData;
  const chartWidth = 640; const chartHeight = 220; const padding = 28;
  const colors = ["#b3261e", "#5865d9", "#62b47d", "#e4a63a", "#a05aa6", "#0ea5e9", "#f43f5e", "#8b5cf6"];
  const labels = series[0]?.data.map((item: any) => item.label) ?? [];
  const maxValue = Math.max(1, ...series.flatMap((item: any) => item.data.map((point: any) => point.value)));
  const xStep = labels.length > 1 ? (chartWidth - padding * 2) / (labels.length - 1) : 0;
  const yFor = (value: number) => chartHeight - padding - (value / maxValue) * (chartHeight - padding * 2);
  const xFor = (index: number) => padding + xStep * index;

  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold">Permasalahan Sering</h3>
          <Activity className="h-5 w-5 text-[#b3261e]" />
        </div>
        <div className="grid h-10 grid-cols-3 rounded-xl bg-[#fdebe7] p-1 text-xs font-bold text-[#6f5752] sm:w-[280px]">
          {rangeOptions.map((opt) => (
            <button key={opt.value} type="button" onClick={() => onRangeChange(opt.value)} className={`rounded-lg transition ${activeRange === opt.value ? "bg-white text-[#b3261e] shadow-sm" : "hover:bg-white/45 hover:text-[#b3261e]"}`}>{opt.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-6">
        {series.length > 0 && series[0].data.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border border-[#f0dfdb] bg-[#fff8f6]">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-64 w-full" role="img">
                {[0, 1, 2, 3].map((line) => ( <line key={`grid-${line}`} x1={padding} x2={chartWidth - padding} y1={padding + ((chartHeight - padding * 2) / 3) * line} y2={padding + ((chartHeight - padding * 2) / 3) * line} stroke="#f1dfdb" strokeWidth="1" /> ))}
                {series.map((item: any, itemIndex: number) => {
                  const points = item.data.map((point: any, index: number) => `${xFor(index)},${yFor(point.value)}`).join(" ");
                  return (
                    <g key={item.name}>
                      <polyline points={points} fill="none" stroke={colors[itemIndex % colors.length]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {item.data.map((point: any, index: number) => (
                        <circle key={`${item.name}-${point.label}`} cx={xFor(index)} cy={yFor(point.value)} r="4" fill={colors[itemIndex % colors.length]} stroke="#ffffff" strokeWidth="2" />
                      ))}
                    </g>
                  );
                })}
                {labels.map((label: any, index: number) => ( <text key={label} x={xFor(index)} y={chartHeight - 8} textAnchor="middle" className="fill-[#806762] text-[12px] font-bold">{label}</text> ))}
              </svg>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {series.map((item: any, index: number) => (
                <div key={item.name} className="inline-flex items-center gap-2 text-xs font-semibold text-[#725b56]">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[index % colors.length] }} /> {item.name}
                </div>
              ))}
            </div>
          </>
        ) : ( <div className="flex h-64 items-center justify-center rounded-xl border border-[#f0dfdb] bg-[#fff8f6] text-sm text-[#806762]">Tren kategori akan muncul setelah data kunjungan tersedia.</div> )}
      </div>
    </section>
  );
}

export function PeakHoursPanel({ series }: { series: { label: string; value: number }[] }) {
  const chartWidth = 640; const chartHeight = 220; const paddingY = 28; const paddingX = 20;
  const maxValue = Math.max(1, ...series.map((item) => item.value));
  const barWidth = (chartWidth - paddingX * 2) / series.length * 0.6;
  const spacing = (chartWidth - paddingX * 2) / series.length;
  
  const yFor = (value: number) => chartHeight - paddingY - (value / maxValue) * (chartHeight - paddingY * 2);

  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <div><h3 className="text-lg font-bold">Jam Sibuk Kedatangan</h3></div>
        <Clock className="h-5 w-5 text-[#b3261e]" />
      </div>
      <div className="mt-6">
        <div className="overflow-hidden rounded-xl border border-[#f0dfdb] bg-[#fff8f6]">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-64 w-full" role="img">
            {[0, 1, 2, 3].map((line) => ( <line key={`grid-${line}`} x1={paddingX} x2={chartWidth - paddingX} y1={paddingY + ((chartHeight - paddingY * 2) / 3) * line} y2={paddingY + ((chartHeight - paddingY * 2) / 3) * line} stroke="#f1dfdb" strokeWidth="1" /> ))}
            
            {series.map((point, index) => {
              const x = paddingX + spacing * index + (spacing - barWidth) / 2;
              const y = yFor(point.value);
              const height = chartHeight - paddingY - y;
              return (
                <g key={`bar-${index}`}>
                  <rect x={x} y={y} width={barWidth} height={height} fill="#b3261e" rx="4" />
                  {point.value > 0 && <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="fill-[#b3261e] text-[12px] font-bold">{point.value}</text>}
                  <text x={x + barWidth / 2} y={chartHeight - 8} textAnchor="middle" className="fill-[#806762] text-[12px] font-bold">{point.label.split(":")[0]}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}

export function RatioPanel({ ratio }: { ratio: { success: number; cancelled: number } }) {
  const total = ratio.success + ratio.cancelled;
  const successPercent = total > 0 ? (ratio.success / total) * 100 : 0;
  const cancelledPercent = total > 0 ? (ratio.cancelled / total) * 100 : 0;

  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <div><h3 className="text-lg font-bold">Rasio Kunjungan Selesai</h3></div>
        <PieChart className="h-5 w-5 text-[#b3261e]" />
      </div>
      <div className="mt-6 flex flex-col items-center justify-center gap-6 p-4">
        <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-[#fcedea]">
          <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
            <path
              className="text-[#e4a63a]"
              strokeDasharray={`${cancelledPercent}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke="currentColor" strokeWidth="4"
            />
            <path
              className="text-[#62b47d]"
              strokeDasharray={`${successPercent}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke="currentColor" strokeWidth="4"
            />
          </svg>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-[#2b211f]">{Math.round(successPercent)}%</span>
            <span className="text-xs font-semibold text-[#8b7671]">Selesai</span>
          </div>
        </div>
        <div className="flex w-full justify-around text-center">
          <div>
            <p className="text-xs font-bold text-[#806762] uppercase tracking-wide">Selesai</p>
            <p className="mt-1 text-lg font-black text-[#62b47d]">{ratio.success}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-[#806762] uppercase tracking-wide">Batal/Drop-off</p>
            <p className="mt-1 text-lg font-black text-[#e4a63a]">{ratio.cancelled}</p>
          </div>
        </div>
      </div>
    </section>
  );
}