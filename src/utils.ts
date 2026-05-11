import type { UserProfile, DailyGoals, DailyLog, HealthScore } from './types';

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

export function getWeekDays(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function computeGoals(profile: UserProfile): DailyGoals {
  return {
    steps: 8000,
    water: profile.gender === 'male' ? 2.5 : 2.0,
    exercise: 30,
    sleep: 7,
  };
}

export function computeScore(log: Partial<DailyLog>, goals: DailyGoals): HealthScore {
  const clamp = (v: number) => Math.min(1, v);
  const steps = log.steps != null ? clamp(log.steps / goals.steps) : 0;
  const water = log.water != null ? clamp(log.water / goals.water) : 0;
  const exercise = log.exercise != null ? clamp(log.exercise / goals.exercise) : 0;
  const sleep = log.sleep != null ? clamp(log.sleep / goals.sleep) : 0;
  const total = Math.round(((steps + water + exercise + sleep) / 4) * 100);
  return {
    total,
    steps: Math.round(steps * 100),
    water: Math.round(water * 100),
    exercise: Math.round(exercise * 100),
    sleep: Math.round(sleep * 100),
  };
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export function bmi(weight: number, heightCm: number): number {
  const h = heightCm / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}

export function bmiLabel(bmiVal: number): string {
  if (bmiVal < 18.5) return '過輕';
  if (bmiVal < 24) return '正常';
  if (bmiVal < 27) return '過重';
  return '肥胖';
}
