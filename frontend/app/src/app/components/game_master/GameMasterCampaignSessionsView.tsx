import { useEffect, useState } from 'react';
import { Clock3, Play, Square } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import type { Campaign, CampaignSession } from '../../api/models';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { useToast } from '../ui/toastProvider';
import { GameMasterViewFrame } from './GameMasterViewFrame';

type Props = {
  campaign: Campaign;
  onBack?: () => void;
  embedded?: boolean;
};

export function GameMasterCampaignSessionsView({ campaign, onBack, embedded = false }: Props) {
  const { toastPromise } = useToast();
  const [currentSession, setCurrentSession] = useState<CampaignSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<CampaignSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [current, recent] = await Promise.all([
        campaignsApi.getCurrentSession(campaign.id),
        campaignsApi.listSessions(campaign.id, 10),
      ]);
      setCurrentSession(current);
      setRecentSessions(recent);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load campaign sessions.');
      setCurrentSession(null);
      setRecentSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [campaign.id]);

  const handleStart = async () => {
    setIsPending(true);
    try {
      await toastPromise(campaignsApi.startSession(campaign.id), {
        loading: 'Starting campaign session...',
        success: 'Campaign session started.',
        error: (e) => (e as Error)?.message || 'Unable to start campaign session.',
      });
      await loadSessions();
    } finally {
      setIsPending(false);
    }
  };

  const handleEnd = async () => {
    setIsPending(true);
    try {
      await toastPromise(campaignsApi.endCurrentSession(campaign.id), {
        loading: 'Ending campaign session...',
        success: 'Campaign session ended.',
        error: (e) => (e as Error)?.message || 'Unable to end campaign session.',
      });
      await loadSessions();
    } finally {
      setIsPending(false);
    }
  };

  const content = isLoading ? (
    <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
      Loading sessions...
    </div>
  ) : error ? (
    <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
      {error}
    </div>
  ) : (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className='pt-2'>
              <p className="text-base font-semibold">
                {currentSession ? 'Live session in progress' : 'No active session'}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentSession
                  ? `Started ${formatDateTime(currentSession.started_at)}.`
                  : 'Campaign chat and history remain available between live sessions.'}
              </p>
            </div>
            <Badge variant={currentSession ? 'default' : 'secondary'}>
              {currentSession ? 'Session Active' : 'No Active Session'}
            </Badge>
          </div>
          {currentSession ? (
            <Button type="button" variant="destructive" className="min-h-[44px] w-full sm:w-auto" onClick={() => void handleEnd()} disabled={isPending}>
              <Square className="h-4 w-4" />
              End Session
            </Button>
          ) : (
            <Button type="button" className="min-h-[44px] w-full sm:w-auto" onClick={() => void handleStart()} disabled={isPending}>
              <Play className="h-4 w-4" />
              Start Session
            </Button>
          )}
        </CardContent>
      </Card>

      {recentSessions.length > 0 ? (
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Clock3 className="h-4 w-4" />
            Recent session history
          </div>
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <div key={session.id} className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">
                {session.ended_at
                  ? `${formatDateTime(session.started_at)} to ${formatDateTime(session.ended_at)}`
                  : `Active since ${formatDateTime(session.started_at)}`}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <GameMasterViewFrame
      title={`Sessions for ${campaign.name}`}
      description="Start or end live play for this campaign from its own focused management mode."
      onBack={onBack}
    >
      {content}
    </GameMasterViewFrame>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
