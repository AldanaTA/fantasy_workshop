import { useState } from 'react';
import { NPC, Content, ContentCategoryDefinition, GameMechanic } from '../../types/game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, Users } from 'lucide-react';
import { CharacterSheetSimple } from '../CharacterSheet_simple';
import { toast } from 'sonner';

/**
 * NPCManager component handles creating, editing, and deleting NPCs within a session.
 * Each NPC uses the character sheet system for managing their stats and abilities.
 * 
 * @param npcs - Array of NPCs in the current session
 * @param gameId - ID of the game for the character sheet
 * @param gameContent - Array of content items available for NPCs
 * @param gameMechanics - Array of game mechanics for NPC abilities
 * @param contentCategories - Array of content categories for organization
 * @param onCreateNPC - Callback when creating a new NPC, receives the new NPC object
 * @param onUpdateNPC - Callback when updating an NPC, receives NPC ID and updates
 * @param onDeleteNPC - Callback when deleting an NPC, receives the NPC ID
 * @returns A card with NPC management interface
 */
interface NPCManagerProps {
  npcs: NPC[];
  gameId: string;
  gameContent: Content[];
  gameMechanics: GameMechanic[];
  contentCategories: ContentCategoryDefinition[];
  onCreateNPC: (npc: NPC) => void;
  onUpdateNPC: (npcId: string, updates: Partial<NPC>) => void;
  onDeleteNPC: (npcId: string) => void;
}

export function NPCManager({
  npcs,
  gameId,
  gameContent,
  gameMechanics,
  contentCategories,
  onCreateNPC,
  onUpdateNPC,
  onDeleteNPC,
}: NPCManagerProps) {
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);

  const createNpc = () => {
    const newNpc: NPC = {
      id: Date.now().toString(),
      name: 'New NPC',
      contentInstances: [],
    };

    onCreateNPC(newNpc);
    setSelectedNpcId(newNpc.id);
    toast.success('NPC created');
  };

  const deleteNpc = (npcId: string) => {
    onDeleteNPC(npcId);
    if (selectedNpcId === npcId) {
      setSelectedNpcId(null);
    }
  };

  const selectedNpc = npcs.find((npc) => npc.id === selectedNpcId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>NPCs</CardTitle>
            <Button onClick={createNpc}>
              <Plus className="w-4 h-4 mr-2" />
              New NPC
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {npcs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No NPCs yet. Create your first NPC!
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {npcs.map((npc) => (
                <div
                  key={npc.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedNpcId === npc.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedNpcId(npc.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        <h3 className="font-medium truncate">{npc.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {npc.contentInstances.length} content items
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNpc(npc.id);
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

      {selectedNpc && (
        <div>
          <div className="mb-4">
            <label className="text-sm font-medium block mb-1">NPC Name</label>
            <Input
              value={selectedNpc.name}
              onChange={(e) => onUpdateNPC(selectedNpc.id, { name: e.target.value })}
              placeholder="Enter NPC name..."
            />
          </div>

          <CharacterSheetSimple
            character={{
              id: selectedNpc.id,
              gameId: gameId,
              contentInstances: selectedNpc.contentInstances,
            }}
            onUpdate={(char) =>
              onUpdateNPC(selectedNpc.id, { contentInstances: char.contentInstances })
            }
            content={gameContent}
            mechanics={gameMechanics}
            contentCategories={contentCategories}
          />
        </div>
      )}
    </div>
  );
}
