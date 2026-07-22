import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getScanTrends, type TrendPoint } from "../lib/trends.functions";

type MetricKey = "wellness" | "heartRate" | "bpSys" | "hrv" | "spo2" | "bmi";

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: "wellness", label: "Wellness", unit: "", color: "oklch(0.72 0.16 180)" },
  { key: "heartRate", label: "Heart Rate", unit: "bpm", color: "oklch(0.62 0.20 25)" },
  { key: "bpSys", label: "Blood Pressure", unit: "mmHg", color: "oklch(0.60 0.18 245)" },
  { key: "hrv", label: "HRV", unit: "ms", color: "oklch(0.66 0.18 285)" },
  { key: "spo2", label: "SpO₂", unit: "%", color: "oklch(0.70 0.16 160)" },
  { key: "bmi", label: "BMI", unit: "", color: "oklch(0.72 0.15 70)" },
];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function TrendsSection({
  countryCode,
  mobile,
}: {
  countryCode: string;
  mobile: string;
}) {
  const [points, setPoints] = useState<TrendPoint[] | null>(null);
  const [metric, setMetric] = useState<MetricKey>("wellness");

  useEffect(() => {
    let cancelled = false;
    getScanTrends({ data: { countryCode, mobile } })
      .then((res) => {
        if (!cancelled) setPoints(res.points);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, mobile]);

  const active = METRICS.find((m) => m.key === metric)!;

  const chartData = useMemo(() => {
    if (!points) return [];
    return points
      .map((p) => ({ date: fmtDate(p.at), value: p[metric] }))
      .filter((d) => typeof d.value === "number");
  }, [points, metric]);

  if (points === null) return null; // loading — stay quiet
  if (points.length < 1) return null;

  const scans = points.length;
  const firstDate = fmtDate(points[0].at);
  const bestWellness = points.reduce(
    (best, p) => (typeof p.wellness === "number" && p.wellness > best ? p.wellness : best),
    0,
  );

  // Delta vs previous scan for the active metric
  let delta: number | null = null;
  if (chartData.length >= 2) {
    const last = chartData[chartData.length - 1].value as number;
    const prev = chartData[chartData.length - 2].value as number;
    delta = Math.round((last - prev) * 10) / 10;
  }

  return (
    <div className="mt-16 animate-fade-up">
      <div className="text-center">
        <div className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
          Your Trends
        </div>
        <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-gradient">
          Progress over time
        </h2>
      </div>

      {scans < 2 ? (
        <div className="mt-6 mx-auto max-w-xl glass p-6 text-center" style={{ borderRadius: "1.25rem" }}>
          <p className="text-base text-muted-foreground">
            This is your first scan on this number. Scan again later to unlock your trend graphs. 📈
          </p>
        </div>
      ) : (
        <div className="mt-6 mx-auto max-w-3xl glass p-5 sm:p-6" style={{ borderRadius: "1.5rem" }}>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            <div className="rounded-2xl bg-white/5 px-3 py-3">
              <div className="text-2xl font-bold">{scans}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Scans</div>
            </div>
            <div className="rounded-2xl bg-white/5 px-3 py-3">
              <div className="text-2xl font-bold">{firstDate}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">First scan</div>
            </div>
            <div className="rounded-2xl bg-white/5 px-3 py-3">
              <div className="text-2xl font-bold">{bestWellness || "—"}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Best score</div>
            </div>
          </div>

          {/* Metric selector */}
          <div className="flex flex-wrap gap-2 justify-center mb-5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  metric === m.key
                    ? "text-white shadow-lg"
                    : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
                style={metric === m.key ? { background: m.color } : undefined}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Delta chip */}
          {delta !== null && (
            <div className="flex justify-center mb-3">
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold"
                style={{
                  background: `color-mix(in oklab, ${active.color} 15%, transparent)`,
                  color: active.color,
                }}
              >
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {delta > 0 ? "+" : ""}
                {delta} {active.unit} since last scan
              </span>
            </div>
          )}

          {chartData.length >= 2 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={active.color} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={active.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.2 0.02 240 / 0.95)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: "0.75rem",
                      color: "white",
                      fontSize: "0.85rem",
                    }}
                    formatter={(v: number) => [`${v}${active.unit ? " " + active.unit : ""}`, active.label]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={active.color}
                    strokeWidth={3}
                    fill="url(#trendFill)"
                    dot={{ r: 4, fill: active.color, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              Not enough data points for this metric yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}