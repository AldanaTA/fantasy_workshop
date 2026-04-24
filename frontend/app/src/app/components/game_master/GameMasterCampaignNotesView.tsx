import { useEffect, useState, type FormEvent } from 'react';
import { ArchiveRestore, History, PencilLine, Plus, Trash2 } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import type { Campaign, CampaignNote, CampaignNoteRevision } from '../../api/models';
import type { CampaignNoteDocument } from '../../types/campaignNotes';
import { CampaignNoteEditor } from '../content/CampaignNoteEditor';
import { CampaignNoteRenderer } from '../content/CampaignNoteRenderer';
import {
  createEmptyCampaignNoteDocument,
  getCampaignNotePlainText,
  normalizeCampaignNoteBody,
} from '../content/campaignNoteDocument';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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
  onBack?: () => void;
  embedded?: boolean;
};

type NoteFormState = {
  title: string;
  body: CampaignNoteDocument;
  visibility: 'gm' | 'shared';
};

const emptyForm: NoteFormState = {
  title: '',
  body: createEmptyCampaignNoteDocument(),
  visibility: 'gm',
};

export function GameMasterCampaignNotesView({ campaign, onBack, embedded = false }: Props) {
  const { toastPromise } = useToast();
  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [activeNote, setActiveNote] = useState<CampaignNote | null>(null);
  const [revisions, setRevisions] = useState<CampaignNoteRevision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NoteFormState>(emptyForm);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | 'view'>('create');

  const loadNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextNotes = await campaignsApi.listNotes(campaign.id, {
        includeArchived: showArchived,
        visibility: 'all',
        limit: 100,
      });
      setNotes(nextNotes);
      if (activeNote) {
        const fresh = nextNotes.find((note) => note.id === activeNote.id) ?? null;
        setActiveNote(fresh);
      }
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load notes.');
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, [campaign.id, showArchived]);

  const loadRevisions = async (note: CampaignNote) => {
    try {
      setRevisions(await campaignsApi.listNoteRevisions(campaign.id, note.id));
    } catch {
      setRevisions([]);
    }
  };

  const openCreateDialog = () => {
    setEditorMode('create');
    setActiveNote(null);
    setRevisions([]);
    setForm(emptyForm);
    setError(null);
    setIsEditorOpen(true);
  };

  const openEditDialog = async (note: CampaignNote) => {
    setEditorMode('edit');
    setActiveNote(note);
    setForm({
      title: note.title,
      body: normalizeCampaignNoteBody(note.body),
      visibility: note.visibility === 'shared' ? 'shared' : 'gm',
    });
    setError(null);
    setIsEditorOpen(true);
    await loadRevisions(note);
  };

  const openViewDialog = async (note: CampaignNote) => {
    setEditorMode('view');
    setActiveNote(note);
    setForm({
      title: note.title,
      body: normalizeCampaignNoteBody(note.body),
      visibility: note.visibility === 'shared' ? 'shared' : 'gm',
    });
    setError(null);
    setIsEditorOpen(true);
    await loadRevisions(note);
  };

  const closeEditor = (open: boolean) => {
    setIsEditorOpen(open);
    if (!open) {
      setError(null);
      setForm(emptyForm);
      setActiveNote(null);
      setRevisions([]);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('A note title is required.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      if (activeNote) {
        await toastPromise(
          campaignsApi.patchNote(campaign.id, activeNote.id, {
            title: form.title.trim(),
            body: form.body,
            visibility: form.visibility,
            expected_version_num: activeNote.version_num,
          }),
          {
            loading: 'Saving note...',
            success: 'Note updated.',
            error: (e) => (e as Error)?.message || 'Failed to update note.',
          },
        );
      } else {
        await toastPromise(
          campaignsApi.createNote(campaign.id, {
            title: form.title.trim(),
            body: form.body,
            visibility: form.visibility,
          }),
          {
            loading: 'Creating note...',
            success: 'Note created.',
            error: (e) => (e as Error)?.message || 'Failed to create note.',
          },
        );
      }
      await loadNotes();
      closeEditor(false);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  const archiveNote = async (note: CampaignNote, options?: { closeEditor?: boolean }) => {
    try {
      await toastPromise(
        campaignsApi.deleteNote(campaign.id, note.id),
        {
          loading: 'Archiving note...',
          success: 'Note archived.',
          error: (e) => (e as Error)?.message || 'Failed to archive note.',
        },
      );
      if (options?.closeEditor) {
        closeEditor(false);
      }
      await loadNotes();
    } catch (err) {
      setError((err as Error)?.message || 'Unable to archive note.');
    }
  };

  const handleArchive = async () => {
    if (!activeNote) return;
    await archiveNote(activeNote, { closeEditor: true });
  };

  const handleDelete = async (note: CampaignNote) => {
    try {
      await toastPromise(
        campaignsApi.deleteNote(campaign.id, note.id),
        {
          loading: 'Deleting note...',
          success: 'Note deleted.',
          error: (e) => (e as Error)?.message || 'Failed to delete note.',
        },
      );
      if (activeNote?.id === note.id) {
        closeEditor(false);
      }
      await loadNotes();
    } catch (err) {
      setError((err as Error)?.message || 'Unable to delete note.');
    }
  };

  const handleRestore = async (note: CampaignNote) => {
    try {
      await toastPromise(
        campaignsApi.restoreNote(campaign.id, note.id),
        {
          loading: 'Restoring note...',
          success: 'Note restored.',
          error: (e) => (e as Error)?.message || 'Failed to restore note.',
        },
      );
      await loadNotes();
    } catch (err) {
      setError((err as Error)?.message || 'Unable to restore note.');
    }
  };

  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={openCreateDialog} size="sm" className="min-h-[44px] sm:w-auto">
          <Plus className="h-3.5 w-3.5" />
          Make Note
        </Button>
        <Button
          type="button"
          variant={showArchived ? 'secondary' : 'outline'}
          size="sm"
          className="min-h-[44px] sm:w-auto"
          onClick={() => setShowArchived((prev) => !prev)}
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      <div className="space-y-4 pt-5 sm:pt-6">
        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            No notes found for this campaign.
          </div>
        ) : (
          notes.map((note) => (
            <Card key={note.id} className="border-border">
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="break-words text-base">{note.title}</CardTitle>
                    <CardDescription>
                      {note.visibility} note · v{note.version_num}
                      {note.archived_at ? ' · archived' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void openViewDialog(note)}>
                      <PencilLine className="h-3.5 w-3.5" />
                      View
                    </Button>
                    {note.archived_at ? (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleRestore(note)}>
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          Restore
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => void handleDelete(note)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="secondary" size="sm" onClick={() => void openEditDialog(note)}>
                          <PencilLine className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => void archiveNote(note)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Archive
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={closeEditor}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editorMode === 'create' ? 'Create Note' : editorMode === 'view' ? 'View Note' : 'Edit Note'}
            </DialogTitle>
            <DialogDescription>
              Format campaign notes with a reusable lightweight editor that can be shared with future player-facing note workflows.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="gm-note-title">Title</Label>
              <Input
                id="gm-note-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Frontier shrine clues"
                disabled={editorMode === 'view' || Boolean(activeNote?.archived_at)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gm-note-visibility">Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(value: 'gm' | 'shared') => setForm((prev) => ({ ...prev, visibility: value }))}
                disabled={editorMode === 'view' || Boolean(activeNote?.archived_at)}
              >
                <SelectTrigger id="gm-note-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gm">GM Only</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gm-note-body">Body</Label>
              {editorMode === 'view' || activeNote?.archived_at ? (
                <div className="rounded-2xl border border-input bg-input-background px-4 py-4">
                  <CampaignNoteRenderer
                    body={form.body}
                    emptyState={<p className="text-sm text-muted-foreground">This note is empty.</p>}
                  />
                </div>
              ) : (
                <CampaignNoteEditor
                  id="gm-note-body"
                  value={form.body}
                  onChange={(body) => setForm((prev) => ({ ...prev, body }))}
                  helperText="Notes now use a structured document model that is shared by editing and read-only rendering."
                />
              )}
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <DialogFooter>
              {activeNote && editorMode !== 'view' && !activeNote.archived_at ? (
                <Button type="button" variant="destructive" className="min-h-[44px] sm:w-auto" onClick={() => void handleArchive()}>
                  <Trash2 className="h-4 w-4" />
                  Archive
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="min-h-[44px] sm:w-auto" onClick={() => closeEditor(false)}>
                {editorMode === 'view' ? 'Close' : 'Cancel'}
              </Button>
              {editorMode !== 'view' && !activeNote?.archived_at ? (
                <Button type="submit" className="min-h-[44px] sm:w-auto" disabled={isSaving}>
                  {activeNote ? 'Save Note' : 'Create Note'}
                </Button>
              ) : null}
            </DialogFooter>
          </form>

          {activeNote && revisions.length > 0 ? (
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" />
                Revision History
              </div>
              <div className="space-y-2">
                {revisions.map((revision) => (
                  <div key={`${revision.note_id}-${revision.version_num}`} className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">
                    v{revision.version_num} · {formatDateTime(revision.created_at)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <GameMasterViewFrame
      title={`Campaign Notes for ${campaign.name}`}
      description="Write GM or shared notes in a dedicated mode without stacking the rest of the campaign tools on the page."
      onBack={onBack}
      actions={(
        <Button type="button" variant="outline" onClick={openCreateDialog} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          Make Note
        </Button>
      )}
    >
      {content}
    </GameMasterViewFrame>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
