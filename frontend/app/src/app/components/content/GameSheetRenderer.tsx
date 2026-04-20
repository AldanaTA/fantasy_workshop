import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { contentApi } from '../../api/contentApi';
import type { Character, CharacterSheetInstance, ContentVersion } from '../../api/models';
import {
  CharacterSheetTemplateField,
  CharacterSheetTemplateFieldsV1,
  CharacterSheetTemplateSection,
  isCharacterSheetTemplateFieldsV1,
} from '../../types/contentFields';
import type { JSONDict, JSONValue } from '../../types/misc';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
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
import { cn } from '../ui/utils';
import type { ContentRenderProps } from './ContentRender';

export type GameSheetRendererProps = {
  character: Character;
  mode?: 'readonly' | 'editable';
  visibility?: 'player' | 'gm';
  templateContentId?: string;
  templateVersionNum?: number;
  onChange?: (nextSheet: CharacterSheetInstance) => void;
  onSave?: (nextSheet: CharacterSheetInstance) => Promise<void> | void;
  onRoll?: ContentRenderProps['onRoll'];
  className?: string;
};

type TemplateState = {
  templateVersion?: ContentVersion;
  templateFields?: CharacterSheetTemplateFieldsV1;
  isLoading: boolean;
  error: string | null;
};

