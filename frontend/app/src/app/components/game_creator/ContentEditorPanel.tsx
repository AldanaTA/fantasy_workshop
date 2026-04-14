import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '../ui/card';
import { ChevronDown, ChevronRight, Save, Eye, Plus } from 'lucide-react';
import { contentApi } from '../../api/contentApi';
import { contentCategoriesApi } from '../../api/contentCategoriesApi';
import type { Content, ContentCategory, ContentVersion, JSONDict } from '../../api/models';

function asEditValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function parseFieldValue(rawValue: string, original?: unknown): unknown {
  if (original === undefined || original === null) {
    const trimmed = rawValue.trim();
    if (trimmed === '') return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return rawValue;
    }
  }

  if (typeof original === 'number') {
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? rawValue : parsed;
  }

  if (typeof original === 'boolean') {
    return rawValue === 'true';
  }

  if (typeof original === 'string') {
    return rawValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

export function ContentEditorPanel() {
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [contentItems, setContentItems] = useState<Content[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [activeVersion, setActiveVersion] = useState<ContentVersion | null>(null);
  const [fieldDraft, setFieldDraft] = useState<JSONDict>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [categoriesData, contentData] = await Promise.all([
          contentCategoriesApi.list(100, 0),
          contentApi.list(100, 0),
        ]);
        setCategories(categoriesData);
        setContentItems(contentData);
        setExpandedCategories(categoriesData.map((category) => category.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadActive = async () => {
      if (!selectedContent) {
        setActiveVersion(null);
        setFieldDraft({});
        return;
      }

      try {
        const version = await contentApi.getActive(selectedContent.id);
        setActiveVersion(version);
        setFieldDraft(version.fields ?? {});
      } catch (err) {
        setActiveVersion(null);
        setFieldDraft({});
      }
    };

    void loadActive();
  }, [selectedContent]);

  const selectedCategoryId = useMemo(() => {
    if (selectedContent) {
      return selectedContent.category_id;
    }
    return categories[0]?.id || null;
  }, [categories, selectedContent]);

  const categoryContent = useMemo(() => {
    if (!selectedCategoryId) {
      return [];
    }
    return contentItems.filter((content) => content.category_id === selectedCategoryId);
  }, [contentItems, selectedCategoryId]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  };

  const setFieldValue = (fieldName: string, rawValue: string) => {
    setFieldDraft((current) => ({
      ...current,
      [fieldName]: parseFieldValue(rawValue, current[fieldName]),
    }));
  };

  const handleContentSelect = (content: Content) => {
    setSelectedContent(content);
    setError(null);
  };

  const saveContent = async () => {
    if (!selectedContent) return;
    setIsSaving(true);
    setError(null);

    const versionNum = (activeVersion?.version_num ?? 0) + 1;

    try {
      await contentApi.createVersion(selectedContent.id, {
        content_id: selectedContent.id,
        version_num: versionNum,
        fields: fieldDraft,
      });
      await contentApi.upsertActive(selectedContent.id, {
        content_id: selectedContent.id,
        active_version_num: versionNum,
      });
      const savedActive = await contentApi.getActive(selectedContent.id);
      setActiveVersion(savedActive);
      setFieldDraft(savedActive.fields ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save content');
    } finally {
      setIsSaving(false);
    }
  };

  const renderCategory = (category: ContentCategory) => {
    const isExpanded = expandedCategories.includes(category.id);
    const items = contentItems.filter((item) => item.category_id === category.id);

    return (
      <div key={category.id} className="space-y-2">
        <button
          type="button"
          onClick={() => toggleCategory(category.id)}
          className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-medium transition hover:border-primary/70"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{category.name}</span>
          <span className="ml-auto text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</span>
        </button>

        {isExpanded && (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleContentSelect(item)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  selectedContent?.id === item.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background hover:border-primary/70 hover:bg-primary/5'
                }`}
              >
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.content_type}</p>
              </button>
            ))}
            {items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/5 px-4 py-3 text-sm text-muted-foreground">
                No content items in this category yet.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-full border-border bg-background">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold">Content Categories</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Expand categories and select content to load the shared schema.
              </CardDescription>
            </div>
            <Button variant="secondary" size="sm" type="button" disabled>
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="rounded-3xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
              Loading categories and content...
            </div>
          ) : (
            categories.map((category) => renderCategory(category))
          )}
        </CardContent>
      </Card>

      <Card className="h-full border-border bg-background">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Display Selected Content Fields</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Content is rendered from the shared schema fields and saved through the content API.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {selectedContent ? (
            <div className="space-y-5 rounded-3xl border border-border bg-surface p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</p>
                  <p className="text-sm font-semibold">{selectedContent.name}</p>
                </div>
                <div className="space-y-2 rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Type</p>
                  <p className="text-sm font-semibold">{selectedContent.content_type}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Summary</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedContent.summary ?? 'No summary provided.'}</p>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-semibold">Schema Fields</h3>
                {Object.keys(fieldDraft).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active schema fields available for this content yet.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(fieldDraft).map(([fieldName, value]) => {
                      const editValue = asEditValue(value);
                      const isStructured = typeof value === 'object' && value !== null;
                      return (
                        <div key={fieldName} className="rounded-2xl border border-border bg-background p-4">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-medium">{fieldName}</p>
                            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {isStructured ? 'JSON' : typeof value}
                            </span>
                          </div>
                          {isStructured ? (
                            <Textarea
                              value={editValue}
                              onChange={(event) => setFieldValue(fieldName, event.target.value)}
                              className="mt-3 min-h-[140px] text-sm"
                            />
                          ) : (
                            <Input
                              value={editValue}
                              onChange={(event) => setFieldValue(fieldName, event.target.value)}
                              className="mt-3 text-sm"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
              Select a content item from the left to load shared content schema fields.
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button
            className="w-full sm:w-auto"
            type="button"
            onClick={saveContent}
            disabled={!selectedContent || isSaving}
          >
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" type="button" disabled={!selectedContent}>
            <Eye className="mr-2 h-4 w-4" /> View in Rules
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
