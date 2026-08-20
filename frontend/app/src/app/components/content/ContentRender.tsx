import { AlertCircle } from 'lucide-react';

import type { ContentCategory, ContentCategorySchemaDefinition, ContentCategorySchemaField } from '../../api/models';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { cn } from '../ui/utils';
import {
  coerceExpressionValue,
  humanizeSchemaKey,
  isExpressionFieldType,
} from '../../types/schemaFields';

export type ContentRenderMode = 'compact' | 'full';
export type ContentRenderVisibility = 'player' | 'gm';

export type ContentRollContext = {
  source: 'schema_field';
  fieldId?: string;
  label?: string;
};

export type ContentRenderProps = {
  fields: Record<string, unknown>;
  category?: Pick<ContentCategory, 'kind' | 'name' | 'active_schema_definition'> | null;
  contentName?: string;
  summary?: string | null;
  mode?: ContentRenderMode;
  visibility?: ContentRenderVisibility;
  className?: string;
  onRoll?: (expression: string, context?: ContentRollContext) => void;
};

export function ContentRender({
  fields,
  category,
  contentName,
  summary,
  mode = 'full',
  className,
  onRoll,
}: ContentRenderProps) {
  const schema = category?.active_schema_definition;
  if (!category || !schema) {
    return (
      <UnknownContentRender
        fields={fields}
        contentName={contentName}
        summary={summary}
        mode={mode}
        className={className}
      />
    );
  }

  return category.kind === 'character_sheet'
    ? (
      <CharacterSheetContentRender
        fields={fields}
        schema={schema}
        contentName={contentName}
        summary={summary}
        mode={mode}
        className={className}
        onRoll={onRoll}
      />
    )
    : (
      <GenericContentRender
        fields={fields}
        schema={schema}
        contentName={contentName}
        summary={summary}
        mode={mode}
        className={className}
        onRoll={onRoll}
      />
    );
}

