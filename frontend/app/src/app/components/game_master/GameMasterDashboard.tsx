import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {ToastProvider, useToast} from  '../ui/toastProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { BookOpen, Copy, Eye, Edit3, Link2, Plus, Trash2 } from 'lucide-react';
import { Campaign} from '../../api/models';
import { campaignsApi } from '../../api/campaignsApi';
import { get_userId } from '../../api/authStorage';
import type { UUID } from '../../types/misc';

interface FormState {
  campaign_name: string;
  campaign_summary: string;
}

const emptyForm: FormState = {
  campaign_name: '',
  campaign_summary: '',
};

interface GameMasterDashboardProps {
  initialViewGameId?: UUID | null;
  onInitialViewHandled?: () => void;
}

export function GameMasterDashboard({
  initialViewGameId = null,
  onInitialViewHandled,
}: GameMasterDashboardProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewTarget, setViewTarget] = useState<Campaign | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);
  const {toast, toastPromise} = useToast();

  const resizeSummaryTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const loadGames = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const campaigns = await campaignsApi.listGm();
      setCampaigns(campaigns);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load campaigns.');
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    if (!initialViewGameId || isLoading) {
      return;
    }

    const matchedCampaign = campaigns.find((campaign) => campaign.id === initialViewGameId) ?? null;
    if (matchedCampaign) {
      setViewTarget(matchedCampaign);
    }
    onInitialViewHandled?.();
  }, [campaigns, initialViewGameId, isLoading, onInitialViewHandled]);

  useEffect(() => {
    resizeSummaryTextarea(summaryRef.current);
  }, [form.campaign_summary, isDialogOpen]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setForm(emptyForm);
    setActiveCampaign(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (campaign: Campaign) => {
    setDialogMode('edit');
    setActiveCampaign(campaign);
    setForm({
      campaign_name: campaign.name,
      campaign_summary: campaign.description ?? '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setActiveCampaign(null);
    setError(null);
  };

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.campaign_name.trim()) {
      setError('A campaign name is required.');
      return;
    }

    setError(null);

    try {
      if (dialogMode === 'create') {
        await toastPromise(campaignsApi.create({
          owner_user_id: get_userId(),
          name: form.campaign_name.trim(),
          description: form.campaign_summary.trim() || undefined,
        }), {
          loading: "Creating Campaign...",
          success: "Campaign created successfully.",
          error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          "Failed to create campaign.",
        });
      } else if (activeCampaign) {
        await toastPromise(campaignsApi.patch(activeCampaign.id, {
          name: form.campaign_name.trim(),
          description: form.campaign_summary.trim() || undefined,
        }), {
          loading: "Updating campaign...",
          success: "Campaign updated successfully.",
          error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          "Failed to update campaign."
        });
      }
      closeDialog();
      await loadGames();
    } catch (err) {
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setError(null);

    try {
      await toastPromise(campaignsApi.delete(deleteTarget.id), {
        loading: "Deleting campaign...",
        success: "Campaign deleted successfully.",
        error: (e) =>
      (e as any)?.response?.data?.detail ||
      (e as Error)?.message ||
      "Failed to delete campaign.",
      });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await loadGames();
    } catch (err) {
    }
  
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Game Master Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Manage campaigns you can edit or own.
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            Make Campaign
          </Button>
        </div>

        <Separator />

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
            Loading campaigns...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
            {error}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            No editable campaigns found. Use Make Campaign to create your first campaign.
          </div>
        ) : (
          <div  className="relative space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="border-border">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {campaign.name}
                      </CardTitle>
                      <CardDescription>
                        {campaign.description || 'No summary available.'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Link2 className="h-3.5 w-3.5" />
                        Share
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openEditDialog(campaign)}>
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => {
                        setDeleteTarget(campaign);
                        setIsDeleteOpen(true);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Del
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Create Game' : 'Edit Game'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Add a new game that you can manage as creator.'
                : 'Update the game details and save your changes.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleDialogSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="campaign_name">Name</Label>
              <Input
                id="campaign_name"
                value={form.campaign_name}
                onChange={(event) => setForm((prev) => ({ ...prev, campaign_name: event.target.value }))}
                placeholder="Secrets in the Wandering Trees"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="campaign_summary">Summary</Label>
              <Textarea
                id="campaign_summary"
                ref={summaryRef}
                className="min-h-[120px]"
                value={form.campaign_summary}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, campaign_summary: event.target.value }));
                  resizeSummaryTextarea(event.currentTarget);
                }}
                placeholder="A compact tabletop system for fast fantasy play."
              />
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">
                {dialogMode === 'create' ? 'Create Game' : 'Save Changes'}
              </Button>
              <Button variant="outline" type="button" onClick={closeDialog} className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a game is permanent. This will remove the game from your editable list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteTarget(null);
                setIsDeleteOpen(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
