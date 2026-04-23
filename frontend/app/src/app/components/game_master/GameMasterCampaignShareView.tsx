import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Link2, UserPlus2, X } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import type { Campaign, UserCampaignRole } from '../../api/models';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useToast } from '../ui/toastProvider';
import { GameMasterViewFrame } from './GameMasterViewFrame';

type Props = {
  campaign: Campaign;
  onBack: () => void;
};

const roleOptions = [
  { value: 'co_gm', label: 'Co-GM' },
  { value: 'player', label: 'Player' },
];

export function GameMasterCampaignShareView({ campaign, onBack }: Props) {
  const { toast, toastPromise } = useToast();
  const [roles, setRoles] = useState<UserCampaignRole[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('player');
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState('7');
  const [inviteMaxUses, setInviteMaxUses] = useState('10');
  const [invitePreviewLink, setInvitePreviewLink] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRoles(await campaignsApi.listRoles(campaign.id));
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load campaign roles.');
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, [campaign.id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId.trim()) {
      setError('A user ID is required.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await toastPromise(
        campaignsApi.upsertRole(campaign.id, userId.trim(), {
          user_id: userId.trim(),
          campaign_id: campaign.id,
          role,
        }),
        {
          loading: 'Updating campaign access...',
          success: 'Campaign role saved.',
          error: (e) => (e as Error)?.message || 'Failed to save campaign role.',
        },
      );
      setUserId('');
      await loadRoles();
    } catch (err) {
      setError((err as Error)?.message || 'Unable to update campaign access.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (target: UserCampaignRole) => {
    try {
      await toastPromise(
        campaignsApi.deleteRole(campaign.id, target.user_id),
        {
          loading: 'Removing campaign access...',
          success: 'Campaign role removed.',
          error: (e) => (e as Error)?.message || 'Failed to remove campaign role.',
        },
      );
      await loadRoles();
    } catch (err) {
      setError((err as Error)?.message || 'Unable to remove campaign access.');
    }
  };

  const handleGenerateInvitePreview = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
    const expires = Number(inviteExpiresInDays) || 7;
    const maxUses = inviteMaxUses.trim() === '' ? 'unlimited' : inviteMaxUses.trim();
    const previewUrl = `${origin}/invite/campaign/${campaign.id}?expires=${expires}&max_uses=${maxUses}&preview_only=true`;
    setInvitePreviewLink(previewUrl);
    toast({
      title: 'Invite link preview ready',
      description: 'This preview is UI-only until the invite endpoint is wired.',
      variant: 'success',
    });
  };

  const handleCopyInvitePreview = async () => {
    if (!invitePreviewLink) {
      toast({
        title: 'No invite preview',
        description: 'Generate an invite link preview first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(invitePreviewLink);
      toast({
        title: 'Copied',
        description: 'Invite preview link copied to clipboard.',
        variant: 'success',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select the preview link and copy it manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <GameMasterViewFrame
      title={`Share ${campaign.name}`}
      description="Manage direct campaign access and prepare invite links from one share surface."
      onBack={onBack}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form className="grid gap-4 rounded-2xl border border-border bg-background p-4" onSubmit={handleSubmit}>
          <div>
            <h3 className="text-base font-semibold">Direct Access</h3>
            <p className="text-sm text-muted-foreground">
              Grant a specific user player or co-GM access using the current sharing flow.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gm-share-user-id">User ID</Label>
            <Input
              id="gm-share-user-id"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Paste the user's UUID"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gm-share-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="gm-share-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="min-h-[44px] sm:w-auto" disabled={isSaving}>
              <UserPlus2 className="h-4 w-4" />
              Save Access
            </Button>
          </div>
        </form>

        <div className="grid gap-4 rounded-2xl border border-border bg-background p-4">
          <div>
            <h3 className="text-base font-semibold">Invite Link</h3>
            <p className="text-sm text-muted-foreground">
              Set the future invite link behavior now. This section is a UX preview until the backend endpoint is ready.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="gm-share-expires">Expires in days</Label>
              <Input
                id="gm-share-expires"
                type="number"
                min="1"
                value={inviteExpiresInDays}
                onChange={(event) => setInviteExpiresInDays(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gm-share-max-uses">Max uses</Label>
              <Input
                id="gm-share-max-uses"
                type="number"
                min="1"
                value={inviteMaxUses}
                onChange={(event) => setInviteMaxUses(event.target.value)}
                placeholder="Leave blank for unlimited"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gm-share-preview-link">Preview link</Label>
            <Input
              id="gm-share-preview-link"
              value={invitePreviewLink}
              readOnly
              placeholder="Generate a preview link"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="min-h-[44px] sm:w-auto" onClick={handleGenerateInvitePreview}>
              <Link2 className="h-4 w-4" />
              Generate Preview
            </Button>
            <Button type="button" variant="outline" className="min-h-[44px] sm:w-auto" onClick={() => void handleCopyInvitePreview()}>
              <Copy className="h-4 w-4" />
              Copy Preview
            </Button>
          </div>
          <div className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Preview links are intentionally non-functional until the invite endpoint exists.
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="border-border">
          <CardContent className="space-y-2">
            <CardTitle className="text-base">Owner</CardTitle>
            <CardDescription>{campaign.owner_user_id}</CardDescription>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            Loading campaign roles...
          </div>
        ) : roles.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            No shared campaign roles yet.
          </div>
        ) : (
          roles.map((entry) => (
            <Card key={entry.user_id} className="border-border">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">{entry.role}</CardTitle>
                  <CardDescription>{entry.user_id}</CardDescription>
                </div>
                <Button type="button" variant="destructive" size="sm" onClick={() => void handleDelete(entry)}>
                  <X className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </GameMasterViewFrame>
  );
}
