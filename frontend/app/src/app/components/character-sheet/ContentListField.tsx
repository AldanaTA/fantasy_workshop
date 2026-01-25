import { Character, Content, CharacterContentInstance } from '../../types/game';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Trash2, Plus } from 'lucide-react';
import { getContentDef } from './helpers';

interface ContentListFieldProps {
  instance: CharacterContentInstance;
  field: Content['fields'][0];
  character: Character;
  content: Content[];
  readOnly: boolean;
  depth: number;
  visitedInstances: Set<string>;
  onSelectContent: (instanceId: string, fieldId: string, categoryId?: string) => void;
  onRemoveFromList: (fieldId: string, index: number) => void;
  renderContentFields: (
    instance: CharacterContentInstance,
    depth: number,
    visitedInstances: Set<string>
  ) => React.ReactNode;
}

export function ContentListField({
  instance,
  field,
  character,
  content,
  readOnly,
  depth,
  visitedInstances,
  onSelectContent,
  onRemoveFromList,
  renderContentFields,
}: ContentListFieldProps) {
  const referenceIds = (instance.fieldValues[field.id] as string[]) || [];
  const maxItems = field.maxItems;
  const canAddMore = !maxItems || referenceIds.length < maxItems;
  const maxDepth = field.renderDepth ?? 2;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted-foreground">
          {field.label || field.name}
          {maxItems && ` (${referenceIds.length}/${maxItems})`}
        </label>
        {!readOnly && canAddMore && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSelectContent(instance.id, field.id, field.allowedCategoryId)}
            className="h-6 px-2"
          >
            <Plus className="w-3 h-3 mr-1" />
            <span className="text-xs">Add</span>
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {referenceIds.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-2">
            No items yet
            {!readOnly && canAddMore && ' - click Add to add items'}
          </div>
        ) : (
          referenceIds.map((refId, index) => {
            const referencedInstance = character.contentInstances.find(
              (inst) => inst.id === refId
            );
            const referencedContentDef = referencedInstance
              ? getContentDef(referencedInstance.contentId, content)
              : null;

            if (!referencedInstance || !referencedContentDef) {
              return (
                <div key={refId} className="text-xs text-destructive">
                  Invalid reference
                </div>
              );
            }

            const slotLabel = field.slotLabel || 'Item';

            return (
              <Card key={refId} className="bg-muted/50">
                <CardContent className="py-2 px-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-xs font-medium">
                      {slotLabel} {index + 1}: {referencedContentDef.name}
                    </div>
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemoveFromList(field.id, index)}
                        className="h-5 w-5 p-0 shrink-0"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {depth < maxDepth && referencedContentDef.fields.length > 0 && (
                    <div className="space-y-1.5 text-xs">
                      {renderContentFields(
                        referencedInstance,
                        depth + 1,
                        new Set(visitedInstances)
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
