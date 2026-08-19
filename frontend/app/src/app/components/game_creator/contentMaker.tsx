import { useEffect, useMemo, useState } from 'react';
import { CircleArrowLeft, Plus, Trash2 } from 'lucide-react';

import { contentApi, invalidateContentCategoryCaches } from '../../api/contentApi';
import { contentCategoriesApi } from '../../api/contentCategoriesApi';
import type {
  Content,
  ContentCategory,
  ContentCategorySchemaDefinition,
  ContentCategorySchemaField,
  ContentPack,
} from '../../api/models';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { useToast } from '../ui/toastProvider';

type Props = {
  pack: ContentPack;
  category: ContentCategory;
  content?: Content;
  onCreated?: () => Promise<void> | void;
  onCancel?: () => void;
};

type ReferenceOption = {
  id: string;
  name: string;
  categoryName: string;
};

type ReferenceOptionsByField = Record<string, ReferenceOption[]>;

type ContentValues = Record<string, unknown>;

const defaultSchema: ContentCategorySchemaDefinition = {
  fields: [{ key: 'name', label: 'Name', type: 'string' }],
};

export function ContentMaker({ pack, category, content, onCreated, onCancel }: Props) {
  const { toastPromise } = useToast();
  const schema = category.active_schema_definition ?? defaultSchema;
  const schemaFields = schema.fields ?? [];
  const nameField = schemaFields.find((field) => field.key === 'name');

  const [summary, setSummary] = useState(content?.summary ?? '');
  const [values, setValues] = useState<ContentValues>(() => buildInitialValues(schema));
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOptionsByField>({});
  const [isLoading, setIsLoading] = useState(Boolean(content));
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(content);

  useEffect(() => {
    setValues(buildInitialValues(schema));
    setSummary(content?.summary ?? '');
  }, [category.id, content?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadExisting = async () => {
      if (!content) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const active = await contentApi.getActive(content.id);
        if (!cancelled) {
          const nextValues = buildInitialValues(schema, asObject(active.fields));
          if (typeof content.name === 'string') {
            nextValues.name = content.name;
          }
          setValues(nextValues);
          setSummary(content.summary ?? '');
        }
      } catch (err) {
        if (!cancelled) {
          const fallback = buildInitialValues(schema, { name: content.name });
          setValues(fallback);
          setSummary(content.summary ?? '');
          setError((err as Error)?.message || 'Unable to load content values.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [content?.id, schema]);

  useEffect(() => {
    let cancelled = false;

    const loadReferenceOptions = async () => {
      const nextOptions: ReferenceOptionsByField = {};
      const categoriesByName = new Map<string, ContentCategory>();

      const allCategories = await contentCategoriesApi.listByPack(pack.id, 200, 0);
      for (const packCategory of allCategories) {
        categoriesByName.set(packCategory.name, packCategory);
      }

      const visited = new Set<string>();
      for (const field of flattenReferenceFields(schema)) {
        const categoryIds = resolveAllowedCategoryIds(field, category, categoriesByName);
        const options: ReferenceOption[] = [];

        for (const categoryId of categoryIds) {
          if (visited.has(`${field.path}:${categoryId}`)) continue;
          visited.add(`${field.path}:${categoryId}`);
          const items = await contentApi.listByCategory(categoryId, 200, 0);
          const categoryName = allCategories.find((entry) => entry.id === categoryId)?.name ?? 'Unknown';
          for (const item of items) {
            if (content && item.id === content.id) continue;
            options.push({
              id: item.id,
              name: item.name,
              categoryName,
            });
          }
        }

        nextOptions[field.path] = options;
      }

      if (!cancelled) {
        setReferenceOptions(nextOptions);
      }
    };

    void loadReferenceOptions().catch((err) => {
      if (!cancelled) {
        setReferenceOptions({});
        setError((current) => current ?? ((err as Error)?.message || 'Unable to load reference content.'));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [category, content?.id, pack.id, schema]);

  const contentName = useMemo(() => {
    const value = values.name;
    return typeof value === 'string' ? value.trim() : '';
  }, [values.name]);

  const handleSubmit = async () => {
    if (!contentName) {
      setError(`${nameField?.label ?? 'Name'} is required.`);
      return;
    }

    setError(null);

    try {
      await toastPromise(
        (async () => {
          const saved = content
            ? await contentApi.patch(content.id, {
                name: contentName,
                summary: summary.trim() || null,
              })
            : await contentApi.create({
                pack_id: pack.id,
                category_id: category.id,
                name: contentName,
                summary: summary.trim() || null,
              });

          const version = await contentApi.createVersion(saved.id, {
            fields: values,
          });

          await contentApi.upsertActive(saved.id, {
            content_id: saved.id,
            active_version_num: version.version_num,
            deleted_at: null,
          });

          invalidateContentCategoryCaches(category.id);
          return saved;
        })(),
        {
          loading: isEditing ? 'Saving content...' : 'Creating content...',
          success: isEditing ? 'Content saved successfully.' : 'Content created successfully.',
          error: (err) =>
            (err as Error)?.message || (isEditing ? 'Failed to save content.' : 'Failed to create content.'),
        },
      );

      await onCreated?.();
    } catch (err) {
      setError((err as Error)?.message || (isEditing ? 'Failed to save content.' : 'Failed to create content.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{isEditing ? 'Edit content' : `Create content in ${category.name}`}</h2>
            <p className="text-sm text-muted-foreground">
              Fill out the schema-defined fields for this {category.kind === 'character_sheet' ? 'character sheet' : 'content'} category.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onCancel} className="min-h-[44px] w-full sm:w-auto">
            <CircleArrowLeft className="h-4 w-4 shrink-0" />
            Back to Categories
          </Button>
        </div>
        <Separator />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading content...</p>
        ) : (
          <div className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Content Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="content_summary">Summary</Label>
                  <Textarea
                    id="content_summary"
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="Optional short summary"
                    className="min-h-[96px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Schema Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {schemaFields.map((field) => (
                  <SchemaFieldEditor
                    key={field.key}
                    field={field}
                    fieldPath={field.key}
                    value={values[field.key]}
                    onChange={(nextValue) => setValues((prev) => ({ ...prev, [field.key]: nextValue }))}
                    referenceOptions={referenceOptions}
                  />
                ))}
              </CardContent>
            </Card>

            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSubmit()} className="w-full sm:w-auto">
                {isEditing ? 'Save Content' : 'Create Content'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SchemaFieldEditor({
  field,
  fieldPath,
  value,
  onChange,
  referenceOptions,
}: {
  field: ContentCategorySchemaField;
  fieldPath: string;
  value: unknown;
  onChange: (value: unknown) => void;
  referenceOptions: ReferenceOptionsByField;
}) {
  const label = field.label || humanizeKey(field.key);

  if (field.type === 'text') {
    return (
      <div className="grid gap-2">
        <Label htmlFor={fieldPath}>{label}</Label>
        <Textarea
          id={fieldPath}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[96px]"
        />
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="grid gap-2">
        <Label htmlFor={fieldPath}>{label}</Label>
        <Input
          id={fieldPath}
          type="number"
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <Checkbox
          id={fieldPath}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
        />
        <Label htmlFor={fieldPath}>{label}</Label>
      </div>
    );
  }

  if (field.type === 'content_reference') {
    const options = referenceOptions[fieldPath] ?? [];
    return (
      <div className="grid gap-2">
        <Label htmlFor={fieldPath}>{label}</Label>
        <select
          id={fieldPath}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Select content</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} ({option.categoryName})
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'content_reference_list') {
    const selected = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
    const options = referenceOptions[fieldPath] ?? [];
    return (
      <div className="grid gap-2">
        <Label>{label}</Label>
        <div className="space-y-2 rounded-md border border-border p-3">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No content available for this reference field yet.</p>
          ) : (
            options.map((option) => (
              <label key={option.id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={selected.includes(option.id)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selected, option.id]
                      : selected.filter((entry) => entry !== option.id);
                    onChange(next);
                  }}
                />
                <span>{option.name} ({option.categoryName})</span>
              </label>
            ))
          )}
        </div>
      </div>
    );
  }

  if (field.type === 'object_list') {
    const objectSchema = field.object_schema ?? { fields: [] };
    const rows = Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => isObject(entry)) : [];

    return (
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...rows, buildInitialValues(objectSchema)])}
          >
            <Plus className="h-4 w-4" />
            Add Row
          </Button>
        </div>
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            rows.map((row, rowIndex) => (
              <div key={`${fieldPath}-${rowIndex}`} className="rounded-md border border-border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">{label} #{rowIndex + 1}</p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  {objectSchema.fields.map((nestedField) => (
                    <SchemaFieldEditor
                      key={`${fieldPath}.${nestedField.key}.${rowIndex}`}
                      field={nestedField}
                      fieldPath={`${fieldPath}.${nestedField.key}`}
                      value={row[nestedField.key]}
                      onChange={(nextValue) => {
                        const nextRows = rows.map((entry, index) => (
                          index === rowIndex ? { ...entry, [nestedField.key]: nextValue } : entry
                        ));
                        onChange(nextRows);
                      }}
                      referenceOptions={referenceOptions}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldPath}>{label}</Label>
      <Input
        id={fieldPath}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function buildInitialValues(schema: ContentCategorySchemaDefinition, seed?: Record<string, unknown>): ContentValues {
  const values: ContentValues = {};
  for (const field of schema.fields ?? []) {
    const seededValue = seed?.[field.key];
    if (seededValue !== undefined) {
      values[field.key] = seededValue;
      continue;
    }

    if (field.type === 'object_list' || field.type === 'content_reference_list') {
      values[field.key] = [];
    } else if (field.type === 'boolean') {
      values[field.key] = false;
    } else {
      values[field.key] = '';
    }
  }
  return values;
}

function flattenReferenceFields(schema: ContentCategorySchemaDefinition, prefix = ''): Array<{ path: string; field: ContentCategorySchemaField }> {
  const entries: Array<{ path: string; field: ContentCategorySchemaField }> = [];
  for (const field of schema.fields ?? []) {
    const path = prefix ? `${prefix}.${field.key}` : field.key;
    if (field.type === 'content_reference' || field.type === 'content_reference_list') {
      entries.push({ path, field });
    }
    if (field.type === 'object_list' && field.object_schema) {
      entries.push(...flattenReferenceFields(field.object_schema, path));
    }
  }
  return entries;
}

function resolveAllowedCategoryIds(
  field: ContentCategorySchemaField,
  category: ContentCategory,
  categoriesByName: Map<string, ContentCategory>,
) {
  if (category.kind === 'generic') {
    return [category.id];
  }

  const names = Array.isArray(field.allowed_categories) ? field.allowed_categories : [];
  return names
    .map((name) => categoriesByName.get(name)?.id)
    .filter((id): id is string => Boolean(id));
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (part) => part.toUpperCase());
}

function asObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
