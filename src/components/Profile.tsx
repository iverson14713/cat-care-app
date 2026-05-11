import React, { useState } from 'react';

type ProfileProps = {
  profile?: {
    gender?: string;
    age?: number;
    height?: number;
    weight?: number;
    goal?: string;
  };
  onSave?: (profile: {
    gender: string;
    age: number;
    height: number;
    weight: number;
    goal: string;
  }) => void;
};

export function Profile({ profile, onSave }: ProfileProps) {
  const [gender, setGender] = useState(profile?.gender || 'male');
  const [age, setAge] = useState(profile?.age || 35);
  const [height, setHeight] = useState(profile?.height || 170);
  const [weight, setWeight] = useState(profile?.weight || 70);
  const [goal, setGoal] = useState(profile?.goal || '健康維持');

  const bmi =
    height > 0 ? (weight / Math.pow(height / 100, 2)).toFixed(1) : '0';

  const handleSave = () => {
    const nextProfile = {
      gender,
      age,
      height,
      weight,
      goal,
    };

    localStorage.setItem('health_profile', JSON.stringify(nextProfile));

    if (onSave) {
      onSave(nextProfile);
    }

    alert('個人資料已儲存');
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 pb-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-slate-900">個人資料</h1>
        <p className="mt-1 text-sm text-slate-500">
          系統會依照你的資料估算每日健康目標。
        </p>

        <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
          <label className="text-sm font-medium text-slate-700">性別</label>
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="male">男生</option>
            <option value="female">女生</option>
          </select>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            年齡
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            type="number"
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">
            身高 cm
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">
            體重 kg
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">
            目標
          </label>
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          >
            <option value="健康維持">健康維持</option>
            <option value="減脂">減脂</option>
            <option value="增肌">增肌</option>
            <option value="改善睡眠">改善睡眠</option>
          </select>

          <div className="mt-5 rounded-2xl bg-slate-100 p-4">
            <div className="text-sm text-slate-500">目前 BMI</div>
            <div className="mt-1 text-3xl font-bold text-slate-900">{bmi}</div>
          </div>

          <button
            onClick={handleSave}
            className="mt-5 w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white shadow-sm active:scale-[0.99]"
          >
            儲存個人資料
          </button>
        </div>
      </div>
    </div>
  );
}