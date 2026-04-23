import { useEffect, useState } from 'react';

import { gamesApi } from '../../api/gamesApi';
import type { Campaign, Game } from '../../api/models';
import { ViewGamePacks } from '../game_creator/ViewGamePacks';
import { GameMasterViewFrame } from './GameMasterViewFrame';

type Props = {
  campaign: Campaign;
  game?: Game | null;
  onBack: () => void;
};

export function GameMasterCampaignGamePacksView({ campaign, game, onBack }: Props) {
  const [resolvedGame, setResolvedGame] = useState<Game | null>(game ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (game) {
      setResolvedGame(game);
      return;
    }

    let cancelled = false;
    const loadGame = async () => {
      try {
        const editableGames = await gamesApi.listEditable(100, 0);
        if (cancelled) return;
        setResolvedGame(
          editableGames.find((entry) => entry.id === campaign.game_id) ?? {
            id: campaign.game_id,
            owner_user_id: campaign.owner_user_id,
            game_name: `Game ${campaign.game_id}`,
            game_summary: null,
            visibility: 'private',
          },
        );
      } catch (err) {
        if (cancelled) return;
        setError((err as Error)?.message || 'Unable to load the campaign game.');
      }
    };

    void loadGame();
    return () => {
      cancelled = true;
    };
  }, [campaign.game_id, campaign.owner_user_id, game]);

  if (error) {
    return (
      <GameMasterViewFrame
        title={`Game Packs for ${campaign.name}`}
        description="Use this mode to create and manage packs for the selected campaign's game."
        onBack={onBack}
      >
        <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      </GameMasterViewFrame>
    );
  }

  if (!resolvedGame) {
    return (
      <GameMasterViewFrame
        title={`Game Packs for ${campaign.name}`}
        description="Use this mode to create and manage packs for the selected campaign's game."
        onBack={onBack}
      >
        <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          Loading game packs...
        </div>
      </GameMasterViewFrame>
    );
  }

  return <ViewGamePacks game={resolvedGame} campaign={campaign} onBack={onBack} />;
}
