export type Gender = 'male' | 'female';

export interface UserProfile {
  name: string;
  gender: Gender;
  age: number;
  height: number; // cm
  weight: number; // kg
  goal: string;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  steps: number;
  water: number; // liters
  exercise: number; // minutes
  sleep: number; // hours
  weight: number; // kg
}

export interface DailyGoals {
  steps: number;
  water: number;
  exercise: number;
  sleep: number;
}

export interface HealthScore {
  total: number;
  steps: number;
  water: number;
  exercise: number;
  sleep: number;
}
