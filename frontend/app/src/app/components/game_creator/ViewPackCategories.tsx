import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
import { ChevronDown, ChevronUp, Edit3, Plus, CircleArrowLeft, Trash2 } from 'lucide-react';
import { Content, ContentCategory, ContentCategorySchemaDefinition, ContentPack } from '../../api/models';
import { contentCategoriesApi, invalidateContentCategoriesByPack } from '../../api/contentCategoriesApi';
import { contentApi, invalidateContentCategoryCaches } from '../../api/contentApi';
import { useToast } from '../ui/toastProvider';
import { ContentMaker } from './contentMaker';

interface FormState {
  name: string;
  kind: 'generic' | 'character_sheet';
  schemaText: string;
}
const emptyForm: FormState = {
  name: '',
  kind: 'generic',
  schemaText: JSON.stringify(defaultSchemaDefinition('generic'), null, 2),
};

type CategoryContentState = {
  items: Content[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
};

type ContentViewTarget = {
  content: Content;
  category: ContentCategory;
};

type ContentMakerTarget = {
  category: ContentCategory;
  content?: Content;
};

type Props = {
  pack: ContentPack;
  initialExpandedCategoryId?: string | null;
  onResumeStateChange?: (expandedCategoryId: string | null) => void;
  onBackToPacks?: () => void;
  showBackButton?: boolean;
  onGoBack?: () => void;
  backButtonLabel?: string;
  backButtonShortLabel?: string;
};

export function ViewPackCategories({
  pack,
  initialExpandedCategoryId = null,
  onResumeStateChange,
  onBackToPacks,
  showBackButton = true,
  onGoBack,
  backButtonLabel = 'Back',
  backButtonShortLabel = 'Back',
}: Props) {
  const [contentCategories, setContentCategories] = useState<ContentCategory[]>([]);
  const [isloading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [activeCategory, setActiveCategory] = useState<ContentCategory | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ContentCategory | null>(null);
  const [deleteContentTarget, setDeleteContentTarget] = useState<ContentViewTarget | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isContentDeleteOpen, setIsContentDeleteOpen] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [contentMakerTarget, setContentMakerTarget] = useState<ContentMakerTarget | null>(null);
  const [categoryContent, setCategoryContent] = useState<Record<string, CategoryContentState>>({});
  const [isOrderDirty, setIsOrderDirty] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const categoryContentController = useRef<AbortController | null>(null);
  const {toastPromise} = useToast();

  const loadPacks = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const contentCategories = await contentCategoriesApi.listByPack(pack.id, 100, 0, { signal });
      setContentCategories(contentCategories);
      setIsOrderDirty(false);
    } catch (err) {
      if (isAbortError(err)) return;
      setError((err as Error)?.message || 'Unable to load content categories.');
      setContentCategories([]);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  };

  const loadCategoryContent = async (categoryId: string, force = false) => {
    const existing = categoryContent[categoryId];
    if (existing?.hasLoaded && !force) return;

    categoryContentController.current?.abort();
    const controller = new AbortController();
    categoryContentController.current = controller;

    setCategoryContent((prev) => ({
      [categoryId]: {
        items: prev[categoryId]?.items ?? [],
        isLoading: true,
        error: null,
        hasLoaded: prev[categoryId]?.hasLoaded ?? false,
      },
    }));

    try {
      const items = await contentApi.listByCategory(categoryId, 100, 0, { signal: controller.signal });
      setCategoryContent((prev) => ({
        [categoryId]: {
          items,
          isLoading: false,
          error: null,
          hasLoaded: true,
        },
      }));
    } catch (err) {
      if (isAbortError(err)) return;
      setCategoryContent((prev) => ({
        [categoryId]: {
          items: prev[categoryId]?.items ?? [],
          isLoading: false,
          error: (err as Error)?.message || 'Unable to load content.',
          hasLoaded: true,
        },
      }));
    } finally {
      if (categoryContentController.current === controller) {
        categoryContentController.current = null;
      }
    }
  };

  const toggleCategory = async (categoryId: string) => {
    if (expandedCategoryId === categoryId) {
      categoryContentController.current?.abort();
      categoryContentController.current = null;
      setExpandedCategoryId(null);
      setCategoryContent({});
      return;
    }

    setExpandedCategoryId(categoryId);
    setCategoryContent((prev) => (prev[categoryId] ? { [categoryId]: prev[categoryId] } : {}));
    await loadCategoryContent(categoryId);
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadPacks(controller.signal);

    return () => {
      controller.abort();
      categoryContentController.current?.abort();
      categoryContentController.current = null;
    };
  }, [pack.id]);

  useEffect(() => {
    if (isloading || hasRestoredState) {
      return;
    }

    if (!initialExpandedCategoryId || !contentCategories.some((category) => category.id === initialExpandedCategoryId)) {
      setHasRestoredState(true);
      return;
    }

    setExpandedCategoryId(initialExpandedCategoryId);
    void loadCategoryContent(initialExpandedCategoryId);
    setHasRestoredState(true);
  }, [contentCategories, hasRestoredState, initialExpandedCategoryId, isloading]);

  useEffect(() => {
    if (!hasRestoredState) {
      return;
    }

    onResumeStateChange?.(expandedCategoryId);
  }, [expandedCategoryId, hasRestoredState, onResumeStateChange]);


  const openCreateDialog = () => {
    setDialogMode('create');
    setForm(emptyForm);
    setActiveCategory(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (contentCategory: ContentCategory) => {
    setDialogMode('edit');
    setActiveCategory(contentCategory);
    setForm({
      name: contentCategory.name,
      kind: contentCategory.kind === 'character_sheet' ? 'character_sheet' : 'generic',
      schemaText: JSON.stringify(contentCategory.active_schema_definition ?? defaultSchemaDefinition(contentCategory.kind === 'character_sheet' ? 'character_sheet' : 'generic'), null, 2),
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setActiveCategory(null);
    setError(null);
  };

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('A content category name is required.');
      return;
    }

    setError(null);

    try {
      const schema_definition = parseSchemaText(form.schemaText);
      validateSchemaDefinition(schema_definition, form.kind);
      if (dialogMode === 'create') {
        await toastPromise(contentCategoriesApi.create({
          pack_id: pack.id,
          name: form.name.trim(),
          kind: form.kind,
          schema_definition,
        }), {
          loading: "Creating content category...",
          success: "Content category created successfully.",
          error: (e) =>
        (e as any)?.response?.data?.detail ||
        (e as Error)?.message ||
        "Failed to create content category."
        });
      } else if (activeCategory) {
        await toastPromise(contentCategoriesApi.patch(activeCategory.id, {
          name: form.name.trim(),
          kind: form.kind,
          schema_definition,
        }), {
          loading: "Updating content category...",
          success: "Content category updated successfully.",
          error: (e) =>
        (e as any)?.response?.data?.detail ||
        (e as Error)?.message ||
        "Failed to update content category."
        });
      }
      closeDialog();
      await loadPacks();
    } catch (err) {
      setError((err as Error)?.message || 'Unable to save content category.');
    }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await toastPromise(contentCategoriesApi.delete(deleteTarget.id), {
        loading: "Deleting content category...",
        success: "Content category deleted successfully.",
        error: (e) =>
        (e as any)?.response?.data?.detail ||
        (e as Error)?.message ||
        "Failed to delete content category."
      });

      invalidateContentCategoriesByPack(pack.id);
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      setExpandedCategoryId((prev) => (prev === deleteTarget.id ? null : prev));
      setCategoryContent((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      await loadPacks();


    } catch (err) {
  
    }
  };

  const handleContentDelete = async () => {
    if (!deleteContentTarget) return;

    try {
      await toastPromise(contentApi.delete(deleteContentTarget.content.id), {
        loading: "Deleting content...",
        success: "Content deleted successfully.",
        error: (e) =>
        (e as any)?.response?.data?.detail ||
        (e as Error)?.message ||
        "Failed to delete content."
      });

      invalidateContentCategoryCaches(deleteContentTarget.category.id);
      setIsContentDeleteOpen(false);
      setDeleteContentTarget(null);
      await loadCategoryContent(deleteContentTarget.category.id, true);
    } catch (err) {
    }
  };

  const moveCategory = (categoryId: string, direction: -1 | 1) => {
    setContentCategories((prev) => {
      const currentIndex = prev.findIndex((category) => category.id === categoryId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
    setIsOrderDirty(true);
  };

  const handleSaveOrder = async () => {
    try {
      const orderedCategories = await toastPromise(
        contentCategoriesApi.reorder(pack.id, contentCategories.map((category) => category.id)),
        {
          loading: "Saving category order...",
          success: "Category Rendering order saved successfully.",
          error: (e) =>
        (e as any)?.response?.data?.detail ||
        (e as Error)?.message ||
        "Failed to save category order."
        }
      );

      setContentCategories(orderedCategories);
      setIsOrderDirty(false);
    } catch (err) {
    }
  };

  if (contentMakerTarget) {
    return (
      <ContentMaker
        pack={pack}
        category={contentMakerTarget.category}
        content={contentMakerTarget.content}
        onCancel={() => setContentMakerTarget(null)}
        onCreated={async () => {
          setExpandedCategoryId(contentMakerTarget.category.id);
          await loadCategoryContent(contentMakerTarget.category.id, true);
          setContentMakerTarget(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">View content categories in {pack.pack_name}</h2>
            <p className="text-sm text-muted-foreground">
              This is where you can view and manage this pack's content categories.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-nowrap sm:items-center">
            <Button onClick={onBackToPacks} className="min-h-[44px] min-w-0 px-2 sm:shrink-0 sm:px-4">
              <CircleArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate sm:hidden">Packs</span>
              <span className="hidden sm:inline">Pack List</span>
            </Button>
            {showBackButton ? (
              <Button onClick={onGoBack} className="min-h-[44px] min-w-0 px-2 sm:shrink-0 sm:px-4">
                <CircleArrowLeft className="h-4 w-4 shrink-0" />
                <span className="truncate sm:hidden">{backButtonShortLabel}</span>
                <span className="hidden sm:inline">{backButtonLabel}</span>
              </Button>
            ) : null}
            <Button onClick={openCreateDialog} className="min-h-[44px] min-w-0 px-2 sm:shrink-0 sm:px-4">
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate sm:hidden">Category</span>
              <span className="hidden sm:inline">Content Category</span>
            </Button>
            {contentCategories.length > 1 ? (
              <Button
                variant="secondary"
                onClick={handleSaveOrder}
                disabled={!isOrderDirty}
                className="min-h-[44px] min-w-0 px-2 sm:shrink-0 sm:px-4"
              >
                <span className="truncate">Save Order</span>
              </Button>
            ) : null}
          </div>
        </div>
        <Separator />
        {isloading ? (
          <p>Loading content categories...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : contentCategories.length === 0 ? (
          <p>No content categories found. Create one to get started!</p>
        ) : (
          <div className="space-y-4">
            {contentCategories.map((category, index) => (
              <Card key={category.id} className="border">
                <CardHeader>
                  <CardTitle>{category.name}</CardTitle>
                  <CardDescription>
                    {category.kind === 'character_sheet' ? 'Character Sheet' : 'Generic'} · Render Order: {index + 1}
                    {category.active_schema_version ? ` · Schema v${category.active_schema_version}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => moveCategory(category.id, -1)}
                      disabled={index === 0}
                      className="min-w-0 px-2 sm:px-3"
                    >
                      <ChevronUp className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="truncate">Up</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => moveCategory(category.id, 1)}
                      disabled={index === contentCategories.length - 1}
                      className="min-w-0 px-2 sm:px-3"
                    >
                      <ChevronDown className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="truncate">Down</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleCategory(category.id)}
                      className="min-w-0 px-2 sm:px-3"
                    >
                      {expandedCategoryId === category.id ? (
                        <ChevronUp className="h-4 w-4 shrink-0 sm:mr-2" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 sm:mr-2" />
                      )}
                      <span className="truncate sm:hidden">
                        {expandedCategoryId === category.id ? 'Hide' : 'View'}
                      </span>
                      <span className="hidden sm:inline">
                        {expandedCategoryId === category.id ? 'Hide Content' : 'View Content'}
                      </span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditDialog(category)}
                      className="min-w-0 px-2 sm:px-3"
                    >
                      <Edit3 className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="truncate">Edit</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {setDeleteTarget(category); setIsDeleteOpen(true);}}
                      className="min-w-0 px-2 sm:px-3"
                    >
                      <Trash2 className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="truncate">Delete</span>
                    </Button>
                  </div>
                  {expandedCategoryId === category.id ? (
                    <div className="rounded-md border border-border p-3">
                      {categoryContent[category.id]?.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading content...</p>
                      ) : categoryContent[category.id]?.error ? (
                        <p className="text-sm text-destructive">{categoryContent[category.id]?.error}</p>
                      ) : categoryContent[category.id]?.items.length ? (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            {categoryContent[category.id].items.map((content) => (
                              <div key={content.id} className="rounded-md border border-border p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="font-medium">{content.name}</p>
                                    {content.summary ? (
                                      <p className="text-sm text-muted-foreground">{content.summary}</p>
                                    ) : null}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setContentMakerTarget({ content, category })}
                                    >
                                      <Edit3 className="h-4 w-4 sm:mr-2" />
                                      <span className="truncate">Edit</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => { setDeleteContentTarget({ content, category }); setIsContentDeleteOpen(true); }}
                                    >
                                      <Trash2 className="h-4 w-4 sm:mr-2" />
                                      <span className="truncate">Delete</span>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setContentMakerTarget({ category })}
                            className="w-full min-h-[44px]"
                          >
                            <Plus className="h-4 w-4" />
                            Add Content
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">No content in this category yet.</p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setContentMakerTarget({ category })}
                            className="w-full min-h-[44px]"
                          >
                            <Plus className="h-4 w-4" />
                            Add Content
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Create Content Category' : 'Edit Content Category'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Add a new content category to your game.'
                : 'Update the content category details and save your changes.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleDialogSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="category_name">Name</Label>
              <Input
                id="category_name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="My Adventure System"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category_kind">Kind</Label>
              <select
                id="category_kind"
                value={form.kind}
                onChange={(event) => setForm((prev) => {
                  const nextKind = event.target.value === 'character_sheet' ? 'character_sheet' : 'generic';
                  const currentSchema = safeParseSchemaText(prev.schemaText);
                  const nextSchema = currentSchema ?? defaultSchemaDefinition(nextKind);
                  return {
                    ...prev,
                    kind: nextKind,
                    schemaText: JSON.stringify(nextSchema, null, 2),
                  };
                })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="generic">Generic</option>
                <option value="character_sheet">Character Sheet</option>
              </select>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="category_schema">Schema Definition</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      schemaText: JSON.stringify(defaultSchemaDefinition(prev.kind), null, 2),
                    }))}
                  >
                    Reset Template
                  </Button>
                </div>
              </div>
              <Textarea
                id="category_schema"
                value={form.schemaText}
                onChange={(event) => setForm((prev) => ({ ...prev, schemaText: event.target.value }))}
                className="min-h-[280px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Define the shared fields for content in this category. The `name` field is required.
              </p>
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">
                {dialogMode === 'create' ? 'Create Content Category' : 'Save Changes'}
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
            <AlertDialogTitle>Delete Content Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a content category is permanent. This will remove the content category from your editable list.
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
      <AlertDialog open={isContentDeleteOpen} onOpenChange={setIsContentDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting {deleteContentTarget?.content.name ?? 'this content'} is permanent. This will remove its saved versions and active state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteContentTarget(null);
                setIsContentDeleteOpen(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleContentDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

}

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}

function parseSchemaText(value: string): ContentCategorySchemaDefinition {
  try {
    const parsed = JSON.parse(value) as ContentCategorySchemaDefinition;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.fields)) {
      throw new Error('Schema must be an object with a fields array.');
    }
    return parsed;
  } catch (err) {
    throw new Error((err as Error)?.message || 'Schema definition must be valid JSON.');
  }
}

function safeParseSchemaText(value: string): ContentCategorySchemaDefinition | null {
  try {
    return parseSchemaText(value);
  } catch {
    return null;
  }
}

function validateSchemaDefinition(
  schema: ContentCategorySchemaDefinition,
  kind: 'generic' | 'character_sheet',
) {
  if (!Array.isArray(schema.fields) || schema.fields.length === 0) {
    throw new Error('Schema must include at least one field.');
  }

  const nameField = schema.fields.find((field) => field.key === 'name');
  if (!nameField) {
    throw new Error('Schema must include a default `name` field.');
  }

  for (const field of schema.fields) {
    validateSchemaField(field, kind);
  }
}

function validateSchemaField(
  field: ContentCategorySchemaField,
  kind: 'generic' | 'character_sheet',
) {
  if (!field.key?.trim()) {
    throw new Error('Every schema field must have a key.');
  }

  const isReferenceField =
    field.type === 'content_reference' || field.type === 'content_reference_list';

  if (kind === 'generic' && isReferenceField && Array.isArray(field.allowed_categories) && field.allowed_categories.length > 0) {
    throw new Error(`Generic categories cannot set allowed_categories on \`${field.key}\`.`);
  }

  if (kind === 'character_sheet' && isReferenceField) {
    if (!Array.isArray(field.allowed_categories) || field.allowed_categories.length === 0) {
      throw new Error(`Character sheet reference field \`${field.key}\` must define allowed_categories.`);
    }
  }

  if (field.type === 'object_list' && field.object_schema) {
    for (const nestedField of field.object_schema.fields ?? []) {
      validateSchemaField(nestedField, kind);
    }
  }
}

function defaultSchemaDefinition(kind: 'generic' | 'character_sheet' | string): ContentCategorySchemaDefinition {
  if (kind === 'character_sheet') {
    return {
      fields: [
        { key: 'name', label: 'Name', type: 'string', required: true },
        { key: 'hp', label: 'HP', type: 'number' },
        { key: 'mp', label: 'MP', type: 'number' },
        { key: 'ep', label: 'EP', type: 'number' },
        { key: 'gold', label: 'Gold', type: 'number' },
        {
          key: 'traits',
          label: 'Traits / Features',
          type: 'object_list',
          object_schema: {
            fields: [
              { key: 'name', label: 'Name', type: 'string', required: true },
              { key: 'uses', label: 'Uses', type: 'number' },
            ],
          },
        },
      ],
    };
  }

  return {
    fields: [
      { key: 'name', label: 'Name', type: 'string', required: true },
      { key: 'descr', label: 'Description', type: 'text' },
      { key: 'cost', label: 'Cost', type: 'number' },
      { key: 'mp_cost', label: 'MP Cost', type: 'number' },
      { key: 'ep_cost', label: 'EP Cost', type: 'number' },
      { key: 'tp_cost', label: 'TP Cost', type: 'number' },
    ],
  };
}
