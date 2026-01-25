import { useState } from 'react';
import { Game, Session, Campaign, NPC, Content, GameMechanic } from '../types/game';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RuleReferenceSheet } from './RuleReferenceSheet';
import { CampaignManager } from './CampaignManager';
import { GameSelector } from './game-master/GameSelector';
import { SessionList } from './game-master/SessionList';
import { SessionDetailsTab } from './game-master/SessionDetailsTab';
import { SharedContentManager } from './game-master/SharedContentManager';
import { NPCManager } from './game-master/NPCManager';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';

/**
 * GameMaster component is the main interface for Game Masters to manage campaigns,
 * sessions, NPCs, and content. It provides tools for running games and controlling
 * what players can access.
 * 
 * @param games - Array of all available games
 * @param sessions - Array of all GM sessions
 * @param campaigns - Array of all campaigns
 * @param content - Array of all game content items
 * @param onSaveSession - Callback to save or update a session
 * @param onDeleteSession - Callback to delete a session
 * @param onSaveCampaign - Callback to save or update a campaign
 * @param onDeleteCampaign - Callback to delete a campaign
 * @param onSaveContent - Callback to save or update content
 * @returns The complete Game Master interface
 */
interface GameMasterProps {
  games: Game[];
  sessions: Session[];
  campaigns: Campaign[];
  content: Content[];
  onSaveSession: (session: Session) => void;
  onDeleteSession: (id: string) => void;
  onSaveCampaign: (campaign: Campaign) => void;
  onDeleteCampaign: (id: string) => void;
  onSaveContent: (content: Content) => void;
}

export function GameMaster({
  games,
  sessions,
  campaigns,
  content,
  onSaveSession,
  onDeleteSession,
  onSaveCampaign,
  onDeleteCampaign,
  onSaveContent,
}: GameMasterProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<'campaign' | 'session' | 'npcs'>('campaign');
  const [referenceLibraryOpen, setReferenceLibraryOpen] = useState(false);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  const createSession = () => {
    if (!selectedGameId) {
      toast.error('Please select a game first');
      return;
    }

    const newSession: Session = {
      id: Date.now().toString(),
      gameId: selectedGameId,
      name: 'New Session',
      gmNotes: '',
      npcs: [],
      encounters: [],
      inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      sharedContentIds: [],
    };

    onSaveSession(newSession);
    setSelectedSessionId(newSession.id);
    setEditingSession(newSession);
    toast.success('New session created');
  };

  const updateSession = (updates: Partial<Session>) => {
    if (!editingSession) return;

    const updated = { ...editingSession, ...updates };
    setEditingSession(updated);
    onSaveSession(updated);
  };

  const handleDeleteSession = (id: string) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      onDeleteSession(id);
      if (selectedSessionId === id) {
        setSelectedSessionId(null);
        setEditingSession(null);
      }
      toast.success('Session deleted');
    }
  };

  const handleSelectSession = (session: Session) => {
    setSelectedSessionId(session.id);
    setEditingSession(session);
  };

  const handleCreateNPC = (npc: NPC) => {
    if (!editingSession) return;
    updateSession({ npcs: [...editingSession.npcs, npc] });
  };

  const handleUpdateNPC = (npcId: string, updates: Partial<NPC>) => {
    if (!editingSession) return;
    updateSession({
      npcs: editingSession.npcs.map((npc) =>
        npc.id === npcId ? { ...npc, ...updates } : npc
      ),
    });
  };

  const handleDeleteNPC = (npcId: string) => {
    if (!editingSession) return;
    updateSession({
      npcs: editingSession.npcs.filter((npc) => npc.id !== npcId),
    });
    toast.success('NPC deleted');
  };

  // Get game mechanics for selected game
  const gameMechanics: GameMechanic[] = selectedGameId
    ? JSON.parse(localStorage.getItem(`mechanics_${selectedGameId}`) || '[]')
    : [];

  // Filter content for selected game
  const gameContent = content.filter((c) => c.gameId === selectedGameId);

  return (
    <div className="space-y-6">
      {/* Game Selection */}
      <GameSelector
        games={games}
        selectedGameId={selectedGameId}
        onSelectGame={setSelectedGameId}
      />

      {/* Campaign Management */}
      {selectedGameId && selectedGame && (
        <div className="space-y-4">
          {/* Reference Library Sheet */}
          <RuleReferenceSheet
            open={referenceLibraryOpen}
            onOpenChange={setReferenceLibraryOpen}
            content={content}
            contentCategories={selectedGame.contentCategories}
            gameId={selectedGameId}
          />

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid flex-1 grid-cols-3">
                <TabsTrigger value="campaign">Campaigns</TabsTrigger>
                <TabsTrigger value="session">Sessions</TabsTrigger>
                <TabsTrigger value="npcs">NPCs</TabsTrigger>
              </TabsList>
              <Button 
                onClick={() => setReferenceLibraryOpen(true)} 
                variant="outline"
                className="ml-4"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Reference Library
              </Button>
            </div>

            <TabsContent value="campaign" className="mt-6">
              <CampaignManager
                game={selectedGame}
                campaigns={campaigns}
                onSaveCampaign={onSaveCampaign}
                onDeleteCampaign={onDeleteCampaign}
                selectedCampaign={campaigns.find((c) => c.id === selectedCampaignId) || null}
                onSelectCampaign={(campaign) => setSelectedCampaignId(campaign?.id || null)}
              />
            </TabsContent>

            <TabsContent value="session" className="mt-6 space-y-6">
              <SessionList
                sessions={sessions}
                gameId={selectedGameId}
                selectedSessionId={selectedSessionId}
                onCreateSession={createSession}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
              />

              {editingSession && (
                <Tabs defaultValue="details">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="content">Shared Content</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="mt-4">
                    <SessionDetailsTab
                      session={editingSession}
                      onUpdateSession={updateSession}
                    />
                  </TabsContent>

                  <TabsContent value="content" className="mt-4">
                    <SharedContentManager
                      session={editingSession}
                      gameContent={gameContent}
                      contentCategories={selectedGame.contentCategories}
                      onUpdateSession={updateSession}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </TabsContent>

            <TabsContent value="npcs" className="mt-6">
              {editingSession ? (
                <NPCManager
                  npcs={editingSession.npcs}
                  gameId={selectedGameId}
                  gameContent={gameContent}
                  gameMechanics={gameMechanics}
                  contentCategories={selectedGame.contentCategories}
                  onCreateNPC={handleCreateNPC}
                  onUpdateNPC={handleUpdateNPC}
                  onDeleteNPC={handleDeleteNPC}
                />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p>Select a session to manage NPCs</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!selectedGameId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Select a game to manage campaigns and sessions</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}