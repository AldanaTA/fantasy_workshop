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
import { Eye, Edit3, Plus, Trash2, View } from 'lucide-react';
import { Game } from '../../api/models';
import { gamesApi } from '../../api/gamesApi';
import { get_userId } from '../../api/authStorage';
import {  Visibility, VISIBILITY} from '../../types/visibility';
import {ViewGamePacks} from './ViewGamePacks';

interface FormState {
  game_name: string;
  game_summary: string;
  visibility: Visibility;
}

const emptyForm: FormState = {
  game_name: '',
  game_summary: '',
  visibility: VISIBILITY.PRIVATE,
};

export function GameCreatorDashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewTarget, setViewTarget] = useState<Game | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeSummaryTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const loadGames = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const editableGames = await gamesApi.listEditable();
      setGames(editableGames);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load games.');
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    resizeSummaryTextarea(summaryRef.current);
  }, [form.game_summary, isDialogOpen]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setForm(emptyForm);
    setActiveGame(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (game: Game) => {
    setDialogMode('edit');
    setActiveGame(game);
    setForm({
      game_name: game.game_name,
      game_summary: game.game_summary ?? '',
      visibility: game.visibility || VISIBILITY.PRIVATE
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setActiveGame(null);
    setError(null);
  };

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.game_name.trim()) {
      setError('A game name is required.');
      return;
    }

    setError(null);

    try {
      if (dialogMode === 'create') {
        await gamesApi.create({
          owner_user_id: get_userId(),
          game_name: form.game_name.trim(),
          game_summary: form.game_summary.trim() || undefined,
          visibility: form.visibility,
        });
      } else if (activeGame) {
        await gamesApi.patch(activeGame.id, {
          game_name: form.game_name.trim(),
          game_summary: form.game_summary.trim() || undefined,
          visibility: form.visibility,
        });
      }
      closeDialog();
      await loadGames();
    } catch (err) {
      setError((err as Error)?.message || 'Failed to save game.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setError(null);

    try {
      await gamesApi.delete(deleteTarget.id);
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await loadGames();
    } catch (err) {
      setError((err as Error)?.message || 'Failed to delete game.');
    }
  
  };
  if (viewTarget) {
    return (
      <ViewGamePacks game={viewTarget} />
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Creator Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Manage games you can edit or own.
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            Make Game
          </Button>
        </div>

        <Separator />

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
            Loading games...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
            {error}
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            No editable games found. Use Make Game to create your first game.
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => (
              <Card key={game.id} className="border-border">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {game.game_name}
                      </CardTitle>
                      <CardDescription>
                        {game.game_summary || 'No summary available.'}
                      </CardDescription>
                      <div className="mt-2 inline-flex items-center rounded-full border border-border px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {game.visibility}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setViewTarget(game)}>
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openEditDialog(game)}>
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => {
                        setDeleteTarget(game);
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
              <Label htmlFor="game_name">Name</Label>
              <Input
                id="game_name"
                value={form.game_name}
                onChange={(event) => setForm((prev) => ({ ...prev, game_name: event.target.value }))}
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
                value={form.game_summary}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, game_summary: event.target.value }));
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
