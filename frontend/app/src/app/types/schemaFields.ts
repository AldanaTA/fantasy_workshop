import type { ContentCategorySchemaDefinition, ContentCategorySchemaField, ContentCategoryFieldType } from '../api/models';

export const SCHEMA_FIELD_TYPES: ContentCategoryFieldType[] = [
  'string',
  'text',
  'number',
  'boolean',
  'dice',
  'formula',
  'content_reference',
  'content_reference_list',
  'object_list',
];

export type SchemaExpressionType = 'dice' | 'formula';

export type SchemaExpressionValue = {
  type: SchemaExpressionType;
  expression: string;
  label?: string;
};

export function humanizeSchemaKey(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (part) => part.toUpperCase());
}

export function isExpressionFieldType(type: string): type is SchemaExpressionType {
  return type === 'dice' || type === 'formula';
}

export function isReferenceFieldType(type: string) {
  return type === 'content_reference' || type === 'content_reference_list';
}

export function getDefaultSchemaFieldValue(field: ContentCategorySchemaField): unknown {
  if (field.type === 'object_list' || field.type === 'content_reference_list') {
    return [];
  }
  if (field.type === 'boolean') {
    return false;
  }
  if (isExpressionFieldType(field.type)) {
    return { type: field.type, expression: '', label: field.label };
  }
  return '';
}

export function coerceExpressionValue(value: unknown, type: SchemaExpressionType, label?: string): SchemaExpressionValue {
  if (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).type === type
    && typeof (value as Record<string, unknown>).expression === 'string'
  ) {
    return value as SchemaExpressionValue;
  }

  if (typeof value === 'string') {
    return { type, expression: value, label };
  }

  return { type, expression: '', label };
}

export function buildInitialSchemaValues(
  schema: ContentCategorySchemaDefinition,
  seed?: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of schema.fields ?? []) {
    const seededValue = seed?.[field.key];
    values[field.key] = seededValue !== undefined ? seededValue : getDefaultSchemaFieldValue(field);
  }
  return values;
}

export function flattenReferenceSchemaFields(
  schema: ContentCategorySchemaDefinition,
  prefix = '',
): Array<{ path: string; field: ContentCategorySchemaField }> {
  const entries: Array<{ path: string; field: ContentCategorySchemaField }> = [];
  for (const field of schema.fields ?? []) {
    const path = prefix ? `${prefix}.${field.key}` : field.key;
    if (isReferenceFieldType(field.type)) {
      entries.push({ path, field });
    }
    if (field.type === 'object_list' && field.object_schema) {
      entries.push(...flattenReferenceSchemaFields(field.object_schema, path));
    }
  }
  return entries;
}
