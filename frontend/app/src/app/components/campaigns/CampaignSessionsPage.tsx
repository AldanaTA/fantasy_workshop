import { useEffect, useState } from 'react';
import { Clock3, Play, Square, Users } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import type { Campaign, CampaignSession } from '../../api/models';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { useToast } from '../ui/toastProvider';

type CampaignSessionsPageProps = {
  role: 'gm' | 'player';
};

type CampaignSessionState = {
  current: CampaignSession | null;
  recent: CampaignSession[];
};

export function CampaignSessionsPage({ role }: CampaignSessionsPageProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessionStateByCampaign, setSessionStateByCampaign] = useState<Record<string, CampaignSessionState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);
  const { toastPromise } = useToast();

  const canManageSessions = role === 'gm';

  const loadCampaigns = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const nextCampaigns = role === 'gm'
        ? await campaignsApi.listGm()
        : await campaignsApi.listPlayer();
      if (signal?.aborted) return;

      setCampaigns(nextCampaigns);

      const entries = await Promise.all(
        nextCampaigns.map(async (campaign) => {
          const [current, recent] = await Promise.all([
            campaignsApi.getCurrentSession(campaign.id),
            campaignsApi.listSessions(campaign.id, 5),
          ]);
          return [campaign.id, { current, recent }] as const;
        }),
      );

      if (signal?.aborted) return;
      setSessionStateByCampaign(Object.fromEntries(entries));
    } catch (err) {
      if (isAbortError(err)) return;
      setCampaigns([]);
      setSessionStateByCampaign({});
      setError((err as Error)?.message || 'Unable to load campaigns.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadCampaigns(controller.signal);

    return () => controller.abort();
  }, [role]);

  const refreshCampaign = async (campaignId: string) => {
    const [current, recent] = await Promise.all([
      campaignsApi.getCurrentSession(campaignId),
      campaignsApi.listSessions(campaignId, 5),
    ]);

    setSessionStateByCampaign((prev) => ({
      ...prev,
      [campaignId]: { current, recent },
    }));
  };

  const handleStartSession = async (campaignId: string) => {
    setPendingCampaignId(campaignId);
    try {
      await toastPromise(
        campaignsApi.startSession(campaignId),
        {
          loading: 'Starting campaign session...',
          success: 'Campaign session started.',
          error: (err) => (err as Error)?.message || 'Unable to start campaign session.',
        },
      );
      await refreshCampaign(campaignId);
    } finally {
      setPendingCampaignId(null);
    }
  };

  const handleEndSession = async (campaignId: string) => {
    setPendingCampaignId(campaignId);
    try {
      await toastPromise(
        campaignsApi.endCurrentSession(campaignId),
        {
          loading: 'Ending campaign session...',
          success: 'Campaign session ended.',
          error: (err) => (err as Error)?.message || 'Unable to end campaign session.',
        },
      );
      await refreshCampaign(campaignId);
    } finally {
      setPendingCampaignId(null);
    }
  };

  return (
    <div className="grid min-w-0 gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="min-w-0">
        <h2 className="break-words text-xl font-semibold">
          {canManageSessions ? 'Campaign Sessions' : 'Active Campaigns'}
        </h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {canManageSessions
            ? 'Start or end a live play session while keeping campaign chat persistent across the whole campaign.'
            : 'See whether your campaigns currently have an active live play session. Campaign chat remains persistent across sessions.'}
        </p>
      </div>

      <Separator />

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
          Loading campaigns...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center">
          <h3 className="break-words text-base font-semibold">No campaigns found</h3>
          <p className="mt-2 break-words text-sm text-muted-foreground">
            {canManageSessions
              ? 'Campaigns where you are the owner or a co-GM will appear here.'
              : 'Campaigns you joined as a player will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Campaign chat stays persistent</AlertTitle>
            <AlertDescription>
              Session status is layered onto campaigns. Starting or ending a session does not create a separate chat room or clear chat history.
            </AlertDescription>
          </Alert>

          {campaigns.map((campaign) => {
            const state = sessionStateByCampaign[campaign.id];
            const currentSession = state?.current ?? null;
            const recentSessions = state?.recent ?? [];
            const isPending = pendingCampaignId === campaign.id;

            return (
              <Card key={campaign.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="break-words text-base font-semibold leading-6">
                        {campaign.name}
                      </CardTitle>
                      <CardDescription className="mt-1 break-words leading-6">
                        {campaign.description || 'No campaign description available.'}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge variant={currentSession ? 'default' : 'secondary'}>
                        {currentSession ? 'Session Active' : 'No Active Session'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 rounded-2xl border border-border bg-background p-4">
                    {currentSession ? (
                      <>
                        <p className="text-sm font-medium">Live session in progress</p>
                        <p className="text-sm text-muted-foreground">
                          Started {formatDateTime(currentSession.started_at)}.
                        </p>
                        {canManageSessions ? (
                          <Button
                            type="button"
                            variant="destructive"
                            className="min-h-[44px] w-full sm:w-auto"
                            onClick={() => void handleEndSession(campaign.id)}
                            disabled={isPending}
                          >
                            <Square className="h-4 w-4" />
                            End Session
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">No live session is active right now</p>
                        <p className="text-sm text-muted-foreground">
                          {recentSessions[0]?.ended_at
                            ? `Most recent session ended ${formatDateTime(recentSessions[0].ended_at)}.`
                            : 'You can still use the same campaign chat history between sessions.'}
                        </p>
                        {canManageSessions ? (
                          <Button
                            type="button"
                            className="min-h-[44px] w-full sm:w-auto"
                            onClick={() => void handleStartSession(campaign.id)}
                            disabled={isPending}
                          >
                            <Play className="h-4 w-4" />
                            Start Session
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>

                  {recentSessions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock3 className="h-4 w-4" />
                        Recent session history
                      </div>
                      <div className="space-y-2">
                        {recentSessions.map((session) => (
                          <div
                            key={session.id}
                            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
                          >
                            {session.ended_at
                              ? `${formatDateTime(session.started_at)} to ${formatDateTime(session.ended_at)}`
                              : `Active since ${formatDateTime(session.started_at)}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}
