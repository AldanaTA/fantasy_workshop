import { Character, Content, CharacterContentInstance } from '../../types/game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Trash2 } from 'lucide-react';
import { NumericField } from './NumericField';
import { StringField } from './StringField';
import { ContentReferenceField } from './ContentReferenceField';
import { ContentListField } from './ContentListField';
import { MechanicButton } from './MechanicButton';
import { ContentDescription } from './ContentDescription';

/**
 * ContentTypeCard displays a card for a specific content type showing all instances
 * of that content on the character sheet. Each instance can have fields for stats,
 * mechanics, and nested content references.
 * 
 * @param contentDef - The content definition/template
 * @param instances - Array of character content instances of this type
 * @param character - The full character object for accessing all data
 * @param content - Array of all available content definitions
 * @param readOnly - If true, prevents editing
 * @param isTopLevel - If true, instances cannot be deleted (used for main character stats)
 * @param onDeleteInstance - Callback to delete an instance
 * @param onUpdateField - Callback to update a field value
 * @param onRemoveReference - Callback to remove a content reference
 * @param onRemoveFromList - Callback to remove an item from a content list
 * @param onSelectContent - Callback to open content picker
 * @param onRollDice - Callback to roll dice with a formula
 * @param onUpdateCharacter - Callback to update the entire character
 * @returns A card displaying content instances with interactive fields
 */
interface ContentTypeCardProps {
  contentDef: Content;
  instances: CharacterContentInstance[];
  character: Character;
  content: Content[];
  readOnly: boolean;
  isTopLevel?: boolean; // New prop to indicate if these are top-level instances
  onDeleteInstance: (instanceId: string) => void;
  onUpdateField: (instanceId: string, fieldId: string, value: number | string) => void;
  onRemoveReference: (instanceId: string, fieldId: string) => void;
  onRemoveFromList: (instanceId: string, fieldId: string, index: number) => void;
  onSelectContent: (instanceId: string, fieldId: string, categoryId?: string) => void;
  onRollDice: (formula: string) => void;
  onUpdateCharacter: (character: Character) => void;
}

export function ContentTypeCard({
  contentDef,
  instances,
  character,
  content,
  readOnly,
  isTopLevel = false, // Default to false for nested content
  onDeleteInstance,
  onUpdateField,
  onRemoveReference,
  onRemoveFromList,
  onSelectContent,
  onRollDice,
  onUpdateCharacter,
}: ContentTypeCardProps) {
  const renderContentFields = (
    instance: CharacterContentInstance,
    depth: number,
    visitedInstances: Set<string>
  ): React.ReactNode => {
    // Prevent infinite recursion
    if (visitedInstances.has(instance.id)) {
      return (
        <div className="text-xs text-muted-foreground italic">
          (Circular reference detected)
        </div>
      );
    }

    const newVisitedInstances = new Set(visitedInstances);
    newVisitedInstances.add(instance.id);

    const instanceContentDef = content.find((c) => c.id === instance.contentId);
    if (!instanceContentDef) return null;

    return (
      <div className="space-y-2">
        {instanceContentDef.fields.map((field) => {
          const fieldKey = `${instance.id}-${field.id}`;

          if (field.type === 'numeric') {
            return (
              <div key={fieldKey}>
                <NumericField
                  instance={instance}
                  field={field}
                  character={character}
                  content={content}
                  readOnly={readOnly}
                  onUpdate={(fieldId, value) => onUpdateField(instance.id, fieldId, value)}
                />
                {field.mechanicType && (
                  <div className="mt-1">
                    <MechanicButton
                      instance={instance}
                      field={field}
                      character={character}
                      content={content}
                      readOnly={readOnly}
                      onRollDice={onRollDice}
                      onUpdateCharacter={onUpdateCharacter}
                    />
                  </div>
                )}
              </div>
            );
          }

          if (field.type === 'string') {
            return (
              <StringField
                key={fieldKey}
                instance={instance}
                field={field}
                readOnly={readOnly}
                onUpdate={(fieldId, value) => onUpdateField(instance.id, fieldId, value)}
              />
            );
          }

          if (field.type === 'content') {
            return (
              <ContentReferenceField
                key={fieldKey}
                instance={instance}
                field={field}
                character={character}
                content={content}
                readOnly={readOnly}
                depth={depth}
                visitedInstances={newVisitedInstances}
                onSelectContent={onSelectContent}
                onRemoveReference={(fieldId) => onRemoveReference(instance.id, fieldId)}
                renderContentFields={renderContentFields}
              />
            );
          }

          if (field.type === 'content_list') {
            return (
              <ContentListField
                key={fieldKey}
                instance={instance}
                field={field}
                character={character}
                content={content}
                readOnly={readOnly}
                depth={depth}
                visitedInstances={newVisitedInstances}
                onSelectContent={onSelectContent}
                onRemoveFromList={(fieldId, index) =>
                  onRemoveFromList(instance.id, fieldId, index)
                }
                renderContentFields={renderContentFields}
              />
            );
          }

          return null;
        })}
      </div>
    );
  };

  if (instances.length === 0) return null;

  return (
    <Card className="bg-muted/30">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {contentDef.name}
            {instances.length > 1 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({instances.length})
              </span>
            )}
          </CardTitle>
          {/* Only show delete button for non-top-level content */}
          {!readOnly && !isTopLevel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDeleteInstance(instances[0].id)}
              className="shrink-0 h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-3">
        {/* Description */}
        <ContentDescription contentDef={contentDef} />

        {/* Render all instances */}
        <div className="space-y-4">
          {instances.map((instance, instanceIndex) => (
            <div key={instance.id} className={instanceIndex > 0 ? 'pt-4 border-t' : ''}>
              {instances.length > 1 && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{instanceIndex + 1}
                  </span>
                  {/* Only show delete button for non-top-level content */}
                  {!readOnly && !isTopLevel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteInstance(instance.id)}
                      className="shrink-0 h-6 w-6 p-0"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
              )}
              {/* Render fields */}
              {contentDef.fields.length > 0 && renderContentFields(instance, 0, new Set())}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}