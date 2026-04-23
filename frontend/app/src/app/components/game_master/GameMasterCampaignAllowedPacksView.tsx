import { useEffect, useMemo, useState } from 'react';
import { Check, ShieldOff } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import { contentPacksApi } from '../../api/contentPacksApi';
import type { Campaign, CampaignAllowedPack, ContentPack } from '../../api/models';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../ui/card';
import { useToast } from '../ui/toastProvider';
import { GameMasterViewFrame } from './GameMasterViewFrame';

type Props = {
  campaign: Campaign;
  onBack?: () => void;
  embedded?: boolean;
};

export function GameMasterCampaignAllowedPacksView({ campaign, onBack, embedded = false }: Props) {
  const { toastPromise } = useToast();
  const [packs, setPacks] = useState<ContentPack[]>([]);
  const [allowedPacks, setAllowedPacks] = useState<CampaignAllowedPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [gamePacks, allowed] = await Promise.all([
        contentPacksApi.listByGame(campaign.game_id, 100, 0),
        campaignsApi.listAllowedPacks(campaign.id),
      ]);
      setPacks(gamePacks);
      setAllowedPacks(allowed);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load campaign packs.');
      setPacks([]);
      setAllowedPacks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [campaign.game_id, campaign.id]);

  const allowedPackIds = useMemo(() => new Set(allowedPacks.map((pack) => pack.pack_id)), [allowedPacks]);

  const handleAllow = async (pack: ContentPack) => {
    setPendingPackId(pack.id);
    try {
      await toastPromise(
        campaignsApi.allowPack(campaign.id, pack.id),
        {
          loading: 'Allowing pack...',
          success: 'Pack allowed for campaign.',
          error: (e) => (e as Error)?.message || 'Failed to allow pack.',
        },
      );
      await loadData();
    } finally {
      setPendingPackId(null);
    }
  };

  const handleRevoke = async (pack: ContentPack) => {
    setPendingPackId(pack.id);
    try {
      await toastPromise(
        campaignsApi.revokePack(campaign.id, pack.id),
        {
          loading: 'Revoking pack...',
          success: 'Pack removed from allowed list.',
          error: (e) => (e as Error)?.message || 'Failed to revoke pack.',
        },
      );
      await loadData();
    } finally {
      setPendingPackId(null);
    }
  };

  const content = isLoading ? (
    <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
      Loading packs...
    </div>
  ) : error ? (
    <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
      {error}
    </div>
  ) : packs.length === 0 ? (
    <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
      No game packs were found for this campaign&apos;s game.
    </div>
  ) : (
    <div className="space-y-4">
      {packs.map((pack) => {
        const isAllowed = allowedPackIds.has(pack.id);
        const isPending = pendingPackId === pack.id;

        return (
          <Card key={pack.id} className="border-border">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className='pt-2'>
                <CardTitle className="text-base">{pack.pack_name}</CardTitle>
                <CardDescription>
                  {pack.description || 'No description available.'}
                </CardDescription>
              </div>
              {isAllowed ? (
                <Button type="button" variant="destructive" size="sm" onClick={() => void handleRevoke(pack)} disabled={isPending}>
                  <ShieldOff className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              ) : (
                <Button type="button" variant="secondary" size="sm" onClick={() => void handleAllow(pack)} disabled={isPending}>
                  <Check className="h-3.5 w-3.5" />
                  Allow
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <GameMasterViewFrame
      title={`Allowed Packs for ${campaign.name}`}
      description="Choose which game packs this campaign can reference. This mode stays focused on pack policy only."
      onBack={onBack}
    >
      {content}
    </GameMasterViewFrame>
  );
}
