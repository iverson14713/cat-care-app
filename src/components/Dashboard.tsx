import { Footprints, Droplets, Dumbbell, Moon, Scale } from 'lucide-react';
import type { UserProfile, DailyLog, DailyGoals } from '../types';
import { computeScore, scoreColor, today, formatDate } from '../utils';
import { ProgressRing } from './ProgressRing';

interface Props {
  profile: UserProfile;
  log: DailyLog | null;
  goals: DailyGoals;
  onAddLog: () => void;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  goal: string;
  pct: number;
  color: string;
  unit: string;
}

function MetricCard({ icon, label, value, goal, pct, color, unit }: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm">
      <div className="relative flex-shrink-0">
        <ProgressRing size={56} strokeWidth={5} progress={pct} color={color}>
          <span style={{ color }}>{icon}</span>
        </ProgressRing>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">
          {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
        </p>
        <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1">目標 {goal} {unit}</p>
      </div>
      <span
        className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {pct}%
      </span>
    </div>
  );
}

export function Dashboard({ profile, log, goals, onAddLog }: Props) {
  const score = computeScore(log ?? {}, goals);
  const ringColor = scoreColor(score.total);

  const metrics: MetricCardProps[] = [
    {
      icon: <Footprints size={18} />,
      label: '步數',
      value: (log?.steps ?? 0).toLocaleString(),
      goal: goals.steps.toLocaleString(),
      pct: score.steps,
      color: '#3b82f6',
      unit: '步',
    },
    {
      icon: <Droplets size={18} />,
      label: '喝水',
      value: (log?.water ?? 0).toFixed(1),
      goal: goals.water.toFixed(1),
      pct: score.water,
      color: '#06b6d4',
      unit: 'L',
    },
    {
      icon: <Dumbbell size={18} />,
      label: '運動',
      value: String(log?.exercise ?? 0),
      goal: String(goals.exercise),
      pct: score.exercise,
      color: '#f59e0b',
      unit: '分鐘',
    },
    {
      icon: <Moon size={18} />,
      label: '睡眠',
      value: (log?.sleep ?? 0).toFixed(1),
      goal: String(goals.sleep),
      pct: score.sleep,
      color: '#8b5cf6',
      unit: '小時',
    },
  ];

  return (
    <div className="px-4 pb-6">
      {/* Header */}
      <div className="pt-12 pb-6">
        <p className="text-sm text-gray-400">{formatDate(today())}</p>
        <h1 className="text-2xl font-bold text-gray-800 mt-0.5">嗨，{profile.name} 👋</h1>
      </div>

      {/* Score card */}
      <div
        className="rounded-3xl p-6 mb-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f766e 0%, #059669 100%)' }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/10 rounded-full translate-y-12 -translate-x-8" />
        <div className="relative flex items-center gap-6">
          <ProgressRing size={100} strokeWidth={8} progress={score.total} color="white">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-white leading-none">{score.total}</span>
              <span className="text-[10px] text-white/70">分</span>
            </div>
          </ProgressRing>
          <div>
            <p className="text-white/70 text-sm">今日健康分數</p>
            <p className="text-3xl font-black mt-0.5">{score.total}分</p>
            <p className="text-white/80 text-sm mt-1">
              {score.total >= 80 ? '表現優秀！繼續保持 💪' :
               score.total >= 50 ? '還不錯，再加把勁！' : '今天要努力一點喔～'}
            </p>
          </div>
        </div>
        {log?.weight && (
          <div className="relative mt-4 flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2 w-fit">
            <Scale size={14} />
            <span className="text-sm font-semibold">{log.weight} kg</span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="flex flex-col gap-3 mb-6">
        {metrics.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* CTA */}
      {!log ? (
        <button
          onClick={onAddLog}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-transform active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0f766e 0%, #059669 100%)' }}
        >
          新增今日紀錄
        </button>
      ) : (
        <button
          onClick={onAddLog}
          className="w-full py-4 rounded-2xl font-bold text-emerald-700 bg-emerald-50 text-base transition-transform active:scale-95"
        >
          修改今日紀錄
        </button>
      )}
    </div>
  );
}
