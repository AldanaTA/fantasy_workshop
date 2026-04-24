import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/toastProvider';
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
import { Game, GameShareLink } from '../../api/models';
import { gamesApi } from '../../api/gamesApi';
import { get_userId } from '../../api/authStorage';
import {  Visibility, VISIBILITY} from '../../types/visibility';
import { GameRulesRenderer } from '../content/GameRulesRenderer';
import type { UUID } from '../../types/misc';
import {
  getSavedCreatorPackState,
  getSavedCreatorState,
  setSavedCreatorPackState,
  setSavedCreatorState,
} from '../../api/appResumeStorage';
import { GamePackWorkspace } from '../game_packs/GamePackWorkspace';

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

interface GameCreatorDashboardProps {
  initialViewGameId?: UUID | null;
  onInitialViewHandled?: () => void;
}

export function GameCreatorDashboard({
  initialViewGameId = null,
  onInitialViewHandled,
}: GameCreatorDashboardProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [packWorkspaceGameId, setPackWorkspaceGameId] = useState<string | null>(initialViewGameId);
  const [isPackWorkspaceOpen, setIsPackWorkspaceOpen] = useState(Boolean(initialViewGameId));
  const [previewTarget, setPreviewTarget] = useState<Game | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [shareTarget, setShareTarget] = useState<Game | null>(null);
  const [shareLinks, setShareLinks] = useState<GameShareLink[]>([]);
  const [generatedShareLink, setGeneratedShareLink] = useState<GameShareLink | null>(null);
  const [shareExpiresInDays, setShareExpiresInDays] = useState('7');
  const [shareMaxUses, setShareMaxUses] = useState('10');
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);
  const shareDialogBodyRef = useRef<HTMLDivElement | null>(null);
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
    if (isLoading || hasRestoredState) {
      return;
    }

    if (initialViewGameId) {
      setPackWorkspaceGameId(initialViewGameId);
      setIsPackWorkspaceOpen(true);
      onInitialViewHandled?.();
      setHasRestoredState(true);
      return;
    }

    const savedState = getSavedCreatorState();
    if (!savedState || savedState.view === 'list') {
      setHasRestoredState(true);
      return;
    }

    if (savedState.view === 'packs') {
      setPackWorkspaceGameId(savedState.gameId);
      setIsPackWorkspaceOpen(true);
      setHasRestoredState(true);
      return;
    }

    const matchedGame = games.find((game) => game.id === savedState.gameId) ?? null;
    if (!matchedGame) {
      setSavedCreatorState({ view: 'list' });
      setHasRestoredState(true);
      return;
    }

    setPreviewTarget(matchedGame);

    setHasRestoredState(true);
  }, [games, hasRestoredState, initialViewGameId, isLoading, onInitialViewHandled]);

  useEffect(() => {
    resizeSummaryTextarea(summaryRef.current);
  }, [form.game_summary, isDialogOpen]);

  useEffect(() => {
    if (!hasRestoredState) {
      return;
    }

    if (isPackWorkspaceOpen && packWorkspaceGameId) {
      setSavedCreatorState({ view: 'packs', gameId: packWorkspaceGameId });
      return;
    }

    if (previewTarget) {
      setSavedCreatorState({ view: 'preview', gameId: previewTarget.id });
      return;
    }

    setSavedCreatorState({ view: 'list' });
  }, [hasRestoredState, isPackWorkspaceOpen, packWorkspaceGameId, previewTarget]);

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

  const isShareLinkVisible = (link: GameShareLink) => {
    return !link.revoked_at && new Date(link.expires_at).getTime() > Date.now();
  };

  const visibleShareLinks = (links: GameShareLink[]) => links.filter(isShareLinkVisible);

  const openShareDialog = async (game: Game) => {
    setShareTarget(game);
    setGeneratedShareLink(null);
    setShareExpiresInDays('7');
    setShareMaxUses('10');
    setShareError(null);
    setIsShareLoading(true);

    try {
      const links = await gamesApi.listShareLinks(game.id);
      setShareLinks(visibleShareLinks(links));
    } catch (err) {
      setShareError((err as Error)?.message || 'Unable to load share links.');
      setShareLinks([]);
    } finally {
      setIsShareLoading(false);
    }
  };

  const closeShareDialog = () => {
    setShareTarget(null);
    setGeneratedShareLink(null);
    setShareLinks([]);
    setShareError(null);
  };

  useEffect(() => {
    if (!shareTarget) {
      return;
    }

    const pruneExpiredLinks = () => {
      setShareLinks((prev) => visibleShareLinks(prev));
      setGeneratedShareLink((prev) => (prev && isShareLinkVisible(prev) ? prev : null));
    };

    pruneExpiredLinks();
    const timer = window.setInterval(pruneExpiredLinks, 30000);
    return () => window.clearInterval(timer);
  }, [shareTarget]);

  const handleCreateShareLink = async () => {
    if (!shareTarget) {
      return;
    }

    const expiresInDays = Number(shareExpiresInDays) || 7;
    const maxUses = shareMaxUses.trim() === '' ? null : Number(shareMaxUses);
    setIsShareLoading(true);
    setShareError(null);

    try {
      const link = await toastPromise(gamesApi.createShareLink(shareTarget.id, {
        role: 'purchaser',
        expires_in_days: expiresInDays,
        max_uses: maxUses,
      }), {
        loading: 'Creating share link...',
        success: 'Share link created.',
        error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          'Failed to create share link.',
      });
      setGeneratedShareLink(link);
      setShareLinks((prev) => visibleShareLinks([link, ...prev]));
    } catch (err) {
      setShareError((err as Error)?.message || 'Unable to create share link.');
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleCopyShareLink = async (url?: string) => {
    if (!url) {
      toast({ title: 'Copy failed', description: 'No share link is available to copy.', variant: 'destructive' });
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        let copyEventHandled = false;
        const handleCopy = (event: ClipboardEvent) => {
          event.preventDefault();
          event.clipboardData?.setData('text/plain', url);
          copyEventHandled = true;
        };
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '1px';
        textarea.style.height = '1px';
        textarea.style.padding = '0';
        textarea.style.border = '0';
        textarea.style.opacity = '0.01';
        const container = shareDialogBodyRef.current ?? document.body;
        container.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        document.addEventListener('copy', handleCopy);
        const copied = document.execCommand('copy');
        document.removeEventListener('copy', handleCopy);
        container.removeChild(textarea);

        if (!copied || !copyEventHandled) {
          throw new Error('Copy command failed');
        }
      }
      toast({ title: 'Copied', description: 'Share link copied to clipboard.', variant: 'success' });
    } catch {
      toast({ title: 'Copy failed', description: 'Select the link and copy it manually.', variant: 'destructive' });
    }
  };

  const handleRevokeShareLink = async (link: GameShareLink) => {
    if (!shareTarget) {
      return;
    }

    setIsShareLoading(true);
    setShareError(null);
    try {
      await toastPromise(gamesApi.revokeShareLink(shareTarget.id, link.id), {
        loading: 'Revoking share link...',
        success: 'Share link revoked.',
        error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          'Failed to revoke share link.',
      });
      setShareLinks((prev) => prev.filter((shareLink) => shareLink.id !== link.id));
      if (generatedShareLink?.id === link.id) {
        setGeneratedShareLink(null);
      }
    } catch (err) {
      setShareError((err as Error)?.message || 'Unable to revoke share link.');
    } finally {
      setIsShareLoading(false);
    }
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
        await toastPromise(gamesApi.create({
          owner_user_id: get_userId(),
          game_name: form.game_name.trim(),
          game_summary: form.game_summary.trim() || undefined,
          visibility: form.visibility,
        }), {
          loading: "Creating game...",
          success: "Game created successfully.",
          error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          "Failed to create game.",
        });
      } else if (activeGame) {
        await toastPromise(gamesApi.patch(activeGame.id, {
          game_name: form.game_name.trim(),
          game_summary: form.game_summary.trim() || undefined,
          visibility: form.visibility,
        }), {
          loading: "Updating game...",
          success: "Game updated successfully.",
          error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          "Failed to update game."
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
      await toastPromise(gamesApi.delete(deleteTarget.id), {
        loading: "Deleting game...",
        success: "Game deleted successfully.",
        error: (e) =>
      (e as any)?.response?.data?.detail ||
      (e as Error)?.message ||
      "Failed to delete game.",
      });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await loadGames();
    } catch (err) {
    }
  
  };
  if (isPackWorkspaceOpen) {
    return (
      <GamePackWorkspace
        mode="creator"
        initialGameId={packWorkspaceGameId}
        getPackResumeState={getSavedCreatorPackState}
        onPackResumeStateChange={setSavedCreatorPackState}
        onBack={() => {
          setIsPackWorkspaceOpen(false);
          setPackWorkspaceGameId(null);
        }}
      />
    );
  }

  if (previewTarget) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Preview {previewTarget.game_name} rules</h2>
              <p className="text-sm text-muted-foreground">
                Review this game's rules across selected content packs.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setPreviewTarget(null)} className="min-h-[44px] sm:w-auto">
              <Eye className="h-4 w-4 shrink-0" />
              Back to Games
            </Button>
          </div>
          <Separator />
          <GameRulesRenderer
            gameId={previewTarget.id}
            mode="full"
            visibility="gm"
            packMode="multi"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Creator Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Manage games you can edit or own, then jump into pack workspaces for editable or purchased games.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPackWorkspaceGameId(null);
                setIsPackWorkspaceOpen(true);
              }}
              className="min-h-[44px]"
            >
              <BookOpen className="h-4 w-4" />
              Pack Workspace
            </Button>
            <Button
              onClick={openCreateDialog}
              className="min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              Make Game
            </Button>
          </div>
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
          <div ref={shareDialogBodyRef} className="relative space-y-4">
            {games.map((game) => (
              <Card key={game.id} className="border-border">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="pt-2">
                     <div className="flex items-start justify-between gap-2">
                      <CardTitle className="min-w-0 flex-1 break-words text-base font-semibold">
                        {game.game_name}
                      </CardTitle>

                      <div className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                         {game.visibility}
                        </div>
                      </div>

                      <CardDescription className="mt-2">
                        {game.game_summary || 'No summary available.'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPackWorkspaceGameId(game.id);
                          setIsPackWorkspaceOpen(true);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Packs
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPreviewTarget(game)}>
                        <BookOpen className="h-3.5 w-3.5" />
                        Preview
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openShareDialog(game)}>
                        <Link2 className="h-3.5 w-3.5" />
                        Share
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
      <Dialog open={Boolean(shareTarget)} onOpenChange={(open) => {
        if (!open) {
          closeShareDialog();
        }
      }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="pr-8 leading-6 break-words">Share {shareTarget?.game_name}</DialogTitle>
            <DialogDescription>
              Create a link that adds this game to a friend's library.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="share-expires">Expires in days</Label>
                <Input
                  id="share-expires"
                  min="1"
                  max="90"
                  type="number"
                  value={shareExpiresInDays}
                  onChange={(event) => setShareExpiresInDays(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="share-max-uses">Max uses</Label>
                <Input
                  id="share-max-uses"
                  min="1"
                  type="number"
                  value={shareMaxUses}
                  onChange={(event) => setShareMaxUses(event.target.value)}
                />
              </div>
            </div>

            <Button type="button" onClick={handleCreateShareLink} disabled={isShareLoading} className="w-full sm:w-auto">
              <Link2 className="h-4 w-4" />
              Generate Link
            </Button>

            {generatedShareLink?.url ? (
              <div className="grid gap-2 rounded-md border border-border bg-background p-3">
                <Label htmlFor="generated-share-link">Share link</Label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    id="generated-share-link"
                    className="min-w-0 text-xs sm:text-sm"
                    readOnly
                    value={generatedShareLink.url}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => handleCopyShareLink(generatedShareLink.url)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
            ) : null}

            {shareError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {shareError}
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Existing links</h3>
              {isShareLoading && shareLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading links...</p>
              ) : shareLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No share links yet.</p>
              ) : (
                <div className="space-y-2">
                  {shareLinks.map((link) => (
                    <div key={link.id} className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0 text-sm">
                        <p className="break-all font-medium leading-5 sm:truncate">{link.url}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {link.uses_count}/{link.max_uses ?? 'unlimited'} uses · expires {new Date(link.expires_at).toLocaleDateString()}
                          {link.revoked_at ? ' · revoked' : ''}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => handleCopyShareLink(link.url)}>
                          Copy
                        </Button>
                        {!link.revoked_at ? (
                          <Button type="button" variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => handleRevokeShareLink(link)}>
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={closeShareDialog}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
