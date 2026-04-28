import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArchiveRestore, Eye, Link2, PencilLine, Plus, Search, Trash2, X } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import { contentApi } from '../../api/contentApi';
import { contentCategoriesApi } from '../../api/contentCategoriesApi';
import { contentPacksApi } from '../../api/contentPacksApi';
import type { Campaign, CampaignNote } from '../../api/models';
import type { Content, ContentVersion } from '../../api/models';
import type { CampaignNoteDocument, CampaignNoteLinkedRule } from '../../types/campaignNotes';
import { CampaignNoteEditor } from '../content/CampaignNoteEditor';
import { CampaignNoteRenderer } from '../content/CampaignNoteRenderer';
import { ContentRender } from '../content/ContentRender';
import {
  createEmptyCampaignNoteDocument,
  getCampaignNotePlainText,
  normalizeCampaignNoteBody,
} from '../content/campaignNoteDocument';
import { Badge } from '../ui/badge';
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

type LinkableRuleOption = {
  content: Content;
  packName: string;
  categoryName: string;
  activeVersion?: ContentVersion;
};

type ResolvedLinkedRule = {
  link: CampaignNoteLinkedRule;
  content?: Content;
  version?: ContentVersion;
  defaultActiveVersion?: ContentVersion;
  error?: string;
};

const emptyForm: NoteFormState = {
  title: '',
  body: createEmptyCampaignNoteDocument(),
  visibility: 'gm',
};

