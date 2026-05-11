import { useState } from 'react';
import { ChevronLeft, Footprints, Droplets, Dumbbell, Moon, Scale, Check } from 'lucide-react';
import type { DailyLog, DailyGoals } from '../types';
import { today } from '../utils';

interface Props {
  existing: DailyLog | null;
  goals: DailyGoals;
  onSave: (log: DailyLog) => void;
  onBack: () => void;
}

interface FieldConfig {
  key: keyof Omit<DailyLog, 'date'>;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  icon: React.ReactNode;
  color: string;
  goal?: number;
  placeholder: string;
}

const fields: FieldConfig[] = [
  { key: 'steps', label: '步數', unit: '步', step: 100, min: 0, max: 100000, icon: <Footprints size={20} />, color: '#3b82f6', goal: 8000, placeholder: '0' },
  { key: 'water', label: '喝水量', unit: 'L', step: 0.1, min: 0, max: 10, icon: <Droplets size={20} />, color: '#06b6d4', placeholder: '0.0' },
  { key: 'exercise', label: '運動時間', unit: '分鐘', step: 5, min: 0, max: 480, icon: <Dumbbell size={20} />, color: '#f59e0b', goal: 30, placeholder: '0' },
  { key: 'sleep', label: '睡眠時間', unit: '小時', step: 0.5, min: 0, max: 24, icon: <Moon size={20} />, color: '#8b5cf6', goal: 7, placeholder: '0' },
  { key: 'weight', label: '體重', unit: 'kg', step: 0.1, min: 20, max: 300, icon: <Scale size={20} />, color: '#64748b', placeholder: '0.0' },
];

export function LogForm({ existing, goals, onSave, onBack }: Props) {
  const [values, setValues] = useState<Partial<Record<keyof Omit<DailyLog, 'date'>, string>>>({
    steps: existing?.steps != null ? String(existing.steps) : '',
    water: existing?.water != null ? String(existing.water) : '',
    exercise: existing?.exercise != null ? String(existing.exercise) : '',
    sleep: existing?.sleep != null ? String(existing.sleep) : '',
    weight: existing?.weight != null ? String(existing.weight) : '',
  });

  const set = (key: keyof Omit<DailyLog, 'date'>, val: string) =>
    setValues(v => ({ ...v, [key]: val }));

  const adjust = (key: keyof Omit<DailyLog, 'date'>, delta: number, step: number) => {
    const cur = parseFloat(values[key] || '0') || 0;
    const next = Math.max(0, Math.round((cur + delta * step) * 100) / 100);
    set(key, String(next));
  };

  const handleSave = () => {
    const log: DailyLog = {
      date: today(),
      steps: parseFloat(values.steps || '0') || 0,
      water: parseFloat(values.water || '0') || 0,
      exercise: parseFloat(values.exercise || '0') || 0,
      sleep: parseFloat(values.sleep || '0') || 0,
      weight: parseFloat(values.weight || '0') || 0,
    };
    onSave(log);
    onBack();
  };

  const goalFor = (key: keyof Omit<DailyLog, 'date'>) => {
    if (key === 'steps') return goals.steps;
    if (key === 'water') return goals.water;
    if (key === 'exercise') return goals.exercise;
    if (key === 'sleep') return goals.sleep;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-gray-100">
          <ChevronLeft size={22} className="text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">{existing ? '修改今日紀錄' : '新增今日紀錄'}</h2>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 pb-32">
        {fields.map(({ key, label, unit, step, min, max, icon, color, placeholder }) => {
          const goal = goalFor(key);
          const val = parseFloat(values[key] || '0') || 0;
          const pct = goal ? Math.min(100, Math.round((val / goal) * 100)) : null;

          return (
            <div key={key} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  {icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700">{label}</p>
                  {goal && (
                    <p className="text-[11px] text-gray-400">目標：{goal} {unit}</p>
                  )}
                </div>
                {pct != null && (
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-full"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {pct}%
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjust(key, -1, step)}
                  className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 text-xl font-bold flex items-center justify-center active:bg-gray-200 flex-shrink-0"
                >
                  −
                </button>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={values[key]}
                    min={min}
                    max={max}
                    step={step}
                    placeholder={placeholder}
                    onChange={e => set(key, e.target.value)}
                    className="w-full text-center text-xl font-bold text-gray-800 bg-gray-50 rounded-xl py-2.5 border border-gray-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
                </div>
                <button
                  onClick={() => adjust(key, 1, step)}
                  className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 text-xl font-bold flex items-center justify-center active:bg-gray-200 flex-shrink-0"
                >
                  ＋
                </button>
              </div>

              {goal && val > 0 && (
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(pct ?? 0, 100)}%`, backgroundColor: color }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-white border-t border-gray-100"
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <button
          onClick={handleSave}
          className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 transition-transform active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0f766e 0%, #059669 100%)' }}
        >
          <Check size={20} />
          儲存紀錄
        </button>
      </div>
    </div>
  );
}
