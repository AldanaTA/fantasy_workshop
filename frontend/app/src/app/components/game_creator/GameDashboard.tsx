import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '../ui/card';
import { Edit3, Share2, BookOpen } from 'lucide-react';

interface GameSummary {
  id: string;
  name: string;
  description: string;
  players: string;
  genre: string;
  rules: string;
}

const gameList: GameSummary[] = [
  {
    id: 'windfall',
    name: 'Windfall Carnival',
    description: 'A brisk fantasy adventure where every choice shifts the tide of the carnival.',
    players: '2-6 players',
    genre: 'Adventure / Heist',
    rules: 'Light rules, fast play, ability-driven actions.',
  },
  {
    id: 'ironforge',
    name: 'Ironforge Keep',
    description: 'Defend the ancient stronghold and unravel the mystery beneath its walls.',
    players: '3-5 players',
    genre: 'Dungeon / Strategy',
    rules: 'Tactical positioning, siege mechanics, resource pacing.',
  },
  {
    id: 'starlit',
    name: 'Starlit Odyssey',
    description: 'A mythic quest through dreamlands, guided by the stars and old bargains.',
    players: '1-4 players',
    genre: 'Mystery / Exploration',
    rules: 'Narrative prompts, discovery rewards, soft magic system.',
  },
];

export function GameDashboard() {
  const [selectedGameId, setSelectedGameId] = useState(gameList[0].id);
  const selectedGame = gameList.find((game) => game.id === selectedGameId) ?? gameList[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="h-full border-border bg-background">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">List games</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Tap a game to display its summary and quick actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gameList.map((game) => {
            const isSelected = game.id === selectedGameId;
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => setSelectedGameId(game.id)}
                className={`block w-full rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card hover:border-primary/70 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{game.name}</span>
                  <span className="text-xs text-muted-foreground">{game.players}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {game.description}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="h-full border-border bg-background">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Display Selected Game Summary</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            See the selected game details and choose an action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {selectedGame.genre}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{selectedGame.name}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {selectedGame.description}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Players</p>
                <p className="mt-2 text-sm font-medium">{selectedGame.players}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rules</p>
                <p className="mt-2 text-sm font-medium">{selectedGame.rules}</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button variant="outline" className="w-full sm:w-auto" type="button">
            <Edit3 className="mr-2 h-4 w-4" /> Edit Game
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" type="button">
            <Share2 className="mr-2 h-4 w-4" /> Share Game
          </Button>
          <Button className="w-full sm:w-auto" type="button">
            <BookOpen className="mr-2 h-4 w-4" /> View Rules
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
