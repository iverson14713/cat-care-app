import { Footprints, Droplets, Dumbbell, Moon, TrendingUp } from 'lucide-react';
import type { DailyLog, DailyGoals } from '../types';
import { getWeekDays, formatDate, computeScore, scoreColor } from '../utils';

interface Props {
  logs: Record<string, DailyLog>;
  goals: DailyGoals;
}

interface ChartBarProps {
  value: number;
  goal: number;
  label: string;
  color: string;
  isToday: boolean;
}

function ChartBar({ value, goal, label, color, isToday }: ChartBarProps) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className="relative w-full flex items-end justify-center" style={{ height: 80 }}>
        <div
          className="w-full rounded-t-lg transition-all duration-500 min-h-[4px]"
          style={{
            height: `${Math.max(4, pct * 80)}px`,
            backgroundColor: isToday ? color : `${color}60`,
          }}
        />
        {pct >= 1 && (
          <span className="absolute -top-1 text-[8px]" style={{ color }}>✓</span>
        )}
      </div>
      <span className={`text-[10px] ${isToday ? 'font-bold text-gray-700' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

interface MetricChartProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  days: string[];
  logs: Record<string, DailyLog>;
  getValue: (log: DailyLog | null) => number;
  goal: number;
  unit: string;
  format: (v: number) => string;
}

function MetricChart({ title, icon, color, days, logs, getValue, goal, unit, format }: MetricChartProps) {
  const todayStr = days[days.length - 1];
  const values = days.map(d => getValue(logs[d] ?? null));
  const avg = values.filter(v => v > 0).reduce((a, b) => a + b, 0) / (values.filter(v => v > 0).length || 1);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-700">{title}</p>
          <p className="text-[11px] text-gray-400">均值 {format(avg)} {unit} · 目標 {format(goal)} {unit}</p>
        </div>
      </div>
      <div className="flex gap-1">
        {days.map((d, i) => (
          <ChartBar
            key={d}
            value={values[i]}
            goal={goal}
            label={i === days.length - 1 ? '今' : formatDate(d).replace(/\d+月/, '').replace('日', '')}
            color={color}
            isToday={d === todayStr}
          />
        ))}
      </div>
    </div>
  );
}

export function Trends({ logs, goals }: Props) {
  const days = getWeekDays();

  const scores = days.map(d => computeScore(logs[d] ?? {}, goals).total);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return (
    <div className="px-4 pb-6">
      <div className="pt-12 pb-6">
        <h1 className="text-2xl font-bold text-gray-800">近 7 天趨勢</h1>
        <p className="text-sm text-gray-400 mt-0.5">追蹤你的健康進展</p>
      </div>

      {/* Weekly score summary */}
      <div
        className="rounded-3xl p-5 mb-4 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f766e 0%, #059669 100%)' }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
        <div className="flex items-center gap-3">
          <TrendingUp size={24} className="text-white/80" />
          <div>
            <p className="text-white/70 text-xs">本週平均分數</p>
            <p className="text-3xl font-black">{avgScore}分</p>
          </div>
        </div>
        <div className="relative flex gap-2 mt-4">
          {days.map((d, i) => {
            const s = scores[i];
            const color = scoreColor(s);
            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm"
                  style={{ height: `${Math.max(4, (s / 100) * 40)}px`, backgroundColor: 'white', opacity: s > 0 ? 0.9 : 0.3 }}
                />
                <span className="text-[9px] text-white/60">
                  {i === days.length - 1 ? '今' : formatDate(d).replace(/\d+月/, '').replace('日', '')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <MetricChart
          title="步數" icon={<Footprints size={16} />} color="#3b82f6"
          days={days} logs={logs}
          getValue={l => l?.steps ?? 0}
          goal={goals.steps} unit="步" format={v => Math.round(v).toLocaleString()}
        />
        <MetricChart
          title="喝水" icon={<Droplets size={16} />} color="#06b6d4"
          days={days} logs={logs}
          getValue={l => l?.water ?? 0}
          goal={goals.water} unit="L" format={v => v.toFixed(1)}
        />
        <MetricChart
          title="運動" icon={<Dumbbell size={16} />} color="#f59e0b"
          days={days} logs={logs}
          getValue={l => l?.exercise ?? 0}
          goal={goals.exercise} unit="分鐘" format={v => String(Math.round(v))}
        />
        <MetricChart
          title="睡眠" icon={<Moon size={16} />} color="#8b5cf6"
          days={days} logs={logs}
          getValue={l => l?.sleep ?? 0}
          goal={goals.sleep} unit="小時" format={v => v.toFixed(1)}
        />
      </div>
    </div>
  );
}
