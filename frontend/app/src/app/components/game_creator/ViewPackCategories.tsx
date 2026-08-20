import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, CircleArrowLeft, Edit3, Eye, Plus, Trash2 } from 'lucide-react';

import type {
  Content,
  ContentCategory,
  ContentCategoryFieldType,
  ContentCategorySchemaDefinition,
  ContentCategorySchemaField,
  ContentPack,
} from '../../api/models';
import { contentApi, invalidateContentCategoryCaches } from '../../api/contentApi';
import { contentCategoriesApi, invalidateContentCategoriesByPack } from '../../api/contentCategoriesApi';
import {
  humanizeSchemaKey,
  isExpressionFieldType,
  isReferenceFieldType,
  SCHEMA_FIELD_TYPES,
} from '../../types/schemaFields';
import { ContentMaker } from './contentMaker';
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
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
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
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/toastProvider';

type CategoryKind = 'generic' | 'character_sheet';

interface FormState {
  name: string;
  kind: CategoryKind;
  schemaDefinition: ContentCategorySchemaDefinition;
}

interface FieldFormState {
  key: string;
  label: string;
  type: ContentCategoryFieldType;
  required: boolean;
  allowedCategoriesText: string;
  objectListCategoriesText: string;
  objectListIncludeQuantity: boolean;
}

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

const emptyFieldForm: FieldFormState = {
  key: '',
  label: '',
  type: 'string',
  required: false,
  allowedCategoriesText: '',
  objectListCategoriesText: '',
  objectListIncludeQuantity: true,
};

