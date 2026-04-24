import { useEffect, useState } from 'react';
import { CircleArrowLeft } from 'lucide-react';

import { gamesApi } from '../../api/gamesApi';
import type { CreatorPackResumeState } from '../../api/appResumeStorage';
import type { Campaign, Game, LibraryGame } from '../../api/models';
import type { UUID } from '../../types/misc';
import { ViewGamePacks } from '../game_creator/ViewGamePacks';
import { ViewGames } from '../games/ViewGames';
import { Button } from '../ui/button';

type Props = {
  mode: 'creator' | 'campaign';
  campaign?: Campaign | null;
  lockedGame?: Game | null;
  initialGameId?: UUID | null;
  onBack?: () => void;
  getPackResumeState?: (gameId: string) => CreatorPackResumeState | null;
  onPackResumeStateChange?: (gameId: string, state: CreatorPackResumeState) => void;
};

const canManagePacks = (game: LibraryGame) => game.role !== 'viewer';

function fallbackGameFromCampaign(campaign: Campaign): Game {
  return {
    id: campaign.game_id,
    owner_user_id: campaign.owner_user_id,
    game_name: `Game ${campaign.game_id}`,
    game_summary: null,
    visibility: 'private',
  };
}

export function GamePackWorkspace({
  mode,
  campaign = null,
  lockedGame = null,
  initialGameId = null,
  onBack,
  getPackResumeState,
  onPackResumeStateChange,
}: Props) {
  const [selectedGame, setSelectedGame] = useState<Game | LibraryGame | null>(lockedGame);
  const [eligibleGames, setEligibleGames] = useState<LibraryGame[]>([]);
  const [isLoading, setIsLoading] = useState(mode === 'creator' || !lockedGame);
  const [error, setError] = useState<string | null>(null);
  const lockedGameId = campaign?.game_id ?? initialGameId ?? null;

  useEffect(() => {
    if (mode === 'campaign' && lockedGame) {
      setSelectedGame(lockedGame);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadGames = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const libraryGames = await gamesApi.listLibrary(100, 0);
        if (cancelled) return;

        if (mode === 'creator') {
          const packEligibleGames = libraryGames.filter(canManagePacks);
          setEligibleGames(packEligibleGames);

          if (initialGameId) {
            setSelectedGame(packEligibleGames.find((game) => game.id === initialGameId) ?? null);
          }
          return;
        }

        const matchedGame = libraryGames.find((game) => game.id === lockedGameId) ?? null;
        setSelectedGame(matchedGame ?? (campaign ? fallbackGameFromCampaign(campaign) : null));
      } catch (err) {
        if (cancelled) return;
        setError((err as Error)?.message || 'Unable to load games for pack management.');
        setEligibleGames([]);

        if (mode === 'campaign' && campaign) {
          setSelectedGame(fallbackGameFromCampaign(campaign));
          return;
        }

        setSelectedGame(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadGames();

    return () => {
      cancelled = true;
    };
  }, [campaign, initialGameId, lockedGame, lockedGameId, mode]);

  if (selectedGame) {
    return (
      <ViewGamePacks
        game={selectedGame}
        campaign={campaign ?? undefined}
        initialResumeState={getPackResumeState?.(selectedGame.id) ?? null}
        onResumeStateChange={(state) => onPackResumeStateChange?.(selectedGame.id, state)}
        onBack={mode === 'campaign' ? onBack : () => setSelectedGame(null)}
      />
    );
  }

  if (mode === 'campaign') {
    return (
      <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error || 'Unable to resolve the campaign game for pack management.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {onBack ? (
        <div className="flex justify-start">
          <Button type="button" variant="outline" onClick={onBack} className="min-h-[44px] sm:w-auto">
            <CircleArrowLeft className="h-4 w-4 shrink-0" />
            Back to Creator Dashboard
          </Button>
        </div>
      ) : null}
      <ViewGames
        games={eligibleGames}
        isLoading={isLoading}
        error={error}
        title="Pack Workspace"
        description="Choose any game you own, can edit, or have purchased to create and manage content packs."
        emptyTitle="No pack-ready games found"
        emptyDescription="Purchased games and games you can edit will appear here when they are available in your library."
        onManagePacks={setSelectedGame}
      />
    </div>
  );
}
