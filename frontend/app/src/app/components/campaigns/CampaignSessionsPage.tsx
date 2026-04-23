import { useEffect, useState } from 'react';
import { MessageSquareText, Users } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import type { Campaign } from '../../api/models';
import { CampaignChatPanel } from './CampaignChatPanel';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

type CampaignSessionsPageProps = {
  role: 'gm' | 'player';
};

export function CampaignSessionsPage({ role }: CampaignSessionsPageProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const nextCampaigns = role === 'gm'
        ? await campaignsApi.listGm()
        : await campaignsApi.listPlayer();
      if (signal?.aborted) return;

      setCampaigns(nextCampaigns);
      setExpandedCampaignId((prev) => {
        if (prev && nextCampaigns.some((campaign) => campaign.id === prev)) return prev;
        return nextCampaigns[0]?.id ?? null;
      });
    } catch (err) {
      if (isAbortError(err)) return;
      setCampaigns([]);
      setExpandedCampaignId(null);
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

  return (
    <div className="grid min-w-0 gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="min-w-0">
        <h2 className="break-words text-xl font-semibold">
          {role === 'gm' ? 'Campaign Chat' : 'Your Campaign Chat'}
        </h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          Open a campaign to read the shared timeline, chat with the table, and see campaign events in one place.
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
            {role === 'gm'
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
              Chat, whispers, rolls, and campaign events all stay attached to the campaign itself.
            </AlertDescription>
          </Alert>

          {campaigns.map((campaign) => (
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
                  <Button
                    type="button"
                    variant={expandedCampaignId === campaign.id ? 'secondary' : 'outline'}
                    className="min-h-[44px] w-full sm:w-auto"
                    onClick={() => setExpandedCampaignId((prev) => (prev === campaign.id ? null : campaign.id))}
                  >
                    <MessageSquareText className="h-4 w-4" />
                    {expandedCampaignId === campaign.id ? 'Hide Chat' : 'Open Chat'}
                  </Button>
                </div>
              </CardHeader>
              {expandedCampaignId === campaign.id ? (
                <CardContent>
                  <CampaignChatPanel
                    campaign={campaign}
                    accessRole={role === 'gm' ? 'co_gm' : 'player'}
                  />
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