export function GameMasterCampaignNotesView({ campaign, onBack, embedded = false }: Props) {
  const { toast, toastPromise } = useToast();
  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [activeNote, setActiveNote] = useState<CampaignNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NoteFormState>(emptyForm);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | 'view'>('create');
  const [isLinkPickerOpen, setIsLinkPickerOpen] = useState(false);
  const [isLoadingLinkableRules, setIsLoadingLinkableRules] = useState(false);
  const [linkableRules, setLinkableRules] = useState<LinkableRuleOption[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [resolvedLinkedRules, setResolvedLinkedRules] = useState<Record<string, ResolvedLinkedRule>>({});
  const [previewLinkedRuleId, setPreviewLinkedRuleId] = useState<string | null>(null);

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

  const linkedRules = form.body.linked_rules ?? [];

  const filteredLinkableRules = useMemo(() => {
    const search = linkSearch.trim().toLowerCase();
    if (!search) {
      return linkableRules;
    }

    return linkableRules.filter((rule) => (
      rule.content.name.toLowerCase().includes(search)
      || (rule.content.summary ?? '').toLowerCase().includes(search)
      || rule.packName.toLowerCase().includes(search)
      || rule.categoryName.toLowerCase().includes(search)
      || (rule.activeVersion?.fields as { content_type?: string } | undefined)?.content_type?.toLowerCase().includes(search)
    ));
  }, [linkSearch, linkableRules]);

  const previewLinkedRule = previewLinkedRuleId ? resolvedLinkedRules[previewLinkedRuleId] : null;

  const openLinkPicker = async () => {
    setIsLinkPickerOpen(true);
    setLinkSearch('');

    if (linkableRules.length) {
      return;
    }

    setIsLoadingLinkableRules(true);
    try {
      const allowed = await campaignsApi.listAllowedPacks(campaign.id);
      if (!allowed.length) {
        setLinkableRules([]);
        return;
      }

      const allGamePacks = await contentPacksApi.listByGame(campaign.game_id, 100, 0);
      const allowedPackIds = new Set(allowed.map((pack) => pack.pack_id));
      const allowedPacks = allGamePacks.filter((pack) => allowedPackIds.has(pack.id));

      const packEntries = await Promise.all(
        allowedPacks.map(async (pack) => {
          const categories = await contentCategoriesApi.listByPack(pack.id, 100, 0);
          const contentRows = await Promise.all(
            categories.map(async (category) => ({
              category,
              rows: await contentApi.listByCategoryWithActive(category.id, 100, 0, true),
            })),
          );

          return { pack, contentRows };
        }),
      );

      const deduped = new Map<string, LinkableRuleOption>();
      for (const entry of packEntries) {
        for (const { category, rows } of entry.contentRows) {
          for (const row of rows) {
            if (!deduped.has(row.content.id)) {
              deduped.set(row.content.id, {
                content: row.content,
                packName: entry.pack.pack_name,
                categoryName: category.name,
                activeVersion: row.active_version ?? undefined,
              });
            }
          }
        }
      }

      setLinkableRules([...deduped.values()].sort((a, b) => a.content.name.localeCompare(b.content.name)));
    } catch (err) {
      toast({
        title: 'Unable to load rules',
        description: (err as Error)?.message || 'Rules could not be loaded for note linking.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingLinkableRules(false);
    }
  };

  const attachLinkedRule = (rule: LinkableRuleOption, linkMode: 'live' | 'snapshot') => {
    if (linkedRules.some((link) => link.content_id === rule.content.id && link.link_mode === linkMode)) {
      toast({
        title: 'Rule already linked',
        description: 'That rule is already attached to this note in the same mode.',
        variant: 'destructive',
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      body: {
        ...prev.body,
        linked_rules: [
          ...(prev.body.linked_rules ?? []),
          {
            content_id: rule.content.id,
            label: null,
            link_mode: linkMode,
            pinned_version_num: linkMode === 'snapshot' ? (rule.activeVersion?.version_num ?? null) : null,
          },
        ],
      },
    }));
  };

  const removeLinkedRule = (contentId: string, linkMode: 'live' | 'snapshot') => {
    setForm((prev) => ({
      ...prev,
      body: {
        ...prev.body,
        linked_rules: (prev.body.linked_rules ?? []).filter((link) => !(link.content_id === contentId && link.link_mode === linkMode)),
      },
    }));
  };

  useEffect(() => {
    if (!isEditorOpen || !linkedRules.length) {
      setResolvedLinkedRules({});
      return;
    }

    let cancelled = false;

    const loadLinkedRuleDetails = async () => {
      const pins = await campaignsApi.listPins(campaign.id).catch(() => []);
      const pinMap = new Map(pins.map((pin) => [pin.content_id, pin.pinned_version_num]));

      const results = await Promise.all(
        linkedRules.map(async (link) => {
          try {
            const content = await contentApi.get(link.content_id);
            const defaultActiveVersion = await contentApi.getActive(link.content_id).catch(() => undefined);
            const version =
              link.link_mode === 'snapshot' && link.pinned_version_num
                ? await contentApi.getVersion(link.content_id, link.pinned_version_num).catch(() => undefined)
                : pinMap.has(link.content_id)
                  ? await contentApi.getVersion(link.content_id, pinMap.get(link.content_id) as number).catch(() => defaultActiveVersion)
                  : defaultActiveVersion;

            return [buildLinkedRuleKey(link), { link, content, version, defaultActiveVersion }] as const;
          } catch (err) {
            return [buildLinkedRuleKey(link), { link, error: (err as Error)?.message || 'Unable to load linked rule.' }] as const;
          }
        }),
      );

      if (cancelled) return;
      setResolvedLinkedRules(Object.fromEntries(results));
    };

    void loadLinkedRuleDetails();

    return () => {
      cancelled = true;
    };
  }, [campaign.id, isEditorOpen, linkedRules]);

  const openCreateDialog = () => {
    setEditorMode('create');
    setActiveNote(null);
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
  };

  const closeEditor = (open: boolean) => {
    setIsEditorOpen(open);
    if (!open) {
      setError(null);
      setForm(emptyForm);
      setActiveNote(null);
      setIsLinkPickerOpen(false);
      setPreviewLinkedRuleId(null);
      setResolvedLinkedRules({});
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
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-3 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-2xl sm:p-6">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>
              {editorMode === 'create' ? 'Create Note' : editorMode === 'view' ? 'View Note' : 'Edit Note'}
            </DialogTitle>
            <DialogDescription>
              Format campaign notes with a reusable lightweight editor that can be shared with future player-facing note workflows.
            </DialogDescription>
            {activeNote ? (
              <p className="text-xs text-muted-foreground">
                Last updated {formatDateTime(activeNote.updated_at)}
              </p>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
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
                  <div className="max-h-[50dvh] overflow-y-auto rounded-2xl border border-input bg-input-background px-4 py-4 sm:max-h-none">
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

              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label>Linked Rules</Label>
                    <p className="text-xs text-muted-foreground">
                      Attach creatures, spells, items, or other rules so they are easy to open from this note.
                    </p>
                  </div>
                  {editorMode !== 'view' && !activeNote?.archived_at ? (
                    <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => void openLinkPicker()}>
                      <Link2 className="h-4 w-4" />
                      Attach Rule
                    </Button>
                  ) : null}
                </div>

                {linkedRules.length ? (
                  <div className="space-y-3">
                    {linkedRules.map((link) => {
                      const key = buildLinkedRuleKey(link);
                      const resolved = resolvedLinkedRules[key];
                      const contentName = resolved?.content?.name ?? link.label ?? 'Linked rule';
                      const effectiveVersionNum = resolved?.version?.version_num ?? link.pinned_version_num ?? null;
                      return (
                        <div key={key} className="rounded-2xl border border-border bg-background p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="break-words text-sm font-medium">{contentName}</p>
                                <Badge variant="outline">{link.link_mode === 'live' ? 'Table Version' : 'Snapshot'}</Badge>
                                {effectiveVersionNum ? (
                                  <Badge variant="secondary">v{effectiveVersionNum}</Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {resolved?.error
                                  ? resolved.error
                                  : link.link_mode === 'live'
                                    ? 'Follows the campaign rule version currently in effect.'
                                    : 'Locked to the version selected when this rule was attached.'}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewLinkedRuleId(key)}
                                disabled={!resolved?.version}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                              {editorMode !== 'view' && !activeNote?.archived_at ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLinkedRule(link.content_id, link.link_mode)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Remove
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground">
                    No linked rules yet.
                  </div>
                )}
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <DialogFooter className="sticky bottom-0 bg-background pt-2">
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLinkPickerOpen} onOpenChange={setIsLinkPickerOpen}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-3 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:p-6">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>Attach Rule</DialogTitle>
            <DialogDescription>
              Search the campaign&apos;s allowed packs and attach a rule to this note.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={linkSearch}
                onChange={(event) => setLinkSearch(event.target.value)}
                placeholder="Search rules, packs, categories, or types"
                className="pl-9"
              />
            </div>

            {isLoadingLinkableRules ? (
              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                Loading available rules...
              </div>
            ) : filteredLinkableRules.length === 0 ? (
              <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                No matching rules found in the campaign&apos;s allowed packs.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLinkableRules.map((rule) => {
                  const contentType = (rule.activeVersion?.fields as { content_type?: string } | undefined)?.content_type;
                  const alreadyLinkedLive = linkedRules.some((link) => link.content_id === rule.content.id && link.link_mode === 'live');
                  const alreadyLinkedSnapshot = linkedRules.some((link) => link.content_id === rule.content.id && link.link_mode === 'snapshot');
                  return (
                    <div key={rule.content.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words text-sm font-medium">{rule.content.name}</p>
                            {contentType ? <Badge variant="outline">{contentType}</Badge> : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {rule.packName} · {rule.categoryName}
                            {rule.content.summary ? ` · ${rule.content.summary}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={alreadyLinkedLive}
                            onClick={() => attachLinkedRule(rule, 'live')}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            {alreadyLinkedLive ? 'Linked Live' : 'Use Table Version'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={alreadyLinkedSnapshot || !rule.activeVersion}
                            onClick={() => attachLinkedRule(rule, 'snapshot')}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {alreadyLinkedSnapshot ? 'Locked' : rule.activeVersion ? `Lock v${rule.activeVersion.version_num}` : 'No Active Version'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewLinkedRule)} onOpenChange={(open) => setPreviewLinkedRuleId(open ? previewLinkedRuleId : null)}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-3 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl sm:p-6">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{previewLinkedRule?.content?.name ?? 'Linked Rule'}</DialogTitle>
            <DialogDescription>
              {previewLinkedRule?.link.link_mode === 'live'
                ? 'This preview follows the campaign rule version currently in effect.'
                : `This preview is locked to v${previewLinkedRule?.link.pinned_version_num ?? previewLinkedRule?.version?.version_num ?? ''}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {previewLinkedRule?.version ? (
              <ContentRender
                fields={previewLinkedRule.version.fields}
                contentName={previewLinkedRule.content?.name}
                summary={previewLinkedRule.content?.summary}
                mode="full"
                visibility="gm"
              />
            ) : (
              <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                {previewLinkedRule?.error || 'This linked rule could not be loaded.'}
              </div>
            )}
          </div>
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

function buildLinkedRuleKey(link: CampaignNoteLinkedRule) {
  return `${link.content_id}:${link.link_mode}:${link.pinned_version_num ?? 'live'}`;
}
