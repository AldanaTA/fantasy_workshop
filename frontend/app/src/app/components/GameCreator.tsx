import { useState, useEffect } from "react";
import {
  Game,
  Content,
  ContentCategoryDefinition,
  Character,
} from "../types/game";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Wand2,
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  BookOpen,
  Library,
} from "lucide-react";
import { createGame, updateGame } from "../api/gameApi";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import { RuleReferenceSheet } from "./RuleReferenceSheet";
import { SimplifiedContentLibrary } from "./SimplifiedContentLibrary";
import { CharacterSheetSimple } from "./CharacterSheet_simple";
import { User } from "lucide-react";

interface GameCreatorProps {
  games: Game[];
  content: Content[];
  onSaveGame: (game: Game) => void;
  onDeleteGame: (id: string) => void;
  onSaveContent: (content: Content) => void;
  onDeleteContent: (id: string) => void;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

export function GameCreator({
  games,
  content,
  onSaveGame,
  onDeleteGame,
  onSaveContent,
  onDeleteContent,
  onUnsavedChangesChange,
}: GameCreatorProps) {
  const [selectedGameId, setSelectedGameId] = useState<
    string | null
  >(null);
  const [editingGame, setEditingGame] = useState<Game | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<
    "details" | "categories" | "preview"
  >("details");
  const [showReferenceLibrary, setShowReferenceLibrary] =
    useState(false);
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);

  useEffect(() => {
    if (selectedGameId) {
      const game = games.find((g) => g.id === selectedGameId);
      if (game) {
        setEditingGame(game);
      }
    }
  }, [selectedGameId, games]);

  const createNewGame = () => {
    const newGame: Game = {
      id: Date.now().toString(),
      name: "New Game",
      description: "",
      creator: "current-user",
      createdAt: new Date().toISOString(),
      diceTypes: [
        { id: "d4", name: "d4", sides: 4 },
        { id: "d6", name: "d6", sides: 6 },
        { id: "d8", name: "d8", sides: 8 },
        { id: "d10", name: "d10", sides: 10 },
        { id: "d12", name: "d12", sides: 12 },
        { id: "d20", name: "d20", sides: 20 },
        { id: "d100", name: "d100", sides: 100 },
      ],
      contentCategories: [],
    };

    onSaveGame(newGame);
    setSelectedGameId(newGame.id);
    setEditingGame(newGame);
    toast.success("New game created");
    if (onUnsavedChangesChange) onUnsavedChangesChange(true);
  };

  const saveGame = () => {
    if (!editingGame) return;

    onSaveGame(editingGame);
    toast.success("Game saved successfully");
    if (onUnsavedChangesChange) onUnsavedChangesChange(false);
  };

