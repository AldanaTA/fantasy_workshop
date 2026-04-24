import { Edit3, Link2, Plus, Trash2 } from 'lucide-react';

import type { Campaign } from '../../api/models';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

type CampaignListAction = 'create' | 'manage' | 'share' | 'delete';

type Props = {
  campaigns: Campaign[];
  isLoading: boolean;
  error: string | null;
  selectedCampaignId?: string | null;
  onAction: (action: CampaignListAction, campaign?: Campaign) => void;
};

export function GameMasterCampaignListView({
  campaigns,
  isLoading,
  error,
  selectedCampaignId = null,
  onAction,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Campaign Management</h2>
            <p className="text-sm text-muted-foreground">
              Pick a campaign, then manage it from one focused workspace.
            </p>
          </div>
          <Button onClick={() => onAction('create')} className="min-h-[44px]">
            <Plus className="h-4 w-4" />
            Make Campaign
          </Button>
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
          <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            No GM-accessible campaigns found. Use Make Campaign to create your first one.
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="border-border">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 pt-2">
                      <CardTitle className="break-words text-base font-semibold">{campaign.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {campaign.description || 'No campaign summary available.'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => onAction('manage', campaign)}>
                        <Edit3 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Manage</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onAction('share', campaign)}>
                        <Link2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Share</span>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => onAction('delete', campaign)}>
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
