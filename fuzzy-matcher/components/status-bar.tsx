// components/status-bar.tsx - Status Bar Component

import { Progress } from '@/components/ui/progress';

interface StatusBarProps {
  stats: {
    total: number;
    matched: number;
    unmatched: number;
    progress: number;
  };
}

export function StatusBar({ stats }: StatusBarProps) {
  return (
    <footer className="bg-white border-t px-8 py-4 flex justify-between items-center">
      {/* Progress Info */}
      <div className="flex gap-8">
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">Mapped:</span>
          <span className="font-semibold text-emerald-700">{stats.matched}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">Unmatched:</span>
          <span className="font-semibold text-emerald-700">{stats.unmatched}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">Progress:</span>
          <span className="font-semibold text-emerald-700">{stats.progress}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-48">
        <Progress 
          value={stats.progress} 
          className="h-2"
        />
      </div>
    </footer>
  );
}