import { useEffect, useMemo, useState } from 'react';

import { campaignsApi } from '../../api/campaignsApi';
import { contentPacksApi } from '../../api/contentPacksApi';
import type { Campaign, CampaignAllowedPack, ContentPack } from '../../api/models';
import { GameRulesRenderer } from '../content/GameRulesRenderer';

type Props = {
  campaign: Campaign;
  embedded?: boolean;
};

export function GameMasterCampaignRulesView({ campaign }: Props) {
  const [packs, setPacks] = useState<ContentPack[]>([]);
  const [allowedPacks, setAllowedPacks] = useState<CampaignAllowedPack[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRulesData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [gamePacks, allowed] = await Promise.all([
          contentPacksApi.listByGame(campaign.game_id, 100, 0),
          campaignsApi.listAllowedPacks(campaign.id),
        ]);
        if (cancelled) return;

        setPacks(gamePacks);
        setAllowedPacks(allowed);
      } catch (err) {
        if (cancelled) return;
        setPacks([]);
        setAllowedPacks([]);
        setError((err as Error)?.message || 'Unable to load campaign rules.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadRulesData();

    return () => {
      cancelled = true;
    };
  }, [campaign.game_id, campaign.id]);

  const allowedPackIds = useMemo(
    () => allowedPacks.map((pack) => pack.pack_id).filter((packId) => packs.some((pack) => pack.id === packId)),
    [allowedPacks, packs],
  );

  useEffect(() => {
    if (!allowedPackIds.length) {
      setSelectedPackIds([]);
      return;
    }

    setSelectedPackIds((prev) => {
      const next = prev.filter((packId) => allowedPackIds.includes(packId));
      return next.length ? next : allowedPackIds;
    });
  }, [allowedPackIds]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
        Loading campaign rules...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!allowedPackIds.length) {
    return (
      <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
        No allowed packs are selected for this campaign yet. Add packs in the Allowed Packs tab to view the campaign rules.
      </div>
    );
  }

  return (
    <GameRulesRenderer
      gameId={campaign.game_id}
      campaignId={campaign.id}
      selectedPackIds={selectedPackIds}
      onSelectedPackIdsChange={setSelectedPackIds}
      mode="full"
      visibility="gm"
      packMode="multi"
    />
  );
}
