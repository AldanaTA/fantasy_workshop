import { useEffect, useMemo, useState } from 'react';

import { campaignsApi } from '../../api/campaignsApi';
import { gamesApi } from '../../api/gamesApi';
import type { Campaign, Game } from '../../api/models';
import type { UUID } from '../../types/misc';
import { useToast } from '../ui/toastProvider';
import { GameMasterCampaignFormView } from './GameMasterCampaignFormView';
import { GameMasterCampaignListView } from './GameMasterCampaignListView';
import { GameMasterCampaignManageView } from './GameMasterCampaignManageView';
import { GameMasterCampaignShareView } from './GameMasterCampaignShareView';

type GameMasterMode =
  | { type: 'list' }
  | { type: 'create' }
  | { type: 'manage'; campaign: Campaign }
  | { type: 'share'; campaign: Campaign };

interface GameMasterDashboardProps {
  initialViewGameId?: UUID | null;
  onInitialViewHandled?: () => void;
}

export function GameMasterDashboard({
  initialViewGameId = null,
  onInitialViewHandled,
}: GameMasterDashboardProps) {
  const { toastPromise } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMasterMode>({ type: 'list' });

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [gmCampaigns, editableGames] = await Promise.all([
        campaignsApi.listGm(),
        gamesApi.listEditable(100, 0).catch(() => []),
      ]);
      setCampaigns(gmCampaigns);
      setGames(editableGames);
      setSelectedCampaignId((prev) => prev ?? gmCampaigns[0]?.id ?? null);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load game master data.');
      setCampaigns([]);
      setGames([]);
      setSelectedCampaignId(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboardData();
  }, []);

  useEffect(() => {
    if (!initialViewGameId || isLoading) {
      return;
    }

    const matchedCampaign = campaigns.find((campaign) => campaign.id === initialViewGameId) ?? null;
    if (matchedCampaign) {
      setSelectedCampaignId(matchedCampaign.id);
      setMode({ type: 'manage', campaign: matchedCampaign });
    }
    onInitialViewHandled?.();
  }, [campaigns, initialViewGameId, isLoading, onInitialViewHandled]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const refreshCampaigns = async (preferredCampaignId?: string | null) => {
    const nextCampaigns = await campaignsApi.listGm();
    setCampaigns(nextCampaigns);
    const nextSelectedCampaignId = preferredCampaignId
      ?? selectedCampaignId
      ?? nextCampaigns[0]?.id
      ?? null;
    setSelectedCampaignId(nextCampaigns.some((campaign) => campaign.id === nextSelectedCampaignId) ? nextSelectedCampaignId : nextCampaigns[0]?.id ?? null);
    return nextCampaigns;
  };

  const handleSavedCampaign = async (savedCampaign: Campaign) => {
    const nextCampaigns = await refreshCampaigns(savedCampaign.id);
    const freshCampaign = nextCampaigns.find((campaign) => campaign.id === savedCampaign.id) ?? savedCampaign;
    setMode({ type: 'manage', campaign: freshCampaign });
  };

  const handleDeleteCampaign = async (campaign: Campaign) => {
    try {
      await toastPromise(campaignsApi.delete(campaign.id), {
        loading: 'Deleting campaign...',
        success: 'Campaign deleted successfully.',
        error: (e) => (e as Error)?.message || 'Failed to delete campaign.',
      });
      await refreshCampaigns(campaign.id === selectedCampaignId ? null : selectedCampaignId);
      setMode({ type: 'list' });
    } catch (err) {
      setError((err as Error)?.message || 'Unable to delete campaign.');
    }
  };

  if (mode.type === 'create') {
    return (
      <GameMasterCampaignFormView
        mode="create"
        games={games}
        onBack={() => setMode({ type: 'list' })}
        onSaved={handleSavedCampaign}
      />
    );
  }

  if (mode.type === 'manage') {
    return (
      <GameMasterCampaignManageView
        campaign={mode.campaign}
        games={games}
        onBack={() => setMode({ type: 'list' })}
        onSaved={handleSavedCampaign}
      />
    );
  }

  if (mode.type === 'share') {
    return <GameMasterCampaignShareView campaign={mode.campaign} onBack={() => setMode({ type: 'list' })} />;
  }

  return (
    <GameMasterCampaignListView
      campaigns={campaigns}
      isLoading={isLoading}
      error={error}
      selectedCampaignId={selectedCampaign?.id ?? null}
      onAction={(action, campaign) => {
        if (action === 'create') {
          setMode({ type: 'create' });
          return;
        }

        if (!campaign) {
          return;
        }

        setSelectedCampaignId(campaign.id);

        if (action === 'delete') {
          void handleDeleteCampaign(campaign);
          return;
        }

        if (action === 'manage') {
          setMode({ type: 'manage', campaign });
          return;
        }

        if (action === 'share') {
          setMode({ type: 'share', campaign });
        }
      }}
    />
  );
}
