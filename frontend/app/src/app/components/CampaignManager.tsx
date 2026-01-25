import { useState } from 'react';
import { Campaign, Game } from '../types/game';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Plus, Trash2, Copy, Users } from 'lucide-react';
import { toast } from 'sonner';

/**
 * CampaignManager component provides a complete interface for managing campaigns.
 * GMs can create, edit, and delete campaigns, manage player invites, and track
 * campaign information like descriptions and GM notes.
 * 
 * @param game - The game this campaign manager is for
 * @param campaigns - Array of all campaigns (will be filtered by game)
 * @param onSaveCampaign - Callback to save or update a campaign
 * @param onDeleteCampaign - Callback to delete a campaign by ID
 * @param onSelectCampaign - Callback when a campaign is selected
 * @param selectedCampaign - Currently selected campaign (if any)
 * @returns Campaign management interface with list and detail views
 */
interface CampaignManagerProps {
  game: Game;
  campaigns: Campaign[];
  onSaveCampaign: (campaign: Campaign) => void;
  onDeleteCampaign: (id: string) => void;
  onSelectCampaign: (campaign: Campaign | null) => void;
  selectedCampaign: Campaign | null;
}

export function CampaignManager({
  game,
  campaigns,
  onSaveCampaign,
  onDeleteCampaign,
  onSelectCampaign,
  selectedCampaign,
}: CampaignManagerProps) {
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(selectedCampaign);

  const createCampaign = () => {
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      gameId: game.id,
      name: 'New Campaign',
      description: '',
      inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      playerIds: [],
      gmNotes: '',
      createdAt: new Date().toISOString(),
    };

    onSaveCampaign(newCampaign);
    setEditingCampaign(newCampaign);
    onSelectCampaign(newCampaign);
    toast.success('Campaign created');
  };

  const updateCampaign = (updates: Partial<Campaign>) => {
    if (!editingCampaign) return;

    const updated = { ...editingCampaign, ...updates };
    setEditingCampaign(updated);
    onSaveCampaign(updated);
  };

  const deleteCampaign = (id: string) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      onDeleteCampaign(id);
      if (editingCampaign?.id === id) {
        setEditingCampaign(null);
        onSelectCampaign(null);
      }
      toast.success('Campaign deleted');
    }
  };

  const copyInviteLink = () => {
    if (!editingCampaign?.inviteCode) return;

    const inviteLink = `${window.location.origin}?invite=${editingCampaign.inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied to clipboard!');
  };

  const gameCampaigns = campaigns.filter((c) => c.gameId === game.id);

  return (
    <div className="space-y-6">
      {/* Campaign Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Campaigns</CardTitle>
            <Button onClick={createCampaign}>
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {gameCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No campaigns yet. Create your first campaign!
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {gameCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    editingCampaign?.id === campaign.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => {
                    setEditingCampaign(campaign);
                    onSelectCampaign(campaign);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{campaign.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {campaign.playerIds.length} players
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCampaign(campaign.id);
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

      {/* Campaign Details */}
      {editingCampaign && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Campaign Name</label>
                <Input
                  value={editingCampaign.name}
                  onChange={(e) => updateCampaign({ name: e.target.value })}
                  placeholder="Enter campaign name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <Textarea
                  value={editingCampaign.description}
                  onChange={(e) => updateCampaign({ description: e.target.value })}
                  placeholder="Describe your campaign..."
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">GM Notes</label>
                <Textarea
                  value={editingCampaign.gmNotes}
                  onChange={(e) => updateCampaign({ gmNotes: e.target.value })}
                  placeholder="Private notes for the GM..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Player Invite */}
          <Card>
            <CardHeader>
              <CardTitle>Player Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Invite Code</label>
                <div className="flex gap-2">
                  <Input
                    value={editingCampaign.inviteCode}
                    readOnly
                    className="font-mono bg-muted"
                  />
                  <Button onClick={copyInviteLink} variant="outline">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Share this link with players to let them join your campaign
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Players ({editingCampaign.playerIds.length})
                </label>
                {editingCampaign.playerIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    No players have joined yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editingCampaign.playerIds.map((playerId) => (
                      <div
                        key={playerId}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <span className="text-sm">Character {playerId}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            updateCampaign({
                              playerIds: editingCampaign.playerIds.filter(
                                (id) => id !== playerId
                              ),
                            });
                            toast.success('Player removed from campaign');
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}