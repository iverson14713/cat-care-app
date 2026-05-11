import { useState } from 'react';
import { useHealthData } from './useHealthData';
import { computeGoals, today } from './utils';
import { BottomNav, type Tab } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { LogForm } from './components/LogForm';
import { Trends } from './components/Trends';
import { Profile } from './components/Profile';

export default function App() {
  const { profile, saveProfile, logs, saveLog, getLog } = useHealthData();
  const [tab, setTab] = useState<Tab>('home');
  const [showLogForm, setShowLogForm] = useState(false);

  const goals = profile ? computeGoals(profile) : { steps: 8000, water: 2.0, exercise: 30, sleep: 7 };
  const todayLog = getLog(today());

  if (showLogForm) {
    return (
      <LogForm
        existing={todayLog}
        goals={goals}
        onSave={saveLog}
        onBack={() => setShowLogForm(false)}
      />
    );
  }

  if (!profile && tab !== 'profile') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <Profile profile={null} onSave={p => { saveProfile(p); setTab('home'); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pb-20 overflow-y-auto">
        {tab === 'home' && profile && (
          <Dashboard
            profile={profile}
            log={todayLog}
            goals={goals}
            onAddLog={() => setShowLogForm(true)}
          />
        )}
        {tab === 'log' && (
          <LogForm
            existing={todayLog}
            goals={goals}
            onSave={saveLog}
            onBack={() => setTab('home')}
          />
        )}
        {tab === 'trends' && (
          <Trends logs={logs} goals={goals} />
        )}
        {tab === 'profile' && (
          <Profile profile={profile} onSave={saveProfile} />
        )}
      </div>
      <BottomNav active={tab} onChange={t => { setTab(t); }} />
    </div>
  );
}
