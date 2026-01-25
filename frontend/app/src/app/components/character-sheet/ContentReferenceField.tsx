import { Character, Content, CharacterContentInstance } from '../../types/game';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Trash2, Plus } from 'lucide-react';
import { getContentDef } from './helpers';

interface ContentReferenceFieldProps {
  instance: CharacterContentInstance;
  field: Content['fields'][0];
  character: Character;
  content: Content[];
  readOnly: boolean;
  depth: number;
  visitedInstances: Set<string>;
  onSelectContent: (instanceId: string, fieldId: string, categoryId?: string) => void;
  onRemoveReference: (fieldId: string) => void;
  renderContentFields: (
    instance: CharacterContentInstance,
    depth: number,
    visitedInstances: Set<string>
  ) => React.ReactNode;
}

export function ContentReferenceField({
  instance,
  field,
  character,
  content,
  readOnly,
  depth,
  visitedInstances,
  onSelectContent,
  onRemoveReference,
  renderContentFields,
}: ContentReferenceFieldProps) {
  const referenceId = instance.fieldValues[field.id] as string;
  const referencedInstance = referenceId
    ? character.contentInstances.find((inst) => inst.id === referenceId)
    : null;
  const referencedContentDef = referencedInstance
    ? getContentDef(referencedInstance.contentId, content)
    : null;

  const maxDepth = field.renderDepth ?? 2;

  if (!referenceId || !referencedInstance || !referencedContentDef) {
    // No reference set - show button to select content
    return (
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          {field.label || field.name}
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelectContent(instance.id, field.id, field.allowedCategoryId)}
          disabled={readOnly}
          className="w-full"
        >
          <Plus className="w-3 h-3 mr-1" />
          Select {field.name}
        </Button>
      </div>
    );
  }

  // Reference is set - render the referenced content
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted-foreground">{field.label || field.name}</label>
        {!readOnly && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemoveReference(field.id)}
            className="h-6 w-6 p-0"
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        )}
      </div>
      <Card className="bg-muted/50">
        <CardContent className="py-2 px-3">
          <div className="text-xs font-medium mb-1">{referencedContentDef.name}</div>
          {depth < maxDepth && referencedContentDef.fields.length > 0 && (
            <div className="space-y-1.5 text-xs">
              {renderContentFields(referencedInstance, depth + 1, new Set(visitedInstances))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
