import { useState } from 'react';
import { Check, CircleArrowLeft, Edit3, Plus, Trash2 } from 'lucide-react';

import { contentCategoriesApi } from '../../api/contentCategoriesApi';
import type {
  ContentCategory,
  ContentCategoryFieldType,
  ContentCategorySchemaDefinition,
  ContentCategorySchemaField,
} from '../../api/models';
import { humanizeSchemaKey, isExpressionFieldType, isReferenceFieldType, SCHEMA_FIELD_TYPES } from '../../types/schemaFields';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { useToast } from '../ui/toastProvider';

type FieldForm = {
  key: string;
  label: string;
  type: ContentCategoryFieldType;
  required: boolean;
  allowedCategories: string[];
  includeQuantity: boolean;
};

type Props = {
  category: ContentCategory;
  packCategories: ContentCategory[];
  onSaved: (category: ContentCategory) => Promise<void> | void;
  onCancel: () => void;
};

const emptyField: FieldForm = {
  key: '',
  label: '',
  type: 'string',
  required: false,
  allowedCategories: [],
  includeQuantity: true,
};

export function SchemaBuilder({ category, packCategories, onSaved, onCancel }: Props) {
  const { toastPromise } = useToast();
  const [fields, setFields] = useState<ContentCategorySchemaField[]>(() => cloneFields(category.active_schema_definition?.fields ?? defaultFields(category.kind)));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState<FieldForm>(emptyField);
  const [error, setError] = useState<string | null>(null);
  const isEditing = editingIndex !== null;
  const selectableCategories = packCategories.filter((entry) => entry.id !== category.id);

  const beginAdd = () => {
    setEditingIndex(null);
    setFieldForm(emptyField);
    setError(null);
  };

  const beginEdit = (field: ContentCategorySchemaField, index: number) => {
    setEditingIndex(index);
    setFieldForm(fieldToForm(field));
    setError(null);
  };

  const cancelFieldEdit = () => {
    setEditingIndex(null);
    setFieldForm(emptyField);
    setError(null);
  };

  const saveField = () => {
    try {
      const field = buildField(fieldForm, category.kind);
      const duplicateIndex = fields.findIndex((entry) => entry.key === field.key);
      if (duplicateIndex >= 0 && duplicateIndex !== editingIndex) {
        throw new Error(`A field with key \`${field.key}\` already exists.`);
      }

      setFields((current) => {
        if (editingIndex === null) return [...current, field];
        return current.map((entry, index) => (index === editingIndex ? field : entry));
      });
      cancelFieldEdit();
    } catch (err) {
      setError((err as Error).message || 'Unable to save this field.');
    }
  };

  const removeField = (index: number) => {
    if (fields[index]?.key === 'name') return;
    setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index));
    if (editingIndex === index) cancelFieldEdit();
  };

  const saveSchema = async () => {
    try {
      const schemaDefinition = { fields };
      validateSchema(schemaDefinition, category.kind);
      const saved = await toastPromise(
        contentCategoriesApi.patch(category.id, { schema_definition: schemaDefinition }),
        {
          loading: 'Saving schema...',
          success: 'Schema saved successfully.',
          error: (err) => (err as Error)?.message || 'Unable to save schema.',
        },
      );
      await onSaved(saved);
    } catch (err) {
      setError((err as Error).message || 'Unable to save schema.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{category.kind === 'character_sheet' ? 'Character sheet category' : 'Content category'}</p>
            <h2 className="text-xl font-semibold">Build {category.name} schema</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add the fields every piece of content in this category will use.</p>
          </div>
          <Button type="button" variant="outline" onClick={onCancel} className="min-h-[44px] w-full sm:w-auto">
            <CircleArrowLeft className="h-4 w-4" /> Back to Category
          </Button>
        </div>
        <Separator className="my-5" />

        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={`${field.key}-${index}`} className="border-border">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{field.label?.trim() || humanizeSchemaKey(field.key)}</p>
                  <p className="text-sm text-muted-foreground"><code>{field.key}</code> · {field.type}{field.required ? ' · Required' : ''}</p>
                  {field.type === 'object_list' ? <p className="mt-1 text-xs text-muted-foreground">References: {objectListCategories(field).join(', ') || 'same category'}</p> : null}
                  {isReferenceFieldType(field.type) && field.allowed_categories?.length ? <p className="mt-1 text-xs text-muted-foreground">Allowed: {field.allowed_categories.join(', ')}</p> : null}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button type="button" variant="secondary" size="sm" onClick={() => beginEdit(field, index)}>
                    <Edit3 className="h-4 w-4 sm:mr-2" /> Edit
                  </Button>
                  <Button type="button" variant="destructive" size="sm" disabled={field.key === 'name'} onClick={() => removeField(index)}>
                    <Trash2 className="h-4 w-4 sm:mr-2" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-4 border-dashed border-border">
          <CardHeader>
            <CardTitle className="text-base">{isEditing ? 'Edit field' : 'Add field'}</CardTitle>
            <CardDescription>Field types control how content is rendered and validated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="schema-key">Field key</Label><Input id="schema-key" value={fieldForm.key} onChange={(event) => setFieldForm((current) => ({ ...current, key: event.target.value }))} placeholder="max_hp" /></div>
              <div className="grid gap-2"><Label htmlFor="schema-label">Label</Label><Input id="schema-label" value={fieldForm.label} onChange={(event) => setFieldForm((current) => ({ ...current, label: event.target.value }))} placeholder="Max HP" /></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="schema-type">Field type</Label><select id="schema-type" value={fieldForm.type} onChange={(event) => setFieldForm((current) => ({ ...current, type: event.target.value as ContentCategoryFieldType }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{SCHEMA_FIELD_TYPES.map((type) => <option key={type} value={type}>{humanizeSchemaKey(type)}</option>)}</select></div>
            <label className="flex min-h-[44px] items-center gap-3"><Checkbox checked={fieldForm.required} onCheckedChange={(checked) => setFieldForm((current) => ({ ...current, required: Boolean(checked) }))} /><span className="text-sm font-medium">Required field</span></label>

            {isReferenceFieldType(fieldForm.type) ? <CategoryChoices category={category} categories={selectableCategories} selected={fieldForm.allowedCategories} onChange={(allowedCategories) => setFieldForm((current) => ({ ...current, allowedCategories }))} /> : null}
            {fieldForm.type === 'object_list' ? <><CategoryChoices category={category} categories={selectableCategories} selected={fieldForm.allowedCategories} onChange={(allowedCategories) => setFieldForm((current) => ({ ...current, allowedCategories }))} title="Content categories in this list" /><label className="flex min-h-[44px] items-center gap-3"><Checkbox checked={fieldForm.includeQuantity} onCheckedChange={(checked) => setFieldForm((current) => ({ ...current, includeQuantity: Boolean(checked) }))} /><span className="text-sm font-medium">Include a quantity field</span></label></> : null}
            {isExpressionFieldType(fieldForm.type) ? <p className="text-sm text-muted-foreground">{fieldForm.type === 'formula' ? 'Formulas use stable character-sheet field keys, such as max_hp + 20.' : 'Dice values render as rollable dice expressions.'}</p> : null}
            {error ? <p className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={isEditing ? cancelFieldEdit : beginAdd}>{isEditing ? 'Cancel Edit' : 'Clear'}</Button><Button type="button" onClick={saveField}><Plus className="h-4 w-4" />{isEditing ? 'Update Field' : 'Add Field'}</Button></div>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={() => void saveSchema()}><Check className="h-4 w-4" /> Save Schema</Button>
        </div>
      </div>
    </div>
  );
}

function CategoryChoices({ category, categories, selected, onChange, title = 'Allowed content categories' }: { category: ContentCategory; categories: ContentCategory[]; selected: string[]; onChange: (selected: string[]) => void; title?: string }) {
  if (category.kind === 'generic') return <p className="text-sm text-muted-foreground">Generic content can only reference content in this same category.</p>;
  return <div className="grid gap-2"><Label>{title}</Label><div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">{categories.length ? categories.map((entry) => <label key={entry.id} className="flex min-h-[36px] items-center gap-2 text-sm"><Checkbox checked={selected.includes(entry.name)} onCheckedChange={(checked) => onChange(checked ? [...selected, entry.name] : selected.filter((name) => name !== entry.name))} />{entry.name}</label>) : <p className="text-sm text-muted-foreground">Create another category first.</p>}</div></div>;
}

function defaultFields(kind: string): ContentCategorySchemaField[] {
  if (kind === 'character_sheet') return [
    { key: 'name', label: 'Name', type: 'string', required: true },
    { key: 'max_hp', label: 'Max HP', type: 'number' }, { key: 'hp', label: 'Current HP', type: 'number' },
    { key: 'mp', label: 'MP', type: 'number' }, { key: 'ep', label: 'EP', type: 'number' },
    { key: 'gold', label: 'Gold', type: 'number' }, { key: 'traits', label: 'Traits / Features', type: 'text' },
  ];
  return [{ key: 'name', label: 'Name', type: 'string', required: true }];
}

function cloneFields(fields: ContentCategorySchemaField[]) { return JSON.parse(JSON.stringify(fields)) as ContentCategorySchemaField[]; }
function objectListCategories(field: ContentCategorySchemaField) { const item = field.object_schema?.fields.find((nested) => nested.key === 'item'); return item?.allowed_categories ?? []; }
function fieldToForm(field: ContentCategorySchemaField): FieldForm { const objectItem = field.object_schema?.fields.find((nested) => nested.key === 'item'); return { key: field.key, label: field.label ?? '', type: field.type as ContentCategoryFieldType, required: Boolean(field.required), allowedCategories: field.type === 'object_list' ? objectItem?.allowed_categories ?? [] : field.allowed_categories ?? [], includeQuantity: Boolean(field.object_schema?.fields.some((nested) => nested.key === 'quantity')) }; }
function buildField(form: FieldForm, kind: string): ContentCategorySchemaField { const key = form.key.trim(); if (!key) throw new Error('A field key is required.'); if (/\s/.test(key)) throw new Error('Field keys cannot contain spaces.'); const field: ContentCategorySchemaField = { key, type: form.type }; if (form.label.trim()) field.label = form.label.trim(); if (form.required) field.required = true; if (isReferenceFieldType(form.type) && kind === 'character_sheet') { if (!form.allowedCategories.length) throw new Error('Choose at least one allowed category.'); field.allowed_categories = form.allowedCategories; } if (form.type === 'object_list') { if (kind === 'character_sheet' && !form.allowedCategories.length) throw new Error('Choose at least one category for this list.'); field.object_schema = { fields: [{ key: 'item', label: 'Item', type: 'content_reference', required: true, ...(kind === 'character_sheet' ? { allowed_categories: form.allowedCategories } : {}) }, ...(form.includeQuantity ? [{ key: 'quantity', label: 'Quantity', type: 'number' as const }] : [])] }; } return field; }
function validateSchema(schema: ContentCategorySchemaDefinition, kind: string) { if (!schema.fields.length) throw new Error('Add at least the default Name field before saving.'); const keys = new Set<string>(); for (const field of schema.fields) { if (keys.has(field.key)) throw new Error(`Schema contains duplicate key \`${field.key}\`.`); keys.add(field.key); if (kind === 'character_sheet' && isReferenceFieldType(field.type) && !field.allowed_categories?.length) throw new Error(`Choose allowed categories for \`${field.key}\`.`); } if (!keys.has('name')) throw new Error('A schema must include the default Name field.'); }
