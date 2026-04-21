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
import { BookOpen, Eye, Edit3, Plus, CircleArrowLeft,Trash2, View,} from 'lucide-react';
import { ContentPack, Game } from '../../api/models';
import { contentPacksApi, invalidateContentPacksByGame } from '../../api/contentPacksApi';
import { get_userId } from '../../api/authStorage';
import { VISIBILITY,Visibility } from '../../types/visibility';
import { STATUS, Status } from '../../types/status';
import { useToast } from '../ui/toastProvider';
import { ViewPackCategories } from './ViewPackCategories';
import { GameRulesRenderer } from '../content/GameRulesRenderer';

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
  const [previewTarget, setPreviewTarget] = useState<ContentPack | null>(null);
  const [previewPackIds, setPreviewPackIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ContentPack | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);
  const {toastPromise} = useToast();

  const resizeSummaryTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const loadPacks = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const contentPacks = await contentPacksApi.listByGame(game.id, 100, 0, { signal });
      setContentPacks(contentPacks);
    } catch (err) {
      if (isAbortError(err)) return;
      setError((err as Error)?.message || 'Unable to load content packs.');
      setContentPacks([]);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadPacks(controller.signal);

    return () => {
      controller.abort();
    };
  }, [game.id]);

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
          error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          "Failed to create content pack."
        });
      } else if (activePack) {
        await toastPromise(contentPacksApi.patch(activePack.id, {
          pack_name: form.pack_name.trim(),
          description: form.pack_description.trim() || undefined,
          visibility: form.visibility,
        }), {
          loading: "Updating content pack...",
          success: "Content pack updated successfully.",
          error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          "Failed to update content pack."
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
        error: (e) =>
        (e as any)?.response?.data?.detail ||
        (e as Error)?.message ||
        "Failed to delete content pack."
      });

      invalidateContentPacksByGame(game.id);
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await loadPacks();


    } catch (err) {
  
    }
  };
  if (viewTarget) {
    return (
      <ViewPackCategories
      pack={viewTarget}
      onBackToPacks={() => setViewTarget(null)}
      onGoToDashboard={onBack}
      />
    );
  }

  if (previewTarget) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="grid min-w-0 gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold">Preview {game.game_name} rules</h2>
              <p className="text-sm text-muted-foreground">
                Start with {previewTarget.pack_name}, then include any other pack sources you want to compare.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPreviewTarget(null);
                setPreviewPackIds([]);
              }}
              className="min-h-[44px] min-w-0 sm:w-auto"
            >
              <CircleArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Back to Packs</span>
            </Button>
          </div>
          <Separator />
          <GameRulesRenderer
            gameId={game.id}
            selectedPackIds={previewPackIds}
            onSelectedPackIdsChange={setPreviewPackIds}
            mode="full"
            visibility="gm"
            packMode="multi"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold">View {game.game_name} content packs</h2>
            <p className="text-sm text-muted-foreground">
              This is where you can view the game content packs.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          <Button onClick={onBack}
            
            className="min-h-[44px] min-w-0 px-2 sm:px-4"
          >
            <CircleArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate sm:hidden">Dashboard</span>
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>                                                                                                                   
          <Button
            onClick={openCreateDialog}
            className="min-h-[44px] min-w-0 px-2 sm:px-4"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate sm:hidden">Pack</span>
            <span className="hidden sm:inline">Content Pack</span>
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
              <Card key={pack.id} className="min-w-0 border">
                <CardHeader className="min-w-0">
                  <CardTitle className="break-words">{pack.pack_name}</CardTitle>
                  <CardDescription className="break-words">{pack.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setViewTarget(pack)} className="min-w-0 px-2 sm:px-3">
                    <Eye className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="truncate">Categories</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-w-0 px-2 sm:px-3"
                    onClick={() => {
                      setPreviewTarget(pack);
                      setPreviewPackIds([pack.id]);
                    }}
                  >
                    <BookOpen className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="truncate">Preview</span>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEditDialog(pack)} className="min-w-0 px-2 sm:px-3">
                    <Edit3 className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="truncate">Edit</span>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => {setDeleteTarget(pack); setIsDeleteOpen(true);}} className="min-w-0 px-2 sm:px-3">
                    <Trash2 className="h-4 w-4 shrink-0 sm:mr-2" />
                    <span className="truncate">Delete</span>
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
            <DialogTitle>{dialogMode === 'create' ? 'Create Pack' : 'Edit Pack'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Add a new content pack that you can manage as creator.'
                : 'Update the content pack details and save your changes.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleDialogSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="pack_name">Name</Label>
              <Input
                id="pack_name"
                value={form.pack_name}
                onChange={(event) => setForm((prev) => ({ ...prev, pack_name: event.target.value }))}
                placeholder="Mysteries of Lunaris Tower"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pack_description">Description</Label>
              <Textarea
                id="pack_description"
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
                {dialogMode === 'create' ? 'Create Pack' : 'Save Changes'}
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

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}
