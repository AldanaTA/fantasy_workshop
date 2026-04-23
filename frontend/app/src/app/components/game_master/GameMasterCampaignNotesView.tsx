import { useEffect, useState, type FormEvent } from 'react';
import { ArchiveRestore, History, PencilLine, Plus, Trash2 } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import type { Campaign, CampaignNote, CampaignNoteRevision } from '../../api/models';
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
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/toastProvider';
import { GameMasterViewFrame } from './GameMasterViewFrame';

type Props = {
  campaign: Campaign;
  onBack?: () => void;
  embedded?: boolean;
};

type NoteFormState = {
  title: string;
  bodyText: string;
  visibility: 'gm' | 'shared';
};

const emptyForm: NoteFormState = {
  title: '',
  bodyText: '',
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

  const handleSelectNote = async (note: CampaignNote) => {
    setActiveNote(note);
    setForm({
      title: note.title,
      bodyText: extractNoteText(note.body),
      visibility: note.visibility === 'shared' ? 'shared' : 'gm',
    });
    await loadRevisions(note);
  };

  const handleCreate = () => {
    setActiveNote(null);
    setRevisions([]);
    setForm(emptyForm);
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
            body: buildNoteBody(form.bodyText),
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
            body: buildNoteBody(form.bodyText),
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
    } catch (err) {
      setError((err as Error)?.message || 'Unable to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!activeNote) return;
    try {
      await toastPromise(
        campaignsApi.deleteNote(campaign.id, activeNote.id),
        {
          loading: 'Archiving note...',
          success: 'Note archived.',
          error: (e) => (e as Error)?.message || 'Failed to archive note.',
        },
      );
      handleCreate();
      await loadNotes();
    } catch (err) {
      setError((err as Error)?.message || 'Unable to archive note.');
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
      <div className="grid grid-cols-2 gap-2 sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <Button type="button" variant="outline" onClick={handleCreate} size="sm">
          <Plus className="h-3.5 w-3.5" />
          New Note
        </Button>
        <Button type="button" variant={showArchived ? 'secondary' : 'outline'} size="sm" onClick={() => setShowArchived((prev) => !prev)}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
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
              <Card key={note.id} className={note.id === activeNote?.id ? 'border-primary' : 'border-border'}>
                <CardContent className="space-y-3">
                  <div>
                    <CardTitle className="text-base">{note.title}</CardTitle>
                    <CardDescription>
                      {note.visibility} note · v{note.version_num}
                      {note.archived_at ? ' · archived' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleSelectNote(note)}>
                      <PencilLine className="h-3.5 w-3.5" />
                      {note.archived_at ? 'View' : 'Edit'}
                    </Button>
                    {note.archived_at ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleRestore(note)}>
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <form className="space-y-4 rounded-2xl border border-border bg-background p-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="gm-note-title">Title</Label>
              <Input
                id="gm-note-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Frontier shrine clues"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gm-note-visibility">Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(value: 'gm' | 'shared') => setForm((prev) => ({ ...prev, visibility: value }))}
                disabled={Boolean(activeNote?.archived_at)}
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
              <Textarea
                id="gm-note-body"
                className="min-h-[220px]"
                value={form.bodyText}
                onChange={(event) => setForm((prev) => ({ ...prev, bodyText: event.target.value }))}
                disabled={Boolean(activeNote?.archived_at)}
              />
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="min-h-[44px] sm:w-auto" disabled={isSaving || Boolean(activeNote?.archived_at)}>
                {activeNote ? 'Save Note' : 'Create Note'}
              </Button>
              {activeNote && !activeNote.archived_at ? (
                <Button type="button" variant="destructive" className="min-h-[44px] sm:w-auto" onClick={() => void handleArchive()}>
                  <Trash2 className="h-4 w-4" />
                  Archive
                </Button>
              ) : null}
            </div>
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
        </div>
      </div>
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
        <Button type="button" variant="outline" onClick={handleCreate} className="min-h-[44px]">
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      )}
    >
      {content}
    </GameMasterViewFrame>
  );
}

function buildNoteBody(text: string) {
  return {
    type: 'doc',
    content: text.trim()
      ? [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ]
      : [],
  };
}

function extractNoteText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const content = (body as { content?: Array<{ content?: Array<{ text?: string }> }> }).content;
  if (!Array.isArray(content)) return '';
  return content
    .flatMap((block) => (Array.isArray(block.content) ? block.content : []))
    .map((node) => node.text ?? '')
    .join('');
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