export function GameSheetRenderer({
  character,
  mode = 'readonly',
  visibility = 'player',
  templateContentId,
  templateVersionNum,
  onChange,
  onSave,
  onRoll,
  className,
}: GameSheetRendererProps) {
  const [sheet, setSheet] = useState<CharacterSheetInstance>(() => normalizeSheetInstance(character.sheet, templateContentId, templateVersionNum));
  const [templateState, setTemplateState] = useState<TemplateState>({
    isLoading: true,
    error: null,
  });
  const isEditable = mode === 'editable';

  useEffect(() => {
    setSheet(normalizeSheetInstance(character.sheet, templateContentId, templateVersionNum));
  }, [character.id, character.sheet, templateContentId, templateVersionNum]);

  useEffect(() => {
    const controller = new AbortController();

    const loadTemplate = async () => {
      const contentId = sheet.template_content_id ?? templateContentId;
      const versionNum = sheet.template_version_num ?? templateVersionNum;

      if (!contentId) {
        setTemplateState({ isLoading: false, error: 'This character sheet does not reference a template.' });
        return;
      }

      setTemplateState({ isLoading: true, error: null });

      try {
        const templateVersion = versionNum
          ? await contentApi.getVersion(contentId, versionNum, { signal: controller.signal })
          : await contentApi.getActive(contentId, { signal: controller.signal });

        if (!isCharacterSheetTemplateFieldsV1(templateVersion.fields)) {
          throw new Error('The selected content version is not a character sheet template.');
        }

        if (!controller.signal.aborted) {
          setTemplateState({
            templateVersion,
            templateFields: templateVersion.fields,
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (!controller.signal.aborted) {
          setTemplateState({
            isLoading: false,
            error: (err as Error)?.message || 'Unable to load character sheet template.',
          });
        }
      }
    };

    loadTemplate();

    return () => {
      controller.abort();
    };
  }, [sheet.template_content_id, sheet.template_version_num, templateContentId, templateVersionNum]);

  const sections = useMemo(() => {
    return [...(templateState.templateFields?.sections ?? [])]
      .filter((section) => isVisibleSheetPart(section.visibility, visibility))
      .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));
  }, [templateState.templateFields, visibility]);

  const updateFieldValue = useCallback((fieldId: string, value: JSONValue) => {
    setSheet((prev) => {
      const nextSheet = {
        ...prev,
        values: {
          ...prev.values,
          [fieldId]: value,
        },
      };
      onChange?.(nextSheet);
      return nextSheet;
    });
  }, [onChange]);

  if (templateState.isLoading) {
    return <SheetStateMessage className={className} title="Loading sheet" message="Resolving the character sheet template." />;
  }

  if (templateState.error || !templateState.templateFields) {
    return (
      <RawSheetFallback
        className={className}
        character={character}
        sheet={sheet}
        error={templateState.error || 'Template unavailable.'}
      />
    );
  }

  return (
    <article className={cn('space-y-6 rounded-md border border-border bg-background px-5 py-5 shadow-none sm:px-7', className)}>
      <header className="space-y-4 border-b border-border pb-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Character Sheet
            {templateState.templateFields.system?.id ? ` / ${templateState.templateFields.system.id}` : null}
          </p>
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{character.name}</h1>
          <p className="text-base italic text-muted-foreground">
            {templateState.templateFields.title || 'Character Sheet Template'}
            {templateState.templateVersion ? `, version ${templateState.templateVersion.version_num}` : null}
          </p>
        </div>
        {templateState.templateFields.subtitle ? (
          <p className="max-w-3xl text-sm leading-7">{templateState.templateFields.subtitle}</p>
        ) : null}
        {templateState.templateFields.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {templateState.templateFields.tags.map((tag) => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
        ) : null}
      </header>

      <div className="space-y-6">
        {sections.map((section) => (
          <CharacterSheetSection
            key={section.id}
            section={section}
            values={sheet.values}
            visibility={visibility}
            isEditable={isEditable}
            onFieldChange={updateFieldValue}
            onRoll={onRoll}
          />
        ))}
      </div>

      {isEditable && onSave ? (
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="button" onClick={() => onSave(sheet)}>
            Save Sheet
          </Button>
        </div>
      ) : null}
    </article>
  );
}

const CharacterSheetSection = memo(function CharacterSheetSection({
  section,
  values,
  visibility,
  isEditable,
  onFieldChange,
  onRoll,
}: {
  section: CharacterSheetTemplateSection;
  values: JSONDict;
  visibility: 'player' | 'gm';
  isEditable: boolean;
  onFieldChange: (fieldId: string, value: JSONValue) => void;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  const fields = section.fields.filter((field) => isVisibleSheetPart(field.visibility, visibility));

  if (!fields.length) return null;

  return (
    <section className="space-y-3">
      <div className="space-y-1 border-b border-border pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{section.label}</h2>
          <SheetVisibilityBadges visibility={section.visibility} />
        </div>
        {section.description ? <p className="text-sm text-muted-foreground">{section.description}</p> : null}
      </div>
      <div className="grid gap-3">
        {fields.map((field) => (
          <CharacterSheetField
            key={field.id}
            field={field}
            value={getFieldValue(values, field)}
            isEditable={isEditable && !field.visibility?.readonly}
            onChange={(value) => onFieldChange(field.id, value)}
            onRoll={onRoll}
          />
        ))}
      </div>
    </section>
  );
}, areEqualSheetSections);

function areEqualSheetSections(
  prev: {
    section: CharacterSheetTemplateSection;
    values: JSONDict;
    visibility: 'player' | 'gm';
    isEditable: boolean;
    onFieldChange: (fieldId: string, value: JSONValue) => void;
    onRoll?: ContentRenderProps['onRoll'];
  },
  next: {
    section: CharacterSheetTemplateSection;
    values: JSONDict;
    visibility: 'player' | 'gm';
    isEditable: boolean;
    onFieldChange: (fieldId: string, value: JSONValue) => void;
    onRoll?: ContentRenderProps['onRoll'];
  },
) {
  if (
    prev.section !== next.section ||
    prev.visibility !== next.visibility ||
    prev.isEditable !== next.isEditable ||
    prev.onFieldChange !== next.onFieldChange ||
    prev.onRoll !== next.onRoll
  ) {
    return false;
  }

  return prev.section.fields.every((field) => (
    getFieldValue(prev.values, field) === getFieldValue(next.values, field)
  ));
}

const CharacterSheetField = memo(function CharacterSheetField({
  field,
  value,
  isEditable,
  onChange,
  onRoll,
}: {
  field: CharacterSheetTemplateField;
  value: JSONValue | undefined;
  isEditable: boolean;
  onChange: (value: JSONValue) => void;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted/10 p-3 md:grid-cols-[180px_1fr]">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="font-medium">{field.label}</Label>
          <Badge variant="outline">{formatLabel(field.field_type)}</Badge>
          {field.required ? <Badge variant="secondary">Required</Badge> : null}
          <SheetVisibilityBadges visibility={field.visibility} />
        </div>
        {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
      </div>
      <div className="space-y-2">
        {isEditable ? (
          <EditableSheetField field={field} value={value} onChange={onChange} onRoll={onRoll} />
        ) : (
          <ReadonlySheetField field={field} value={value} onRoll={onRoll} />
        )}
      </div>
    </div>
  );
});

function EditableSheetField({
  field,
  value,
  onChange,
  onRoll,
}: {
  field: CharacterSheetTemplateField;
  value: JSONValue | undefined;
  onChange: (value: JSONValue) => void;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  if (field.field_type === 'boolean') {
    return (
      <Checkbox
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    );
  }

  if (field.field_type === 'number' || field.field_type === 'counter') {
    return (
      <Input
        type="number"
        value={typeof value === 'number' ? String(value) : ''}
        min={field.min}
        max={field.max}
        onChange={(event) => onChange(parseNumberInput(event.target.value))}
      />
    );
  }

  if (field.field_type === 'textarea') {
    return (
      <Textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.field_type === 'select' && field.options?.length) {
    return (
      <Select value={String(value ?? '')} onValueChange={(nextValue) => onChange(parseOptionValue(field, nextValue))}>
        <SelectTrigger>
          <SelectValue placeholder="Choose an option" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => {
            const optionValue = formatJsonValue(option.value);
            return (
              <SelectItem key={optionValue} value={optionValue}>
                {option.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  if (field.field_type === 'multi_select' && field.options?.length) {
    const selected = Array.isArray(value) ? value.map(formatJsonValue) : [];
    return (
      <div className="grid gap-2">
        {field.options.map((option) => {
          const optionValue = formatJsonValue(option.value);
          return (
            <label key={optionValue} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(optionValue)}
                onCheckedChange={(checked) => {
                  const nextSelected = checked
                    ? [...selected, optionValue]
                    : selected.filter((item) => item !== optionValue);
                  onChange(nextSelected.map((item) => parseOptionValue(field, item)));
                }}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    );
  }

  if (field.field_type === 'resource' && isRecord(value)) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="number"
          value={typeof value.current === 'number' ? String(value.current) : ''}
          onChange={(event) => onChange({ ...value, current: parseNumberInput(event.target.value) })}
          placeholder="Current"
        />
        <Input
          type="number"
          value={typeof value.max === 'number' ? String(value.max) : ''}
          onChange={(event) => onChange({ ...value, max: parseNumberInput(event.target.value) })}
          placeholder="Max"
        />
      </div>
    );
  }

  const expression = getFieldExpression(field, value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(event) => onChange(event.target.value)}
      />
      {expression && onRoll ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRoll(expression, { source: 'sheet_field', fieldId: field.id, label: field.label })}
        >
          Roll
        </Button>
      ) : null}
    </div>
  );
}

function ReadonlySheetField({
  field,
  value,
  onRoll,
}: {
  field: CharacterSheetTemplateField;
  value: JSONValue | undefined;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  const expression = getFieldExpression(field, value);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {field.field_type === 'select' || field.field_type === 'multi_select' ? (
        <ReadonlyOptionsValue field={field} value={value} />
      ) : (
        <span className="text-muted-foreground">{formatSheetValue(value)}</span>
      )}
      {expression && onRoll ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRoll(expression, { source: 'sheet_field', fieldId: field.id, label: field.label })}
        >
          Roll
        </Button>
      ) : null}
    </div>
  );
}

function ReadonlyOptionsValue({ field, value }: { field: CharacterSheetTemplateField; value: JSONValue | undefined }) {
  const values = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  if (!values.length) return <span className="text-muted-foreground">Not set</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((item) => (
        <Badge key={formatJsonValue(item)} variant="outline">
          {getOptionLabel(field, item)}
        </Badge>
      ))}
    </div>
  );
}

function RawSheetFallback({
  character,
  sheet,
  error,
  className,
}: {
  character: Character;
  sheet: CharacterSheetInstance;
  error: string;
  className?: string;
}) {
  return (
    <Card className={cn('rounded-md border-border bg-background shadow-none', className)}>
      <CardHeader>
        <CardTitle>{character.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{error}</p>
      </CardHeader>
      <CardContent>
        <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
          {safeJson(sheet.values)}
        </pre>
      </CardContent>
    </Card>
  );
}

function SheetStateMessage({
  title,
  message,
  className,
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <Alert className={cn('rounded-md bg-background', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function SheetVisibilityBadges({ visibility }: { visibility?: CharacterSheetTemplateField['visibility'] }) {
  if (!visibility) return null;
  return (
    <>
      {visibility.readonly ? <Badge variant="outline">Readonly</Badge> : null}
      {visibility.role ? <Badge variant="outline">{formatLabel(visibility.role)}</Badge> : null}
      {visibility.condition ? <Badge variant="outline">Conditional</Badge> : null}
    </>
  );
}

function normalizeSheetInstance(
  sheet: Character['sheet'],
  templateContentId?: string,
  templateVersionNum?: number,
): CharacterSheetInstance {
  if (isSheetInstance(sheet)) {
    return {
      template_content_id: sheet.template_content_id ?? templateContentId,
      template_version_num: sheet.template_version_num ?? templateVersionNum,
      values: isRecord(sheet.values) ? sheet.values : {},
    };
  }

  return {
    template_content_id: templateContentId,
    template_version_num: templateVersionNum,
    values: isRecord(sheet) ? sheet : {},
  };
}

function isSheetInstance(sheet: Character['sheet']): sheet is CharacterSheetInstance {
  return isRecord(sheet) && 'values' in sheet && isRecord(sheet.values);
}

function getFieldValue(values: JSONDict, field: CharacterSheetTemplateField): JSONValue | undefined {
  return values[field.id] ?? field.default;
}

function getFieldExpression(field: CharacterSheetTemplateField, value: JSONValue | undefined) {
  if (field.field_type !== 'dice' && field.field_type !== 'formula') return undefined;
  if (typeof value === 'string' && value.trim()) return value;
  return field.formula || field.source;
}

function isVisibleSheetPart(
  visibility: CharacterSheetTemplateSection['visibility'] | CharacterSheetTemplateField['visibility'],
  role: 'player' | 'gm',
) {
  if (!visibility) return true;
  if (visibility.hidden) return false;
  if (role === 'player' && visibility.role === 'gm') return false;
  return true;
}

function parseNumberInput(value: string): JSONValue {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionValue(field: CharacterSheetTemplateField, value: string): JSONValue {
  const option = field.options?.find((candidate) => formatJsonValue(candidate.value) === value);
  return option?.value ?? value;
}

function getOptionLabel(field: CharacterSheetTemplateField, value: JSONValue) {
  return field.options?.find((option) => formatJsonValue(option.value) === formatJsonValue(value))?.label ?? formatJsonValue(value);
}

function formatSheetValue(value: JSONValue | undefined) {
  if (value === undefined || value === null || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return safeJson(value);
}

function formatJsonValue(value: JSONValue | undefined) {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return safeJson(value);
}

function formatLabel(value?: string) {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is JSONDict {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[Unserializable value]';
  }
}

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}
