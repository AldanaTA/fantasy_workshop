import { CircleArrowLeft } from 'lucide-react';

import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

type GameMasterViewFrameProps = {
  title: string;
  description: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function GameMasterViewFrame({
  title,
  description,
  backLabel = 'Back to Campaigns',
  onBack,
  actions,
  children,
}: GameMasterViewFrameProps) {
  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {onBack ? (
              <Button type="button" variant="outline" onClick={onBack} className="min-h-[44px] min-w-0">
                <CircleArrowLeft className="h-4 w-4 shrink-0" />
                <span className="truncate">{backLabel}</span>
              </Button>
            ) : null}
          </div>
        </div>
        <Separator />
        {children}
      </div>
    </div>
  );
}
