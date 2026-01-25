import { useState } from 'react';
import { Character, Content, ContentCategoryDefinition, CharacterSheetTab } from '../types/game';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { DiceRoller } from './DiceRoller';
import { ContentPickerModal } from './ContentPickerModal';
import { LayoutCustomizer } from './LayoutCustomizer';
import {
  getTopLevelInstances,
  getAllDescendantCategoryIds,
  createContentInstance,
  getContentDef,
} from './character-sheet/helpers';
import { ContentTypeCard } from './character-sheet/ContentTypeCard';

/**
 * CharacterSheetSimple component displays and manages a character sheet using a
 * content-based system. Characters are composed of content instances organized by
 * categories and tabs. Supports custom layouts, dice rolling, and content management.
 * 
 * @param character - The character object to display and edit
 * @param onUpdate - Callback function when character is updated, receives updated character
 * @param readOnly - If true, prevents editing (defaults to false)
 * @param content - Array of all available content definitions
 * @param contentCategories - Array of content category definitions for organization
 * @returns An interactive character sheet with tabs, content cards, and management tools
 */
interface CharacterSheetProps {
  character: Character;
  onUpdate: (character: Character) => void;
  readOnly?: boolean;
  content: Content[];
  contentCategories: ContentCategoryDefinition[];
}

