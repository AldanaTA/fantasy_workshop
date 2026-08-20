import { useEffect, useMemo, useState } from 'react';

import { contentApi } from '../../api/contentApi';
import { contentCategoriesApi } from '../../api/contentCategoriesApi';
import type { Character, CharacterSheetInstance, ContentCategory, ContentVersion } from '../../api/models';
import { buildInitialSchemaValues } from '../../types/schemaFields';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ContentRender, type ContentRenderProps } from './ContentRender';

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
  category?: ContentCategory;
  version?: ContentVersion;
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
  const [templateState, setTemplateState] = useState<TemplateState>({ isLoading: true, error: null });

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
        const content = await contentApi.get(contentId, { signal: controller.signal });
        const category = await contentCategoriesApi.get(content.category_id, { signal: controller.signal });
        if (category.kind !== 'character_sheet') {
          throw new Error('The selected template content is not in a character sheet category.');
        }
        const version = versionNum
          ? await contentApi.getVersion(contentId, versionNum, { signal: controller.signal })
          : await contentApi.getActive(contentId, { signal: controller.signal });

        if (!controller.signal.aborted) {
          setTemplateState({ category, version, isLoading: false, error: null });
          setSheet((prev) => ({
            ...prev,
            values: {
              ...buildInitialSchemaValues(category.active_schema_definition ?? { fields: [] }),
              ...prev.values,
            },
          }));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setTemplateState({
            isLoading: false,
            error: (err as Error)?.message || 'Unable to load character sheet template.',
          });
        }
      }
    };

    void loadTemplate();
    return () => controller.abort();
  }, [sheet.template_content_id, sheet.template_version_num, templateContentId, templateVersionNum]);

  const renderedFields = useMemo(
    () => ({
      ...(templateState.version?.fields ?? {}),
      ...sheet.values,
    }),
    [sheet.values, templateState.version?.fields],
  );

  if (templateState.isLoading) {
    return <SheetStateMessage className={className} title="Loading sheet" message="Resolving the character sheet template." />;
  }

  if (templateState.error || !templateState.category || !templateState.version) {
    return (
      <RawSheetFallback
        className={className}
        character={character}
        sheet={sheet}
        error={templateState.error || 'Template unavailable.'}
      />
    );
  }

  const isEditable = mode === 'editable';

  return (
    <div className="space-y-4">
      <ContentRender
        fields={renderedFields}
        category={templateState.category}
        contentName={character.name}
        summary={character.name}
        mode="full"
        visibility={visibility}
        className={className}
        onRoll={onRoll}
      />
      {isEditable && onSave ? (
        <div className="flex justify-end">
          <Button type="button" onClick={() => onSave(sheet)}>
            Save Sheet
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function normalizeSheetInstance(
  rawSheet: Character['sheet'],
  templateContentId?: string,
  templateVersionNum?: number,
): CharacterSheetInstance {
  if (isRecord(rawSheet) && isRecord(rawSheet.values)) {
    return {
      template_content_id: typeof rawSheet.template_content_id === 'string' ? rawSheet.template_content_id : templateContentId,
      template_version_num: typeof rawSheet.template_version_num === 'number' ? rawSheet.template_version_num : templateVersionNum,
      values: rawSheet.values as Record<string, unknown>,
    };
  }

  return {
    template_content_id: templateContentId,
    template_version_num: templateVersionNum,
    values: isRecord(rawSheet) ? rawSheet : {},
  };
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
    <Alert className={className}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
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
    <Card className={className}>
      <CardHeader>
        <CardTitle>{character.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{error}</p>
      </CardHeader>
      <CardContent>
        <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
          {JSON.stringify(sheet.values, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
