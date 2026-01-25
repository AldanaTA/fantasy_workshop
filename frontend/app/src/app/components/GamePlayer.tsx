import { useState, useEffect } from 'react';
import { Game, Character, Content, Session, GameMechanic } from '../types/game';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Plus, Trash2, User, BookOpen } from 'lucide-react';
import { CharacterSheetSimple } from './CharacterSheet_simple';
import { RuleReferenceSheet } from './RuleReferenceSheet';
import { toast } from 'sonner';

interface GamePlayerProps {
  games: Game[];
  characters: Character[];
  content: Content[];
  sessions: Session[];
  inviteCode: string | null;
  onSaveCharacter: (character: Character) => void;
  onDeleteCharacter: (id: string) => void;
}

export function GamePlayer({
  games,
  characters,
  content,
  sessions,
  inviteCode,
  onSaveCharacter,
  onDeleteCharacter,
}: GamePlayerProps) {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [referenceLibraryOpen, setReferenceLibraryOpen] = useState(false);

  // Find session from invite code
  useEffect(() => {
    if (inviteCode) {
      const session = sessions.find((s) => s.inviteCode === inviteCode);
      if (session) {
        setSelectedGameId(session.gameId);
        toast.success('Joined session!', {
          description: `You've joined the session: ${session.name}`,
        });
      }
    }
  }, [inviteCode, sessions]);

  const selectedCharacter = characters.find((c) => c.id === selectedCharId);
  const selectedGame = games.find((g) => g.id === selectedGameId);

  const createCharacter = () => {
    if (!selectedGameId) {
      toast.error('Please select a game first');
      return;
    }

    const newCharacter: Character = {
      id: Date.now().toString(),
      gameId: selectedGameId,
      contentInstances: [],
    };

    onSaveCharacter(newCharacter);
    setSelectedCharId(newCharacter.id);
    toast.success('New character created');
  };

  const deleteCharacter = (id: string) => {
    if (window.confirm('Are you sure you want to delete this character?')) {
      onDeleteCharacter(id);
      if (selectedCharId === id) {
        setSelectedCharId(null);
      }
      toast.success('Character deleted');
    }
  };

  const updateCharacter = (character: Character) => {
    onSaveCharacter(character);
  };

  // Get mechanics for the selected game
  const gameMechanics: GameMechanic[] = selectedGameId
    ? JSON.parse(localStorage.getItem(`mechanics_${selectedGameId}`) || '[]')
    : [];

  // Filter content for the selected game
  const gameContent = content.filter((c) => c.gameId === selectedGameId);

  return (
    <div className="space-y-6">
      {/* Game Selection */}
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
                  onClick={() => setSelectedGameId(game.id)}
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

      {/* Character Selection */}
      {selectedGameId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Characters</CardTitle>
              <Button onClick={createCharacter}>
                <Plus className="w-4 h-4 mr-2" />
                New Character
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {characters.filter((c) => c.gameId === selectedGameId).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No characters yet. Create your first character!
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {characters
                  .filter((c) => c.gameId === selectedGameId)
                  .map((char) => {
                    // Try to get a name from content instances
                    const nameInstance = char.contentInstances.find((inst) => {
                      const contentDef = gameContent.find((c) => c.id === inst.contentId);
                      return contentDef?.name.toLowerCase().includes('name');
                    });
                    const displayName = nameInstance
                      ? Object.values(nameInstance.fieldValues)[0] || 'Unnamed Character'
                      : 'Unnamed Character';

                    return (
                      <div
                        key={char.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedCharId === char.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => setSelectedCharId(char.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground shrink-0" />
                              <h3 className="font-medium truncate">{displayName}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {char.contentInstances.length} content items
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCharacter(char.id);
                            }}
                            className="shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Character Sheet / Reference Library */}
      {selectedCharacter && selectedGame && (
        <>
          {/* Reference Library Sheet */}
          <RuleReferenceSheet
            open={referenceLibraryOpen}
            onOpenChange={setReferenceLibraryOpen}
            content={content}
            contentCategories={selectedGame.contentCategories}
            gameId={selectedGameId}
          />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Character Sheet</CardTitle>
                <Button
                  onClick={() => setReferenceLibraryOpen(true)}
                  variant="outline"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Reference Library
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CharacterSheetSimple
                character={selectedCharacter}
                onUpdate={updateCharacter}
                content={gameContent}
                mechanics={gameMechanics}
                contentCategories={selectedGame.contentCategories}
              />
            </CardContent>
          </Card>
        </>
      )}

      {!selectedGameId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Select a game to view your characters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}