export function CharacterSheetSimple({
  character,
  onUpdate,
  readOnly = false,
  content,
  contentCategories,
}: CharacterSheetProps) {
  const [editingChar, setEditingChar] = useState(character);
  const [diceRollerOpen, setDiceRollerOpen] = useState(false);
  const [selectedMechanicFormula, setSelectedMechanicFormula] = useState<string>('');
  const [contentPickerOpen, setContentPickerOpen] = useState(false);
  const [contentPickerCategoryId, setContentPickerCategoryId] = useState<string | undefined>();
  const [contentReferenceField, setContentReferenceField] = useState<{
    instanceId: string;
    fieldId: string;
  } | null>(null);

  const [customizeLayoutMode, setCustomizeLayoutMode] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');

  const updateCharacter = (updates: Partial<Character>) => {
    const updated = { ...editingChar, ...updates };
    setEditingChar(updated);
    onUpdate(updated);
  };

  // Get top-level instances for display
  const topLevelInstances = getTopLevelInstances(editingChar, content);

  // Get available content from categories that appear on character sheet
  const availableContent = content.filter((c) => {
    const category = contentCategories.find((cat) => cat.id === c.category);
    return category?.appearOnCharacterSheet;
  });

  // Auto-generate layout from categories if no custom layout exists
  const getLayout = (): CharacterSheetTab[] => {
    if (editingChar.customLayout && editingChar.customLayout.length > 0) {
      return editingChar.customLayout;
    }

    // Auto-generate: one tab per top-level category that appears on character sheet
    const topLevelCategories = contentCategories.filter(
      (cat) => !cat.parentId && cat.appearOnCharacterSheet
    );

    return topLevelCategories.map((cat) => {
      // Get all descendant categories
      const allCategoryIds = getAllDescendantCategoryIds(cat.id, contentCategories);

      // Get all content types that belong to these categories
      const contentIdsInCategory = content
        .filter((c) => allCategoryIds.includes(c.category))
        .map((c) => c.id);

      return {
        id: cat.id,
        name: cat.name,
        contentIds: contentIdsInCategory,
      };
    });
  };

  const layout = getLayout();

  // Set initial active tab
  if (!activeTab && layout.length > 0) {
    setActiveTab(layout[0].id);
  }

  // Add content instance to character
  const addContentInstance = (contentId: string) => {
    try {
      const newInstance = createContentInstance(contentId, content);
      const contentDef = getContentDef(contentId, content);

      updateCharacter({
        contentInstances: [...editingChar.contentInstances, newInstance],
      });

      toast.success(`Added ${contentDef?.name}`);
    } catch (error) {
      toast.error('Error adding content');
    }
  };

  // Handle content selection for reference fields
  const handleContentReferenceSelection = (contentId: string) => {
    if (!contentReferenceField) return;

    const parentInstance = editingChar.contentInstances.find(
      (inst) => inst.id === contentReferenceField.instanceId
    );
    if (!parentInstance) return;

    const parentContentDef = getContentDef(parentInstance.contentId, content);
    if (!parentContentDef) return;

    const field = parentContentDef.fields.find((f) => f.id === contentReferenceField.fieldId);
    if (!field) return;

    try {
      const newInstance = createContentInstance(contentId, content);
      const updatedInstances = [...editingChar.contentInstances, newInstance];

      if (field.type === 'content_list') {
        // Add to the list
        const currentList = (parentInstance.fieldValues[contentReferenceField.fieldId] as string[]) || [];
        updateCharacter({
          contentInstances: updatedInstances.map((inst) =>
            inst.id === contentReferenceField.instanceId
              ? {
                  ...inst,
                  fieldValues: {
                    ...inst.fieldValues,
                    [contentReferenceField.fieldId]: [...currentList, newInstance.id],
                  },
                }
              : inst
          ),
        });
      } else {
        // Set the reference for single content field
        updateCharacter({
          contentInstances: updatedInstances.map((inst) =>
            inst.id === contentReferenceField.instanceId
              ? {
                  ...inst,
                  fieldValues: {
                    ...inst.fieldValues,
                    [contentReferenceField.fieldId]: newInstance.id,
                  },
                }
              : inst
          ),
        });
      }

      setContentReferenceField(null);
    } catch (error) {
      toast.error('Error adding content reference');
    }
  };

  // Delete content instance
  const deleteContentInstance = (instanceId: string) => {
    updateCharacter({
      contentInstances: editingChar.contentInstances.filter((inst) => inst.id !== instanceId),
    });
    toast.success('Content removed');
  };

  // Update field value
  const updateFieldValue = (instanceId: string, fieldId: string, value: number | string) => {
    updateCharacter({
      contentInstances: editingChar.contentInstances.map((inst) =>
        inst.id === instanceId
          ? {
              ...inst,
              fieldValues: {
                ...inst.fieldValues,
                [fieldId]: value,
              },
            }
          : inst
      ),
    });
  };

  // Remove content reference
  const removeContentReference = (instanceId: string, fieldId: string) => {
    const instance = editingChar.contentInstances.find((inst) => inst.id === instanceId);
    if (!instance) return;

    const referenceId = instance.fieldValues[fieldId] as string;
    if (!referenceId) return;

    // Remove the reference
    updateCharacter({
      contentInstances: editingChar.contentInstances
        .filter((inst) => inst.id !== referenceId) // Remove the referenced instance
        .map((inst) =>
          inst.id === instanceId
            ? {
                ...inst,
                fieldValues: {
                  ...inst.fieldValues,
                  [fieldId]: '',
                },
              }
            : inst
        ),
    });
  };

  // Remove item from content list
  const removeFromContentList = (instanceId: string, fieldId: string, index: number) => {
    const instance = editingChar.contentInstances.find((inst) => inst.id === instanceId);
    if (!instance) return;

    const currentList = (instance.fieldValues[fieldId] as string[]) || [];
    const removedId = currentList[index];

    // Remove the item from the list
    const newList = currentList.filter((_, i) => i !== index);

    // Remove the referenced instance and update the list
    updateCharacter({
      contentInstances: editingChar.contentInstances
        .filter((inst) => inst.id !== removedId) // Remove the referenced instance
        .map((inst) =>
          inst.id === instanceId
            ? {
                ...inst,
                fieldValues: {
                  ...inst.fieldValues,
                  [fieldId]: newList,
                },
              }
            : inst
        ),
    });
  };

  // Open content picker
  const openContentPicker = (instanceId: string, fieldId: string, categoryId?: string) => {
    setContentReferenceField({ instanceId, fieldId });
    setContentPickerCategoryId(categoryId);
    setContentPickerOpen(true);
  };

  // Save custom layout
  const saveCustomLayout = (tabs: CharacterSheetTab[]) => {
    updateCharacter({ customLayout: tabs });
    setCustomizeLayoutMode(false);
    if (tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  };

  // Render a single content type
  const renderContentType = (contentId: string) => {
    const contentDef = getContentDef(contentId, content);
    if (!contentDef) return null;

    const instances = topLevelInstances.filter((inst) => inst.contentId === contentId);
    if (instances.length === 0) return null;

    return (
      <ContentTypeCard
        key={contentId}
        contentDef={contentDef}
        instances={instances}
        character={editingChar}
        content={content}
        readOnly={readOnly}
        isTopLevel={true} // These are top-level instances and should not be deletable
        onDeleteInstance={deleteContentInstance}
        onUpdateField={updateFieldValue}
        onRemoveReference={removeContentReference}
        onRemoveFromList={removeFromContentList}
        onSelectContent={openContentPicker}
        onRollDice={(formula) => {
          setSelectedMechanicFormula(formula);
          setDiceRollerOpen(true);
        }}
        onUpdateCharacter={updateCharacter}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Layout customizer button */}
      {!readOnly && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomizeLayoutMode(true)}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Customize Layout
          </Button>
        </div>
      )}

      {/* Layout Customizer Modal */}
      {customizeLayoutMode && (
        <LayoutCustomizer
          tabs={layout}
          categories={contentCategories}
          content={content}
          onSave={saveCustomLayout}
          onClose={() => setCustomizeLayoutMode(false)}
        />
      )}

      {topLevelInstances.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            No content on character sheet yet. Add content from categories marked to appear on character sheet.
          </CardContent>
        </Card>
      ) : layout.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            No categories configured to appear on character sheet. Go to Game Creator to configure categories.
          </CardContent>
        </Card>
      ) : layout.length === 1 ? (
        // Single page view when there's only one tab
        <div className="space-y-4">
          {layout[0].contentIds.map((contentId) => renderContentType(contentId))}
        </div>
      ) : (
        // Multi-tab view when there are multiple tabs
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${layout.length}, 1fr)` }}>
            {layout.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {layout.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <div className="space-y-4">
                {tab.contentIds.map((contentId) => renderContentType(contentId))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Dice Roller Dialog */}
      <DiceRoller
        open={diceRollerOpen}
        onOpenChange={setDiceRollerOpen}
        initialFormula={selectedMechanicFormula}
      />

      {/* Content Picker Modal */}
      <ContentPickerModal
        open={contentPickerOpen}
        onOpenChange={(open) => {
          setContentPickerOpen(open);
          if (!open) {
            setContentReferenceField(null);
          }
        }}
        availableContent={availableContent}
        contentCategories={contentCategories}
        allowedCategoryId={contentPickerCategoryId}
        onSelect={contentReferenceField ? handleContentReferenceSelection : addContentInstance}
      />
    </div>
  );
}