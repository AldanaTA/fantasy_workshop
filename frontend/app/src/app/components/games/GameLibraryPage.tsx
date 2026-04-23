import { useEffect, useState } from 'react';
import { CircleArrowLeft } from 'lucide-react';

import { gamesApi } from '../../api/gamesApi';
import type { LibraryGame } from '../../api/models';
import { GameRulesRenderer } from '../content/GameRulesRenderer';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ViewGames } from './ViewGames';
import { getSavedLibraryState, setSavedLibraryState } from '../../api/appResumeStorage';

interface GameLibraryPageProps {
  onManageGame?: (game: LibraryGame) => void;
}

const rulesVisibilityForGame = (game: LibraryGame) => (
  game.role === 'owner' || game.role === 'editor' ? 'gm' : 'player'
);

export function GameLibraryPage({ onManageGame }: GameLibraryPageProps) {
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<LibraryGame | null>(null);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  const loadGames = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const libraryGames = await gamesApi.listLibrary();
      if (signal?.aborted) return;
      setGames(libraryGames);
    } catch (err) {
      if (isAbortError(err)) return;
      setError((err as Error)?.message || 'Unable to load your game library.');
      setGames([]);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadGames(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasRestoredState) {
      return;
    }

    if (previewTarget) {
      setSavedLibraryState({ view: 'preview', gameId: previewTarget.id });
      return;
    }

    setSavedLibraryState({ view: 'list' });
  }, [hasRestoredState, previewTarget]);

  useEffect(() => {
    if (isLoading || hasRestoredState) {
      return;
    }

    const savedState = getSavedLibraryState();
    if (!savedState || savedState.view === 'list') {
      setHasRestoredState(true);
      return;
    }

    const matchedGame = games.find((game) => game.id === savedState.gameId) ?? null;
    if (!matchedGame) {
      setSavedLibraryState({ view: 'list' });
      setHasRestoredState(true);
      return;
    }

    setPreviewTarget(matchedGame);
    setHasRestoredState(true);
  }, [games, hasRestoredState, isLoading]);

  if (previewTarget) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="grid min-w-0 gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold">Preview {previewTarget.game_name} rules</h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                Review this game's rules across selected content packs.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewTarget(null)}
              className="min-h-[44px] min-w-0 sm:w-auto"
            >
              <CircleArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Back to Library</span>
            </Button>
          </div>
          <Separator />
          <GameRulesRenderer
            gameId={previewTarget.id}
            mode="full"
            visibility={rulesVisibilityForGame(previewTarget)}
            packMode="multi"
          />
        </div>
      </div>
    );
  }

  return (
    <ViewGames
      games={games}
      isLoading={isLoading}
      error={error}
      title="Game Library"
      description="Open any game in your library to read its rules. Owners and editors can jump into creator tools from here."
      emptyTitle="Your library is empty"
      emptyDescription="Accept a game invite or create a game to start building your library."
      onOpen={setPreviewTarget}
      onManageGame={onManageGame}
    />
  );
}

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}
