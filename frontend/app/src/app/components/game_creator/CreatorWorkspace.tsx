import { useState } from 'react';
import { Button } from '../ui/button';
import { GameDashboard } from './GameDashboard';
import { ContentEditorPanel } from './ContentEditorPanel';

const viewTabs = [
  { id: 'games', label: 'Game Creator' },
  { id: 'content', label: 'Content Editor' },
] as const;

export function CreatorWorkspace() {
  const [activeView, setActiveView] = useState<'games' | 'content'>('games');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card p-3 shadow-sm">
        {viewTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeView === tab.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        {activeView === 'games' ? <GameDashboard /> : <ContentEditorPanel />}
      </div>
    </div>
  );
}