const emptyForm: FormState = {
  name: '',
  kind: 'generic',
  schemaDefinition: defaultSchemaDefinition('generic'),
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
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSchemaViewOpen, setIsSchemaViewOpen] = useState(false);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [fieldDialogMode, setFieldDialogMode] = useState<'create' | 'edit'>('create');
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState<FieldFormState>(emptyFieldForm);
  const [fieldError, setFieldError] = useState<string | null>(null);
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
  const { toastPromise } = useToast();

  const loadPacks = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await contentCategoriesApi.listByPack(pack.id, 100, 0, { signal });
      setContentCategories(loaded);
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
      setCategoryContent({
        [categoryId]: {
          items,
          isLoading: false,
          error: null,
          hasLoaded: true,
        },
      });
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
    if (isloading || hasRestoredState) return;
    if (!initialExpandedCategoryId || !contentCategories.some((category) => category.id === initialExpandedCategoryId)) {
      setHasRestoredState(true);
      return;
    }

    setExpandedCategoryId(initialExpandedCategoryId);
    void loadCategoryContent(initialExpandedCategoryId);
    setHasRestoredState(true);
  }, [contentCategories, hasRestoredState, initialExpandedCategoryId, isloading]);

  useEffect(() => {
    if (!hasRestoredState) return;
    onResumeStateChange?.(expandedCategoryId);
  }, [expandedCategoryId, hasRestoredState, onResumeStateChange]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setActiveCategory(null);
    setForm({
      name: '',
      kind: 'generic',
      schemaDefinition: defaultSchemaDefinition('generic'),
    });
    setFieldError(null);
    setError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (contentCategory: ContentCategory) => {
    const kind = contentCategory.kind === 'character_sheet' ? 'character_sheet' : 'generic';
    setDialogMode('edit');
    setActiveCategory(contentCategory);
    setForm({
      name: contentCategory.name,
      kind,
      schemaDefinition: cloneSchemaDefinition(contentCategory.active_schema_definition ?? defaultSchemaDefinition(kind)),
    });
    setFieldError(null);
    setError(null);
    setIsDialogOpen(true);
  };

  const closeFieldDialog = () => {
    setIsFieldDialogOpen(false);
    setEditingFieldIndex(null);
    setFieldForm(emptyFieldForm);
    setFieldError(null);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setIsSchemaViewOpen(false);
    closeFieldDialog();
    setActiveCategory(null);
    setError(null);
  };

  const openCreateFieldDialog = () => {
    setFieldDialogMode('create');
    setEditingFieldIndex(null);
    setFieldForm(emptyFieldForm);
    setFieldError(null);
    setIsFieldDialogOpen(true);
  };

  const openEditFieldDialog = (field: ContentCategorySchemaField, index: number) => {
    setFieldDialogMode('edit');
    setEditingFieldIndex(index);
    setFieldForm(fieldToFormState(field));
    setFieldError(null);
    setIsFieldDialogOpen(true);
  };

  const handleFieldSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);

    try {
      const nextField = buildFieldFromForm(fieldForm, form.kind);
      const duplicateIndex = form.schemaDefinition.fields.findIndex((field) => field.key === nextField.key);
      if (duplicateIndex >= 0 && duplicateIndex !== editingFieldIndex) {
        throw new Error(`A field with key \`${nextField.key}\` already exists.`);
      }

      setForm((prev) => {
        const fields = [...prev.schemaDefinition.fields];
        if (fieldDialogMode === 'edit' && editingFieldIndex !== null) {
          fields[editingFieldIndex] = nextField;
        } else {
          fields.push(nextField);
        }
        return {
          ...prev,
          schemaDefinition: { fields },
        };
      });

      closeFieldDialog();
    } catch (err) {
      setFieldError((err as Error)?.message || 'Unable to save field.');
    }
  };

  const handleDeleteField = (index: number) => {
    setForm((prev) => ({
      ...prev,
      schemaDefinition: {
        fields: prev.schemaDefinition.fields.filter((_, fieldIndex) => fieldIndex !== index),
      },
    }));
  };

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('A content category name is required.');
      return;
    }

    setError(null);
    try {
      const schemaDefinition = cloneSchemaDefinition(form.schemaDefinition);
      validateSchemaDefinition(schemaDefinition, form.kind);

      if (dialogMode === 'create') {
        await toastPromise(
          contentCategoriesApi.create({
            pack_id: pack.id,
            name: form.name.trim(),
            kind: form.kind,
            schema_definition: schemaDefinition,
          }),
          {
            loading: 'Creating content category...',
            success: 'Content category created successfully.',
            error: (e) => (e as Error)?.message || 'Failed to create content category.',
          },
        );
      } else if (activeCategory) {
        await toastPromise(
          contentCategoriesApi.patch(activeCategory.id, {
            name: form.name.trim(),
            kind: form.kind,
            schema_definition: schemaDefinition,
          }),
          {
            loading: 'Updating content category...',
            success: 'Content category updated successfully.',
            error: (e) => (e as Error)?.message || 'Failed to update content category.',
          },
        );
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
        loading: 'Deleting content category...',
        success: 'Content category deleted successfully.',
        error: (e) => (e as Error)?.message || 'Failed to delete content category.',
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
    } catch {}
  };

  const handleContentDelete = async () => {
    if (!deleteContentTarget) return;
    try {
      await toastPromise(contentApi.delete(deleteContentTarget.content.id), {
        loading: 'Deleting content...',
        success: 'Content deleted successfully.',
        error: (e) => (e as Error)?.message || 'Failed to delete content.',
      });
      invalidateContentCategoryCaches(deleteContentTarget.category.id);
      setIsContentDeleteOpen(false);
      setDeleteContentTarget(null);
      await loadCategoryContent(deleteContentTarget.category.id, true);
    } catch {}
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
      const ordered = await toastPromise(
        contentCategoriesApi.reorder(pack.id, contentCategories.map((category) => category.id)),
        {
          loading: 'Saving category order...',
          success: 'Category order saved successfully.',
          error: (e) => (e as Error)?.message || 'Failed to save category order.',
        },
      );
      setContentCategories(ordered);
      setIsOrderDirty(false);
    } catch {}
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
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">View content categories in {pack.pack_name}</h2>
            <p className="text-sm text-muted-foreground">
              This is where you can view and manage this pack&apos;s content categories.
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
              <Button variant="secondary" onClick={handleSaveOrder} disabled={!isOrderDirty} className="min-h-[44px] min-w-0 px-2 sm:shrink-0 sm:px-4">
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
                    <Button variant="outline" size="sm" onClick={() => moveCategory(category.id, -1)} disabled={index === 0} className="min-w-0 px-2 sm:px-3">
                      <ChevronUp className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="truncate">Up</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => moveCategory(category.id, 1)} disabled={index === contentCategories.length - 1} className="min-w-0 px-2 sm:px-3">
                      <ChevronDown className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="truncate">Down</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleCategory(category.id)} className="min-w-0 px-2 sm:px-3">
                      {expandedCategoryId === category.id ? <ChevronUp className="h-4 w-4 shrink-0 sm:mr-2" /> : <ChevronDown className="h-4 w-4 shrink-0 sm:mr-2" />}
                      <span className="truncate sm:hidden">{expandedCategoryId === category.id ? 'Hide' : 'View'}</span>
                      <span className="hidden sm:inline">{expandedCategoryId === category.id ? 'Hide Content' : 'View Content'}</span>
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => openEditDialog(category)} className="min-w-0 px-2 sm:px-3">
                      <Edit3 className="h-4 w-4 shrink-0 sm:mr-2" />
                      <span className="truncate">Edit</span>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => { setDeleteTarget(category); setIsDeleteOpen(true); }} className="min-w-0 px-2 sm:px-3">
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
                                    {content.summary ? <p className="text-sm text-muted-foreground">{content.summary}</p> : null}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setContentMakerTarget({ content, category })}>
                                      <Edit3 className="h-4 w-4 sm:mr-2" />
                                      <span className="truncate">Edit</span>
                                    </Button>
                                    <Button type="button" variant="destructive" size="sm" onClick={() => { setDeleteContentTarget({ content, category }); setIsContentDeleteOpen(true); }}>
                                      <Trash2 className="h-4 w-4 sm:mr-2" />
                                      <span className="truncate">Delete</span>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button type="button" variant="outline" onClick={() => setContentMakerTarget({ category })} className="w-full min-h-[44px]">
                            <Plus className="h-4 w-4" />
                            Add Content
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">No content in this category yet.</p>
                          <Button type="button" variant="outline" onClick={() => setContentMakerTarget({ category })} className="w-full min-h-[44px]">
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Create Content Category' : 'Edit Content Category'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'create' ? 'Add a new content category to your game.' : 'Update the content category details and save your changes.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleDialogSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="category_name">Name</Label>
              <Input id="category_name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="My Adventure System" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category_kind">Kind</Label>
              <select
                id="category_kind"
                value={form.kind}
                onChange={(event) => {
                  const nextKind: CategoryKind = event.target.value === 'character_sheet' ? 'character_sheet' : 'generic';
                  setForm((prev) => ({
                    ...prev,
                    kind: nextKind,
                    schemaDefinition: normalizeSchemaForKind(prev.schemaDefinition, nextKind),
                  }));
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="generic">Generic</option>
                <option value="character_sheet">Character Sheet</option>
              </select>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Schema Fields</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm((prev) => ({ ...prev, schemaDefinition: defaultSchemaDefinition(prev.kind) }))}>
                    Reset Template
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsSchemaViewOpen(true)}>
                    <Eye className="h-4 w-4 sm:mr-2" />
                    View Schema
                  </Button>
                  <Button type="button" size="sm" onClick={openCreateFieldDialog}>
                    <Plus className="h-4 w-4 sm:mr-2" />
                    Add Field
                  </Button>
                </div>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm font-medium">{form.schemaDefinition.fields.length} field{form.schemaDefinition.fields.length === 1 ? '' : 's'} configured</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Field types now define how content renders. Character sheet categories use the same schema model with a sheet layout.
                </p>
              </div>
            </div>
            {error ? <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">{dialogMode === 'create' ? 'Create Content Category' : 'Save Changes'}</Button>
              <Button variant="outline" type="button" onClick={closeDialog} className="w-full sm:w-auto">Cancel</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSchemaViewOpen} onOpenChange={setIsSchemaViewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Schema</DialogTitle>
            <DialogDescription>These are the fields content in this category will use.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {form.schemaDefinition.fields.map((field, index) => (
              <Card key={`${field.key}-${index}`} className="border">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{field.label?.trim() || humanizeSchemaKey(field.key)}</p>
                      <p className="text-sm text-muted-foreground">
                        Key: <code>{field.key}</code> · Type: {field.type}
                        {field.required ? ' · Required' : ''}
                      </p>
                      {Array.isArray(field.allowed_categories) && field.allowed_categories.length > 0 ? (
                        <p className="text-sm text-muted-foreground">Allowed categories: {field.allowed_categories.join(', ')}</p>
                      ) : null}
                      {field.type === 'object_list' && field.object_schema ? (
                        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(field.object_schema, null, 2)}</pre>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <Button type="button" variant="secondary" size="sm" onClick={() => openEditFieldDialog(field, index)}>
                        <Edit3 className="h-4 w-4 sm:mr-2" />
                        Edit
                      </Button>
                      <Button type="button" variant="destructive" size="sm" disabled={field.key === 'name'} onClick={() => handleDeleteField(index)}>
                        <Trash2 className="h-4 w-4 sm:mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsSchemaViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{fieldDialogMode === 'create' ? 'Add Field' : 'Edit Field'}</DialogTitle>
            <DialogDescription>Choose the field type and options this category should render with.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleFieldSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="schema_field_key">Field Key</Label>
              <Input id="schema_field_key" value={fieldForm.key} onChange={(event) => setFieldForm((prev) => ({ ...prev, key: event.target.value }))} placeholder="max_hp" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schema_field_label">Label</Label>
              <Input id="schema_field_label" value={fieldForm.label} onChange={(event) => setFieldForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Max HP" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schema_field_type">Type</Label>
              <select
                id="schema_field_type"
                value={fieldForm.type}
                onChange={(event) => setFieldForm((prev) => ({ ...prev, type: sanitizeFieldType(event.target.value) }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {SCHEMA_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="schema_field_required" checked={fieldForm.required} onCheckedChange={(checked) => setFieldForm((prev) => ({ ...prev, required: Boolean(checked) }))} />
              <Label htmlFor="schema_field_required">Required field</Label>
            </div>
            {isReferenceFieldType(fieldForm.type) ? (
              <div className="grid gap-2">
                <Label htmlFor="schema_field_allowed_categories">Allowed Categories</Label>
                <Textarea
                  id="schema_field_allowed_categories"
                  value={fieldForm.allowedCategoriesText}
                  onChange={(event) => setFieldForm((prev) => ({ ...prev, allowedCategoriesText: event.target.value }))}
                  placeholder={form.kind === 'character_sheet' ? 'Weapons, Powers' : 'Leave blank for same-category references'}
                  className="min-h-[100px]"
                />
              </div>
            ) : null}
            {fieldForm.type === 'object_list' ? (
              <div className="grid gap-2">
                <Label htmlFor="schema_field_object_categories">List Categories</Label>
                <Textarea
                  id="schema_field_object_categories"
                  value={fieldForm.objectListCategoriesText}
                  onChange={(event) => setFieldForm((prev) => ({ ...prev, objectListCategoriesText: event.target.value }))}
                  placeholder="Items, Weapons, Armor"
                  className="min-h-[100px]"
                />
                <div className="flex items-center gap-3">
                  <Checkbox id="schema_field_object_quantity" checked={fieldForm.objectListIncludeQuantity} onCheckedChange={(checked) => setFieldForm((prev) => ({ ...prev, objectListIncludeQuantity: Boolean(checked) }))} />
                  <Label htmlFor="schema_field_object_quantity">Include quantity field</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Object lists create rows that reference content from the selected categories.
                </p>
              </div>
            ) : null}
            {isExpressionFieldType(fieldForm.type) ? (
              <p className="text-xs text-muted-foreground">
                {fieldForm.type === 'formula'
                  ? 'Formula fields can reference stable sheet field keys such as max_hp.'
                  : 'Dice fields render as rollable expressions.'}
              </p>
            ) : null}
            {fieldError ? <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{fieldError}</div> : null}
            <DialogFooter>
              <Button type="submit">{fieldDialogMode === 'create' ? 'Add Field' : 'Save Field'}</Button>
              <Button type="button" variant="outline" onClick={closeFieldDialog}>Cancel</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Category?</AlertDialogTitle>
            <AlertDialogDescription>Deleting a content category is permanent. This will remove the content category from your editable list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setIsDeleteOpen(false); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isContentDeleteOpen} onOpenChange={setIsContentDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content?</AlertDialogTitle>
            <AlertDialogDescription>Deleting {deleteContentTarget?.content.name ?? 'this content'} is permanent. This will remove its saved versions and active state.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteContentTarget(null); setIsContentDeleteOpen(false); }}>Cancel</AlertDialogCancel>
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

function cloneSchemaDefinition(schema: ContentCategorySchemaDefinition): ContentCategorySchemaDefinition {
  return JSON.parse(JSON.stringify(schema)) as ContentCategorySchemaDefinition;
}

function validateSchemaDefinition(schema: ContentCategorySchemaDefinition, kind: CategoryKind) {
  if (!Array.isArray(schema.fields) || schema.fields.length === 0) {
    throw new Error('Schema must include at least one field.');
  }
  const seen = new Set<string>();
  for (const field of schema.fields) {
    validateSchemaField(field, kind);
    if (seen.has(field.key)) {
      throw new Error(`Schema contains duplicate field key \`${field.key}\`.`);
    }
    seen.add(field.key);
  }
  if (!seen.has('name')) {
    throw new Error('Schema must include a default `name` field.');
  }
}

function validateSchemaField(field: ContentCategorySchemaField, kind: CategoryKind) {
  if (!field.key?.trim()) {
    throw new Error('Every schema field must have a key.');
  }
  if (field.key.includes(' ')) {
    throw new Error(`Field key \`${field.key}\` cannot contain spaces.`);
  }
  if (kind === 'generic' && isReferenceFieldType(field.type) && Array.isArray(field.allowed_categories) && field.allowed_categories.length > 0) {
    throw new Error(`Generic categories cannot set allowed_categories on \`${field.key}\`.`);
  }
  if (kind === 'character_sheet' && isReferenceFieldType(field.type)) {
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

function buildFieldFromForm(form: FieldFormState, kind: CategoryKind): ContentCategorySchemaField {
  const key = form.key.trim();
  if (!key) throw new Error('Field key is required.');

  const field: ContentCategorySchemaField = {
    key,
    type: form.type,
  };

  if (form.label.trim()) field.label = form.label.trim();
  if (form.required) field.required = true;

  if (isReferenceFieldType(form.type)) {
    const allowed = parseCommaList(form.allowedCategoriesText);
    if (allowed.length) field.allowed_categories = allowed;
  }

  if (form.type === 'object_list') {
    const allowed = parseCommaList(form.objectListCategoriesText);
    if (!allowed.length) {
      throw new Error('Object lists require at least one allowed category.');
    }
    field.object_schema = {
      fields: [
        {
          key: 'item',
          label: 'Item',
          type: 'content_reference',
          allowed_categories: allowed,
          required: true,
        },
        ...(form.objectListIncludeQuantity ? [{ key: 'quantity', label: 'Quantity', type: 'number' as const }] : []),
      ],
    };
  }

  validateSchemaField(field, kind);
  return field;
}

function fieldToFormState(field: ContentCategorySchemaField): FieldFormState {
  const objectListCategories =
    field.type === 'object_list'
      ? parseObjectListCategories(field.object_schema).join(', ')
      : '';
  const hasQuantity =
    field.type === 'object_list'
      ? Boolean(field.object_schema?.fields?.some((nested) => nested.key === 'quantity'))
      : true;

  return {
    key: field.key,
    label: field.label ?? '',
    type: sanitizeFieldType(field.type),
    required: Boolean(field.required),
    allowedCategoriesText: Array.isArray(field.allowed_categories) ? field.allowed_categories.join(', ') : '',
    objectListCategoriesText: objectListCategories,
    objectListIncludeQuantity: hasQuantity,
  };
}

function parseObjectListCategories(schema?: ContentCategorySchemaDefinition) {
  const nestedField = schema?.fields?.find((field) => field.key === 'item' && field.type === 'content_reference');
  return Array.isArray(nestedField?.allowed_categories) ? nestedField.allowed_categories : [];
}

function parseCommaList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function sanitizeFieldType(value: string): ContentCategoryFieldType {
  return SCHEMA_FIELD_TYPES.includes(value as ContentCategoryFieldType)
    ? (value as ContentCategoryFieldType)
    : 'string';
}

function normalizeSchemaForKind(schema: ContentCategorySchemaDefinition, kind: CategoryKind): ContentCategorySchemaDefinition {
  const nextSchema = cloneSchemaDefinition(schema);
  if (kind === 'generic') {
    nextSchema.fields = nextSchema.fields.map((field) => {
      if (!isReferenceFieldType(field.type)) return field;
      const nextField = { ...field };
      delete nextField.allowed_categories;
      return nextField;
    });
  }
  return nextSchema;
}

function defaultSchemaDefinition(kind: CategoryKind | string): ContentCategorySchemaDefinition {
  if (kind === 'character_sheet') {
    return {
      fields: [
        { key: 'name', label: 'Name', type: 'string', required: true },
        { key: 'max_hp', label: 'Max HP', type: 'number' },
        { key: 'hp', label: 'Current HP', type: 'number' },
        { key: 'mp', label: 'MP', type: 'number' },
        { key: 'initiative', label: 'Initiative', type: 'formula' },
        {
          key: 'inventory',
          label: 'Inventory',
          type: 'object_list',
          object_schema: {
            fields: [
              {
                key: 'item',
                label: 'Item',
                type: 'content_reference',
                allowed_categories: ['Items'],
                required: true,
              },
              { key: 'quantity', label: 'Quantity', type: 'number' },
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
      { key: 'damage_roll', label: 'Damage Roll', type: 'dice' },
      { key: 'passive_bonus', label: 'Passive Bonus', type: 'formula' },
    ],
  };
}
