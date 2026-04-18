import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
import { Eye, Edit3, Plus, CircleArrowLeft,Trash2,} from 'lucide-react';
import { ContentPack, Game } from '../../api/models';
import {contentPacksApi} from '../../api/contentPacksApi';
import { get_userId } from '../../api/authStorage';
import { VISIBILITY,Visibility } from '../../types/visibility';
import { STATUS, Status } from '../../types/status';
import { useToast } from '../ui/toastProvider';

interface FormState {
  pack_name: string;
  pack_description: string;
  visibility: Visibility;
  status: Status
}
const emptyForm: FormState = {
  pack_name: '',
  pack_description: '',
  visibility: 'private',
  status: 'draft'
};

type Props = {
  game: Game;
  onBack?: () => void;
};

export function ViewGamePacks({ game, onBack }: Props) {
  const [contentpacks, setContentPacks] = useState<ContentPack[]>([]);
  const [isloading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [activePack, setActivePack] = useState<ContentPack | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewTarget, setViewTarget] = useState<ContentPack | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentPack | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);
  const {toastPromise} = useToast();

  const resizeSummaryTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const loadPacks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const contentPacks = await contentPacksApi.listByGame(game.id, 100, 0);
      setContentPacks(contentPacks);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load content packs.');
      setContentPacks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPacks();
  }, []);

  useEffect(() => {
    resizeSummaryTextarea(summaryRef.current);
  }, [form.pack_description, isDialogOpen]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setForm(emptyForm);
    setActivePack(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (contentPack: ContentPack) => {
    setDialogMode('edit');
    setActivePack(contentPack);
    setForm({
      pack_name: contentPack.pack_name,
      pack_description: contentPack.description ?? '',
      visibility: contentPack.visibility || VISIBILITY.PRIVATE,
      status: contentPack.status || STATUS.DRAFT
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setActivePack(null);
    setError(null);
  };

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.pack_name.trim()) {
      setError('A content pack name is required.');
      return;
    }

    setError(null);

    try {
      if (dialogMode === 'create') {
        await toastPromise(contentPacksApi.create({
          owner_id: get_userId(),
          game_id: game.id,
          pack_name: form.pack_name.trim(),
          description: form.pack_description.trim() || undefined,
          visibility: form.visibility,
        }), {
          loading: "Creating content pack...",
          success: "Content pack created successfully.",
          error: "Failed to create content pack."
        });
      } else if (activePack) {
        await toastPromise(contentPacksApi.patch(activePack.id, {
          pack_name: form.pack_name.trim(),
          description: form.pack_description.trim() || undefined,
          visibility: form.visibility,
        }), {
          loading: "Updating content pack...",
          success: "Content pack updated successfully.",
          error: "Failed to update content pack."
        });
      }
      closeDialog();
      await loadPacks();
    } catch (err) {
    }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await toastPromise(contentPacksApi.delete(deleteTarget.id), {
        loading: "Deleting content pack...",
        success: "Content pack deleted successfully.",
        error: "Failed to delete content pack."
      });

      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await loadPacks();


    } catch (err) {
  
    }
  };
  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">View {game.game_name} content packs</h2>
            <p className="text-sm text-muted-foreground">
              This is where you can view the game content packs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <Button onClick={onBack}
            
            className="min-h-[44px]"
          >
            <CircleArrowLeft className="h-4 w-4" />
            Back to Game List
          </Button>                                                                                                                   
          <Button
            onClick={openCreateDialog}
            className="min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            Make Content Pack
          </Button>
          </div>
        </div>
        <Separator />
        {isloading ? (
          <p>Loading content packs...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : contentpacks.length === 0 ? (
          <p>No content packs found. Create one to get started!</p>
        ) : (
          <div className="space-y-4">
            {contentpacks.map((pack) => (
              <Card key={pack.id} className="border">
                <CardHeader>
                  <CardTitle>{pack.pack_name}</CardTitle>
                  <CardDescription>{pack.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewTarget(pack)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEditDialog(pack)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => {setDeleteTarget(pack); setIsDeleteOpen(true);}}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
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
              <Label htmlFor="game_name">Name</Label>
              <Input
                id="game_name"
                value={form.pack_name}
                onChange={(event) => setForm((prev) => ({ ...prev, pack_name: event.target.value }))}
                placeholder="My Adventure System"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="game_summary">Summary</Label>
              <Textarea
                id="game_summary"
                ref={summaryRef}
                className="min-h-[120px]"
                value={form.pack_description}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, pack_description: event.target.value }));
                  resizeSummaryTextarea(event.currentTarget);
                }}
                placeholder="A compact tabletop system for fast fantasy play."
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="visibility">Visibility</Label>
                <p className="text-xs text-muted-foreground">Who can view this game</p>
              </div>
              <Select
                value={form.visibility}
                onValueChange={(value) => setForm((prev) => ({ ...prev, visibility: value as Visibility }))}
              >
                <SelectTrigger id="visibility">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VISIBILITY.PRIVATE}>Private</SelectItem>
                  <SelectItem value={VISIBILITY.PUBLIC}>Public</SelectItem>
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>Delete Content Pack?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a content pack is permanent. This will remove the content pack from your editable list.
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