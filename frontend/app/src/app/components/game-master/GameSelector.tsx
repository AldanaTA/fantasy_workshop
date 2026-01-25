import { Game } from '../../types/game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

/**
 * GameSelector component allows Game Masters to select which game they want to manage.
 * 
 * @param games - Array of available games to choose from
 * @param selectedGameId - Currently selected game ID (if any)
 * @param onSelectGame - Callback function when a game is selected, receives the game ID
 * @returns A card containing a grid of selectable game cards
 */
interface GameSelectorProps {
  games: Game[];
  selectedGameId: string | null;
  onSelectGame: (gameId: string) => void;
}

export function GameSelector({ games, selectedGameId, onSelectGame }: GameSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Game</CardTitle>
      </CardHeader>
      <CardContent>
        {games.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No games available. Create a game in Game Creator mode first.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <div
                key={game.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedGameId === game.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => onSelectGame(game.id)}
              >
                <h3 className="font-medium truncate">{game.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {game.description || 'No description'}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
