import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { campaignsApi } from '../../api/campaignsApi';
import { get_userId } from '../../api/authStorage';
import type { Campaign, Game } from '../../api/models';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/toastProvider';
import { GameMasterViewFrame } from './GameMasterViewFrame';

type Props = {
  mode: 'create' | 'edit';
  campaign?: Campaign | null;
  games: Game[];
  embedded?: boolean;
  onBack: () => void;
  onSaved: (campaign: Campaign) => Promise<void> | void;
};

type FormState = {
  game_id: string;
  name: string;
  description: string;
};

export function GameMasterCampaignFormView({
  mode,
  campaign,
  games,
  embedded = false,
  onBack,
  onSaved,
}: Props) {
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);
  const { toastPromise } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    game_id: campaign?.game_id ?? games[0]?.id ?? '',
    name: campaign?.name ?? '',
    description: campaign?.description ?? '',
  });

  useEffect(() => {
    setForm({
      game_id: campaign?.game_id ?? games[0]?.id ?? '',
      name: campaign?.name ?? '',
      description: campaign?.description ?? '',
    });
  }, [campaign, games, mode]);

  useEffect(() => {
    if (!summaryRef.current) return;
    summaryRef.current.style.height = 'auto';
    summaryRef.current.style.height = `${summaryRef.current.scrollHeight}px`;
  }, [form.description]);

  const selectedGameName = useMemo(
    () => games.find((game) => game.id === form.game_id)?.game_name ?? 'Selected game',
    [form.game_id, games],
  );
  const hasGames = games.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('A campaign name is required.');
      return;
    }
    if (!form.game_id) {
      setError('Choose a game for the campaign.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const savedCampaign = mode === 'create'
        ? await toastPromise(
          campaignsApi.create({
            owner_user_id: get_userId(),
            game_id: form.game_id,
            name: form.name.trim(),
            description: form.description.trim() || undefined,
          }),
          {
            loading: 'Creating campaign...',
            success: 'Campaign created successfully.',
            error: (e) => (e as Error)?.message || 'Failed to create campaign.',
          },
        )
        : await toastPromise(
          campaignsApi.patch(campaign!.id, {
            game_id: form.game_id,
            name: form.name.trim(),
            description: form.description.trim() || undefined,
          }),
          {
            loading: 'Updating campaign...',
            success: 'Campaign updated successfully.',
            error: (e) => (e as Error)?.message || 'Failed to update campaign.',
          },
        );

      await onSaved(savedCampaign);
    } catch (err) {
      setError((err as Error)?.message || `Unable to ${mode} campaign.`);
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid gap-2">
        <Label htmlFor="gm-campaign-game">Game</Label>
        {hasGames ? (
          <Select value={form.game_id} onValueChange={(value) => setForm((prev) => ({ ...prev, game_id: value }))}>
            <SelectTrigger id="gm-campaign-game">
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              {games.map((game) => (
                <SelectItem key={game.id} value={game.id}>
                  {game.game_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input id="gm-campaign-game" value={selectedGameName} readOnly disabled />
        )}
        </div>
        <div className="grid gap-2">
        <Label htmlFor="gm-campaign-name">Campaign Name</Label>
        <Input
          id="gm-campaign-name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Secrets in the Wandering Trees"
          required
        />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="gm-campaign-description">Summary</Label>
        <Textarea
          id="gm-campaign-description"
          ref={summaryRef}
          className="min-h-[120px]"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="What this campaign is about, how it feels, and what the table should expect."
        />
      </div>
      {!hasGames ? (
        <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          No editable games were found. Campaign management needs at least one game option.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="min-h-[44px] sm:w-auto" disabled={isSaving || !hasGames}>
          {mode === 'create' ? 'Create Campaign' : 'Save Changes'}
        </Button>
        {!embedded ? (
          <Button type="button" variant="outline" className="min-h-[44px] sm:w-auto" onClick={onBack}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );

  if (embedded) {
    return content;
  }

  return (
    <GameMasterViewFrame
      title={mode === 'create' ? 'Create Campaign' : `Edit ${campaign?.name ?? 'Campaign'}`}
      description={
        mode === 'create'
          ? 'Choose the game first, then set the campaign details in this dedicated form.'
          : `Update campaign details for ${selectedGameName}, including moving the campaign to a different game.`
      }
      onBack={onBack}
    >
      {content}
    </GameMasterViewFrame>
  );
}
