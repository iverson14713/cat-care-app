import { Home, PlusCircle, TrendingUp, User } from 'lucide-react';

export type Tab = 'home' | 'log' | 'trends' | 'profile';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const items: { id: Tab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'home', label: '首頁', Icon: Home },
  { id: 'log', label: '紀錄', Icon: PlusCircle },
  { id: 'trends', label: '趨勢', Icon: TrendingUp },
  { id: 'profile', label: '個人', Icon: User },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
            active === id ? 'text-emerald-500' : 'text-gray-400'
          }`}
        >
          <Icon size={22} />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}