function GenericContentRender({
  fields,
  schema,
  contentName,
  summary,
  mode,
  className,
  onRoll,
}: Omit<ContentRenderProps, 'category' | 'visibility'> & { schema: ContentCategorySchemaDefinition }) {
  if (mode === 'compact') {
    return (
      <Card className={cn('gap-3 rounded-md border-border bg-background shadow-none', className)}>
        <CardHeader className="gap-2 px-4 pt-4">
          <CardTitle className="text-base">{contentName || displayFieldValue(fields.name) || 'Untitled content'}</CardTitle>
          {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          {schema.fields.slice(0, 4).map((field) => (
            <FieldSummary key={field.key} field={field} value={fields[field.key]} onRoll={onRoll} />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <article className={cn('space-y-6 rounded-md border border-border bg-background px-5 py-5 shadow-none sm:px-7', className)}>
      <header className="space-y-3 border-b border-border pb-5">
        <CardTitle className="text-lg">{contentName || displayFieldValue(fields.name) || 'Untitled content'}</CardTitle>
        {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
      </header>
      <div className="space-y-4">
        {schema.fields.map((field) => (
          <SchemaFieldBlock key={field.key} field={field} value={fields[field.key]} onRoll={onRoll} />
        ))}
      </div>
    </article>
  );
}

function CharacterSheetContentRender({
  fields,
  schema,
  contentName,
  summary,
  mode,
  className,
  onRoll,
}: Omit<ContentRenderProps, 'category' | 'visibility'> & { schema: ContentCategorySchemaDefinition }) {
  const statFields = schema.fields.filter((field) => field.type !== 'object_list' && field.type !== 'text');
  const detailFields = schema.fields.filter((field) => !statFields.includes(field));

  return (
    <article className={cn('space-y-6 rounded-md border border-border bg-background px-5 py-5 shadow-none sm:px-7', className)}>
      <header className="space-y-3 border-b border-border pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Character Sheet Template</p>
        <CardTitle className={cn(mode === 'compact' ? 'text-lg' : 'text-2xl')}>
          {contentName || displayFieldValue(fields.name) || 'Untitled sheet'}
        </CardTitle>
        {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
      </header>
      {statFields.length ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statFields.map((field) => (
            <Card key={field.key} className="border-border shadow-none">
              <CardContent className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{field.label || humanizeSchemaKey(field.key)}</p>
                <SchemaFieldValue field={field} value={fields[field.key]} onRoll={onRoll} compact />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
      {detailFields.length ? (
        <section className="space-y-4">
          {detailFields.map((field) => (
            <SchemaFieldBlock key={field.key} field={field} value={fields[field.key]} onRoll={onRoll} />
          ))}
        </section>
      ) : null}
    </article>
  );
}

function FieldSummary({
  field,
  value,
  onRoll,
}: {
  field: ContentCategorySchemaField;
  value: unknown;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  if (value === undefined || value === '' || value === null) return null;
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{field.label || humanizeSchemaKey(field.key)}</span>
      <div className="text-right">
        <SchemaFieldValue field={field} value={value} onRoll={onRoll} compact />
      </div>
    </div>
  );
}

function SchemaFieldBlock({
  field,
  value,
  onRoll,
}: {
  field: ContentCategorySchemaField;
  value: unknown;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  return (
    <section className="space-y-2 rounded-md border border-border bg-muted/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{field.label || humanizeSchemaKey(field.key)}</h3>
        <Badge variant="outline">{field.type}</Badge>
        {field.required ? <Badge variant="secondary">Required</Badge> : null}
      </div>
      <SchemaFieldValue field={field} value={value} onRoll={onRoll} />
    </section>
  );
}

function SchemaFieldValue({
  field,
  value,
  onRoll,
  compact = false,
}: {
  field: ContentCategorySchemaField;
  value: unknown;
  onRoll?: ContentRenderProps['onRoll'];
  compact?: boolean;
}) {
  if (value === undefined || value === '' || value === null) {
    return <span className="text-sm text-muted-foreground">Not set</span>;
  }

  if (field.type === 'boolean') {
    return <span className="text-sm">{value === true ? 'Yes' : 'No'}</span>;
  }

  if (field.type === 'content_reference') {
    return <Badge variant="outline">{String(value)}</Badge>;
  }

  if (field.type === 'content_reference_list' && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item) => <Badge key={String(item)} variant="outline">{String(item)}</Badge>)}
      </div>
    );
  }

  if (field.type === 'object_list' && Array.isArray(value)) {
    const nestedFields = field.object_schema?.fields ?? [];
    return (
      <div className="space-y-3">
        {value.length === 0 ? <span className="text-sm text-muted-foreground">No entries yet.</span> : null}
        {value.map((row, index) => (
          <div key={`${field.key}-${index}`} className="rounded-md border border-border bg-background p-3">
            <div className="space-y-2">
              {nestedFields.map((nestedField) => (
                <div key={`${index}-${nestedField.key}`} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{nestedField.label || humanizeSchemaKey(nestedField.key)}</span>
                  <SchemaFieldValue field={nestedField} value={isRecord(row) ? row[nestedField.key] : undefined} onRoll={onRoll} compact />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isExpressionFieldType(field.type)) {
    const expression = coerceExpressionValue(value, field.type, field.label);
    return (
      <div className={cn('flex flex-wrap items-center gap-2', compact && 'justify-end')}>
        <span className="text-sm">{expression.expression || 'No expression set'}</span>
        {expression.expression && onRoll ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRoll(expression.expression, { source: 'schema_field', fieldId: field.key, label: field.label || field.key })}
          >
            Roll
          </Button>
        ) : null}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return <span className="text-sm">{value.map(displayFieldValue).join(', ')}</span>;
  }

  if (isRecord(value)) {
    return (
      <pre className="max-h-48 overflow-auto rounded-md border border-border bg-background p-3 text-xs">
        {safeJson(value)}
      </pre>
    );
  }

  return <span className="text-sm">{displayFieldValue(value)}</span>;
}

function UnknownContentRender({
  fields,
  contentName,
  summary,
  mode,
  className,
}: Omit<ContentRenderProps, 'category' | 'visibility' | 'onRoll'>) {
  return (
    <Alert className={cn('rounded-md bg-background', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{contentName || 'Content'}</AlertTitle>
      <AlertDescription>
        {summary ? <p>{summary}</p> : null}
        {mode === 'full' ? (
          <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
            {safeJson(fields)}
          </pre>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function displayFieldValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