  const deleteGame = (id: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this game?",
      )
    ) {
      onDeleteGame(id);
      if (selectedGameId === id) {
        setSelectedGameId(null);
        setEditingGame(null);
      }
      toast.success("Game deleted");
    }
  };

  const updateGame = (updates: Partial<Game>) => {
    if (!editingGame) return;
    setEditingGame({ ...editingGame, ...updates });
    if (onUnsavedChangesChange) onUnsavedChangesChange(true);
  };

  const saveCategory = (
    category: ContentCategoryDefinition,
  ) => {
    if (!editingGame) return;

    const existingIndex =
      editingGame.contentCategories.findIndex(
        (c) => c.id === category.id,
      );
    let updatedCategories: ContentCategoryDefinition[];

    if (existingIndex >= 0) {
      updatedCategories = editingGame.contentCategories.map(
        (c) => (c.id === category.id ? category : c),
      );
    } else {
      updatedCategories = [
        ...editingGame.contentCategories,
        category,
      ];
    }

    updateGame({ contentCategories: updatedCategories });
  };

  const deleteCategory = (id: string) => {
    if (!editingGame) return;

    // Check if any content uses this category
    const gameContent = content.filter(
      (c) => c.gameId === editingGame.id,
    );
    const hasContent = gameContent.some(
      (c) => c.category === id,
    );

    if (hasContent) {
      toast.error(
        "Cannot delete category with content. Delete the content first.",
      );
      return;
    }

    updateGame({
      contentCategories: editingGame.contentCategories.filter(
        (c) => c.id !== id,
      ),
    });
    toast.success("Category deleted");
  };

  const handleSaveCategory = (category: ContentCategoryDefinition) => {
    saveCategory(category);
  };

  const handleDeleteCategory = (id: string) => {
    deleteCategory(id);
  };

  const gameContent = editingGame
    ? content.filter((c) => c.gameId === editingGame.id)
    : [];

  // Create sample instances for preview character
  const createSampleInstances = () => {
    if (!editingGame) return [];
    
    const instances: Character['contentInstances'] = [];
    
    // Only create instances for categories that appear on character sheet
    editingGame.contentCategories
      .filter((cat) => cat.appearOnCharacterSheet)
      .forEach((category) => {
        const categoryContent = gameContent
          .filter((c) => c.category === category.id)
          .slice(0, 2); // Take first 2 items per category

        categoryContent.forEach((contentDef, idx) => {
          // Initialize field values with defaults from the content definition
          const fieldValues: Record<string, string | number> = {};
          contentDef.fields.forEach((field) => {
            if (field.type === 'numeric') {
              fieldValues[field.id] = field.defaultValue ?? 0;
            } else {
              fieldValues[field.id] = '';
            }
          });

          instances.push({
            id: `preview-${contentDef.id}-${idx}`,
            contentId: contentDef.id,
            fieldValues,
          });
        });
      });

    return instances;
  };

  // Update preview character when content or categories change
  useEffect(() => {
    if (editingGame) {
      setPreviewCharacter({
        id: 'preview',
        gameId: editingGame.id,
        contentInstances: createSampleInstances(),
      });
    }
  }, [editingGame?.id, gameContent.length, editingGame?.contentCategories]);

  const hasCharacterSheetCategories = editingGame?.contentCategories.some(
    (cat) => cat.appearOnCharacterSheet
  ) ?? false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>My Games</CardTitle>
            <Button onClick={createNewGame}>
              <Plus className="w-4 h-4 mr-2" />
              New Game
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No games yet. Create your first game to get
              started!
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedGameId === game.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedGameId(game.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">
                        {game.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {game.description || "No description"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteGame(game.id);
                      }}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingGame && (
        <>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="categories">
                Categories
              </TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent
              value="details"
              className="mt-6 space-y-4"
            >
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle>Game Details</CardTitle>
                    <Button onClick={saveGame} className="w-full sm:w-auto">
                      <Save className="w-4 h-4 mr-2" />
                      Save Game
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      Game Name
                    </label>
                    <Input
                      value={editingGame.name}
                      onChange={(e) =>
                        updateGame({ name: e.target.value })
                      }
                      placeholder="Enter game name..."
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1">
                      Description
                    </label>
                    <Textarea
                      value={editingGame.description}
                      onChange={(e) =>
                        updateGame({
                          description: e.target.value,
                        })
                      }
                      placeholder="Enter game description..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="categories"
              className="mt-6 space-y-4"
            >
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle>
                      Content Categories & Library
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button onClick={saveGame} className="flex-1 sm:flex-none">
                        <Save className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Save Game</span>
                        <span className="sm:hidden">Save</span>
                      </Button>
                      <Button
                        onClick={() =>
                          setShowReferenceLibrary(true)
                        }
                        className="flex-1 sm:flex-none"
                      >
                        <Library className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Open Reference Library</span>
                        <span className="sm:hidden">Reference</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <SimplifiedContentLibrary
                    gameId={editingGame.id}
                    content={gameContent}
                    contentCategories={editingGame.contentCategories}
                    onSaveContent={onSaveContent}
                    onDeleteContent={onDeleteContent}
                    onSaveCategory={handleSaveCategory}
                    onDeleteCategory={handleDeleteCategory}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Character Sheet Preview
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-2">
                        This interactive preview shows exactly how character sheets will function for players.
                      </p>
                    </div>
                    <Button onClick={saveGame} className="w-full sm:w-auto shrink-0">
                      <Save className="w-4 h-4 mr-2" />
                      Save Game
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!hasCharacterSheetCategories ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No categories set to appear on character sheet.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Enable "Appear on Character Sheet" for categories in your Content Library.
                      </p>
                    </div>
                  ) : gameContent.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No content defined yet.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Create content items in your Content Library to see them here.
                      </p>
                    </div>
                  ) : previewCharacter ? (
                    <CharacterSheetSimple
                      character={previewCharacter}
                      onUpdate={setPreviewCharacter}
                      readOnly={false}
                      content={content}
                      contentCategories={editingGame.contentCategories}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Reference Library Sheet */}
      {editingGame && (
        <RuleReferenceSheet
          open={showReferenceLibrary}
          onOpenChange={setShowReferenceLibrary}
          content={gameContent}
          contentCategories={editingGame.contentCategories}
          gameId={editingGame.id}
        />
      )}
    </div>
  );
}