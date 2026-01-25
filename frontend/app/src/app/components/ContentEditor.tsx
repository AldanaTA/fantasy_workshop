import { useState, useEffect } from 'react';
import { Content, ContentField, ContentCategoryDefinition, SuccessCriterion, SpendResourceEntry } from '../types/game';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Plus, Trash2, Save, X, ChevronDown, ChevronUp, Copy, Link } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

/**
 * ContentEditor allows creating and editing content with support for field inheritance.
 * When creating new content, users can select a base content to inherit fields from.
 * 
 * @param content - The content being edited, or null for new content
 * @param gameId - The ID of the game this content belongs to
 * @param contentCategories - Available content categories
 * @param allContent - All content in the game (for inheritance selection)
 * @param onSave - Callback when content is saved
 * @param onClose - Callback when editor is closed
 */
interface ContentEditorProps {
  content: Content | null;
  gameId: string;
  contentCategories: ContentCategoryDefinition[];
  allContent: Content[];
  onSave: (content: Content) => void;
  onClose: () => void;
}

export function ContentEditor({
  content,
  gameId,
  contentCategories,
  allContent,
  onSave,
  onClose,
}: ContentEditorProps) {
  const [editingContent, setEditingContent] = useState<Content | null>(content);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [selectedBaseContentId, setSelectedBaseContentId] = useState<string>('');
  const [inheritedFieldIds, setInheritedFieldIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEditingContent(content);
  }, [content]);

  if (!editingContent) return null;

  const updateField = (fieldId: string, updates: Partial<ContentField>) => {
    setEditingContent({
      ...editingContent,
      fields: editingContent.fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    });
  };

  const addField = () => {
    const newField: ContentField = {
      id: Date.now().toString(),
      name: '',
      type: 'numeric',
      defaultValue: 0,
      editable: false,
    };
    setEditingContent({
      ...editingContent,
      fields: [...editingContent.fields, newField],
    });
    // Auto-expand new field
    setExpandedFields(new Set([...expandedFields, newField.id]));
  };

  const deleteField = (fieldId: string) => {
    setEditingContent({
      ...editingContent,
      fields: editingContent.fields.filter((f) => f.id !== fieldId),
    });
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const fields = [...editingContent.fields];
    const index = fields.findIndex((f) => f.id === fieldId);
    if (index < 0) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    // Swap fields
    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];

    setEditingContent({
      ...editingContent,
      fields,
    });
  };

  const copyField = (fieldId: string) => {
    const field = editingContent.fields.find((f) => f.id === fieldId);
    if (!field) return;

    // Create a deep copy with a new ID
    const copiedField: ContentField = {
      ...field,
      id: Date.now().toString(),
      name: `${field.name} (Copy)`,
      // Deep copy arrays if they exist
      successCriteria: field.successCriteria?.map(c => ({ ...c, id: `${Date.now()}-${c.id}` })),
      spendResources: field.spendResources?.map(r => ({ ...r, id: `${Date.now()}-${r.id}` })),
    };

    // Insert after the original field
    const index = editingContent.fields.findIndex((f) => f.id === fieldId);
    const newFields = [...editingContent.fields];
    newFields.splice(index + 1, 0, copiedField);

    setEditingContent({
      ...editingContent,
      fields: newFields,
    });

    // Auto-expand the copied field
    setExpandedFields(new Set([...expandedFields, copiedField.id]));
    
    toast.success('Field copied!');
  };

  const handleSave = () => {
    // Validate
    if (!editingContent.name.trim()) {
      toast.error('Content name is required');
      return;
    }
    if (!editingContent.category) {
      toast.error('Category is required');
      return;
    }

    // Validate fields
    for (const field of editingContent.fields) {
      if (!field.name.trim()) {
        toast.error('All fields must have a name');
        return;
      }
    }

    onSave(editingContent);
    onClose();
  };

  const toggleFieldExpanded = (fieldId: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedFields(newExpanded);
  };

  const getCategoryPath = (categoryId: string): string => {
    const category = contentCategories.find((c) => c.id === categoryId);
    if (!category) return 'Unknown';
    if (!category.parentId) return category.name;
    
    const parent = contentCategories.find((c) => c.id === category.parentId);
    return parent ? `${parent.name} > ${category.name}` : category.name;
  };

  const moveCriterion = (fieldId: string, criterionId: string, direction: 'up' | 'down') => {
    const field = editingContent.fields.find((f) => f.id === fieldId);
    if (!field || !field.successCriteria) return;

    const criteria = [...field.successCriteria].sort((a, b) => a.order - b.order);
    const index = criteria.findIndex((c) => c.id === criterionId);
    if (index < 0) return;

    let newIndex: number;
    if (direction === 'up') {
      newIndex = Math.max(0, index - 1);
    } else {
      newIndex = Math.min(criteria.length - 1, index + 1);
    }

    if (newIndex === index) return;

    // Swap the two criteria
    const [movedCriterion] = criteria.splice(index, 1);
    criteria.splice(newIndex, 0, movedCriterion);

    // Reassign order values based on new positions
    const reorderedCriteria = criteria.map((c, idx) => ({
      ...c,
      order: idx + 1,
    }));

    updateField(fieldId, { successCriteria: reorderedCriteria });
  };

  const removeCriterion = (fieldId: string, criterionId: string) => {
    const field = editingContent.fields.find((f) => f.id === fieldId);
    if (!field || !field.successCriteria) return;

    const newCriteria = field.successCriteria.filter((c) => c.id !== criterionId);
    updateField(fieldId, { successCriteria: newCriteria });
  };

  const addCriterion = (fieldId: string) => {
    const field = editingContent.fields.find((f) => f.id === fieldId);
    if (!field) return;

    const newCriterion: SuccessCriterion = {
      id: Date.now().toString(),
      formula: '',
      label: 'Success',
      order: (field.successCriteria?.length ?? 0) + 1,
    };
    updateField(fieldId, {
      successCriteria: [...(field.successCriteria ?? []), newCriterion],
    });
  };

  const addSpendResource = (fieldId: string) => {
    const field = editingContent.fields.find((f) => f.id === fieldId);
    if (!field) return;

    const newResource: SpendResourceEntry = {
      id: Date.now().toString(),
      resourcePath: '',
      amountFormula: '',
    };
    updateField(fieldId, {
      spendResources: [...(field.spendResources ?? []), newResource],
    });
  };

  const removeSpendResource = (fieldId: string, resourceId: string) => {
    const field = editingContent.fields.find((f) => f.id === fieldId);
    if (!field || !field.spendResources) return;

    const newResources = field.spendResources.filter((r) => r.id !== resourceId);
    updateField(fieldId, { spendResources: newResources });
  };

  const applyInheritance = () => {
    const baseContent = allContent.find(c => c.id === selectedBaseContentId);
    if (!baseContent) {
      toast.error('Please select a base content');
      return;
    }

    // Create deep copies of fields with new IDs
    const timestamp = Date.now();
    const newFields: ContentField[] = baseContent.fields.map((field, index) => {
      const newField: ContentField = {
        ...field,
        id: `${timestamp}-${index}`,
        // Deep copy nested arrays
        successCriteria: field.successCriteria?.map((c, i) => ({ 
          ...c, 
          id: `${timestamp}-${index}-sc-${i}` 
        })),
        spendResources: field.spendResources?.map((r, i) => ({ 
          ...r, 
          id: `${timestamp}-${index}-sr-${i}` 
        })),
      };
      return newField;
    });

    setEditingContent({
      ...editingContent,
      baseContentId: selectedBaseContentId,
      fields: newFields,
    });

    // Mark all fields as inherited
    setInheritedFieldIds(new Set(newFields.map(f => f.id)));
    
    // Auto-expand all inherited fields
    setExpandedFields(new Set(newFields.map(f => f.id)));
    
    toast.success(`Inherited ${newFields.length} field${newFields.length !== 1 ? 's' : ''} from ${baseContent.name}`);
  };

  const removeInheritance = (fieldId: string) => {
    setInheritedFieldIds(new Set([...inheritedFieldIds].filter(id => id !== fieldId)));
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 sticky top-0 bg-background py-4 border-b z-10">
            <h2 className="text-xl sm:text-2xl font-bold">
              {content?.id ? 'Edit Content' : 'New Content'}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="shrink-0">
                <X className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button onClick={handleSave} className="shrink-0">
                <Save className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Save</span>
                <span className="sm:hidden">Save</span>
              </Button>
            </div>
          </div>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name *</label>
                <Input
                  value={editingContent.name}
                  onChange={(e) =>
                    setEditingContent({ ...editingContent, name: e.target.value })
                  }
                  placeholder="e.g., Fireball, Health Potion, Goblin"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Category *</label>
                <select
                  value={editingContent.category}
                  onChange={(e) =>
                    setEditingContent({ ...editingContent, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Select category...</option>
                  {contentCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {getCategoryPath(cat.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">
                  Description (Markdown)
                </label>
                <RichTextEditor
                  value={editingContent.description}
                  onChange={(value) =>
                    setEditingContent({ ...editingContent, description: value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Inheritance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inheritance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Base Content (optional)</label>
                <select
                  value={selectedBaseContentId}
                  onChange={(e) => setSelectedBaseContentId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Select base content...</option>
                  {allContent.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Button
                  onClick={applyInheritance}
                  disabled={!selectedBaseContentId}
                  className="w-full"
                >
                  <Link className="w-4 h-4 mr-2" />
                  Apply Inheritance
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Fields</CardTitle>
                <Button onClick={addField} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {editingContent.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No fields yet. Add fields to define data for this content.
                </p>
              ) : (
                <div className="space-y-3">
                  {editingContent.fields.map((field, index) => {
                    const isExpanded = expandedFields.has(field.id);
                    
                    return (
                      <div
                        key={field.id}
                        className="border rounded-lg overflow-hidden"
                      >
                        {/* Field Header - Always Visible */}
                        <div
                          className="p-3 bg-muted/30 flex items-center justify-between gap-2"
                        >
                          <div 
                            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                            onClick={() => toggleFieldExpanded(field.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate flex items-center gap-2">
                                {field.name || `Field ${index + 1}`}
                                {inheritedFieldIds.has(field.id) && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Link className="w-3 h-3 mr-1" />
                                    Inherited
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {field.type}
                                {field.mechanicType && ` • ${field.mechanicType}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(field.id, 'up');
                              }}
                              disabled={index === 0}
                              className="h-8 w-8 p-0"
                              title="Move up"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(field.id, 'down');
                              }}
                              disabled={index === editingContent.fields.length - 1}
                              className="h-8 w-8 p-0"
                              title="Move down"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyField(field.id);
                              }}
                              className="h-8 w-8 p-0"
                              title="Copy field"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Delete this field?')) {
                                  deleteField(field.id);
                                }
                              }}
                              className="h-8 w-8 p-0"
                              title="Delete field"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Field Details - Collapsible */}
                        {isExpanded && (
                          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                            {/* Field Name */}
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">
                                Field Name *
                              </label>
                              <Input
                                placeholder="e.g., Strength, Damage, Cost"
                                value={field.name}
                                onChange={(e) =>
                                  updateField(field.id, { name: e.target.value })
                                }
                              />
                            </div>

                            {/* Field Type */}
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">
                                Field Type
                              </label>
                              <select
                                value={field.type}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    type: e.target.value as ContentField['type'],
                                  })
                                }
                                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                              >
                                <option value="numeric">Numeric</option>
                                <option value="string">String</option>
                                <option value="content">Content Reference</option>
                                <option value="content_list">Content List</option>
                              </select>
                            </div>

                            {/* Optional Display Label */}
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">
                                Display Label (optional)
                              </label>
                              <Input
                                placeholder="Uses field name if empty"
                                value={field.label ?? ''}
                                onChange={(e) =>
                                  updateField(field.id, { label: e.target.value || undefined })
                                }
                              />
                            </div>

                            {/* Editable Toggle */}
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`editable-${field.id}`}
                                checked={field.editable ?? false}
                                onChange={(e) =>
                                  updateField(field.id, { editable: e.target.checked })
                                }
                                className="rounded"
                              />
                              <label
                                htmlFor={`editable-${field.id}`}
                                className="text-xs text-muted-foreground cursor-pointer"
                              >
                                Players can edit (even in read-only mode)
                              </label>
                            </div>

                            {/* Built-in Mechanics */}
                            <div className="border-t pt-3">
                              <label className="text-xs text-muted-foreground block mb-1">
                                Built-in Mechanic (optional)
                              </label>
                              <select
                                value={field.mechanicType || ''}
                                onChange={(e) => {
                                  const mechanicType = e.target.value as 'roll_die' | 'roll_for_success' | 'spend_resource' | '';
                                  updateField(field.id, {
                                    mechanicType: mechanicType || undefined,
                                    rollFormula: undefined,
                                    successCriteria: mechanicType === 'roll_for_success' ? [] : undefined,
                                    spendResources: mechanicType === 'spend_resource' ? [] : undefined,
                                  });
                                }}
                                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                              >
                                <option value="">No mechanic</option>
                                {field.type === 'numeric' && (
                                  <>
                                    <option value="roll_die">Roll Die</option>
                                    <option value="roll_for_success">Roll for Success</option>
                                    <option value="spend_resource">Spend Resource</option>
                                  </>
                                )}
                                {field.type === 'string' && (
                                  <option value="roll_die">Roll Die</option>
                                )}
                              </select>
                            </div>

                            {/* Roll Die Configuration */}
                            {field.mechanicType === 'roll_die' && (
                              <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-md space-y-2">
                                <label className="text-xs text-muted-foreground block">
                                  Roll Formula
                                </label>
                                <Input
                                  placeholder="e.g., 1d20, 2d6+3, 1d20+{Strength}"
                                  value={field.rollFormula ?? ''}
                                  onChange={(e) =>
                                    updateField(field.id, { rollFormula: e.target.value || undefined })
                                  }
                                />
                                <p className="text-xs text-muted-foreground">
                                  Use {'{'}FieldName{'}'} to reference other fields. Replace spaces with _ (e.g., {'{'}field_name{'}'})
                                </p>
                              </div>
                            )}

                            {/* Roll for Success Configuration */}
                            {field.mechanicType === 'roll_for_success' && (
                              <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-md space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm font-medium">Success Criteria</label>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addCriterion(field.id)}
                                    className="h-7 px-2"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Criterion
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground italic mb-2">
                                  !!!Order matters!!! Criteria are checked from top to bottom. The first matching criterion wins.
                                </p>
                                
                                {!field.successCriteria || field.successCriteria.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2 border rounded bg-background">
                                    No criteria defined
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {field.successCriteria
                                      .sort((a, b) => a.order - b.order)
                                      .map((criterion) => (
                                        <div
                                          key={criterion.id}
                                          className="flex gap-2 items-start p-2 border rounded bg-background"
                                        >
                                          <div className="flex-1 space-y-2">
                                            <Input
                                              placeholder="Label (e.g., Critical Success)"
                                              value={criterion.label}
                                              onChange={(e) => {
                                                const updated = field.successCriteria!.map((c) =>
                                                  c.id === criterion.id
                                                    ? { ...c, label: e.target.value }
                                                    : c
                                                );
                                                updateField(field.id, { successCriteria: updated });
                                              }}
                                              className="text-sm"
                                            />
                                            <Input
                                              placeholder="Formula (e.g., 1d20 >= 20)"
                                              value={criterion.formula}
                                              onChange={(e) => {
                                                const updated = field.successCriteria!.map((c) =>
                                                  c.id === criterion.id
                                                    ? { ...c, formula: e.target.value }
                                                    : c
                                                );
                                                updateField(field.id, { successCriteria: updated });
                                              }}
                                              className="text-sm"
                                            />
                                            <label className="flex items-center gap-2 text-sm">
                                              <input
                                                type="checkbox"
                                                checked={criterion.truncate ?? false}
                                                onChange={(e) => {
                                                  const updated = field.successCriteria!.map((c) =>
                                                    c.id === criterion.id
                                                      ? { ...c, truncate: e.target.checked }
                                                      : c
                                                  );
                                                  updateField(field.id, { successCriteria: updated });
                                                }}
                                                className="rounded border-gray-300"
                                              />
                                              <span className="text-muted-foreground">
                                                Truncate (otherwise round)
                                              </span>
                                            </label>
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => moveCriterion(field.id, criterion.id, 'up')}
                                              disabled={
                                                criterion.order ===
                                                Math.min(...field.successCriteria!.map((c) => c.order))
                                              }
                                              className="h-6 w-6 p-0"
                                            >
                                              <ChevronUp className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => moveCriterion(field.id, criterion.id, 'down')}
                                              disabled={
                                                criterion.order ===
                                                Math.max(...field.successCriteria!.map((c) => c.order))
                                              }
                                              className="h-6 w-6 p-0"
                                            >
                                              <ChevronDown className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => removeCriterion(field.id, criterion.id)}
                                              className="h-6 w-6 p-0"
                                            >
                                              <Trash2 className="w-3 h-3 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Use {'{'}FieldName{'}'} to reference fields. Criteria checked in order.
                                </p>
                              </div>
                            )}

                            {/* Spend Resource Configuration */}
                            {field.mechanicType === 'spend_resource' && (
                              <div className="bg-gold-50 dark:bg-gold-950/20 p-3 rounded-md space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm font-medium">Resources to Spend/Change</label>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addSpendResource(field.id)}
                                    className="h-7 px-2"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Resource
                                  </Button>
                                </div>
                                
                                {!field.spendResources || field.spendResources.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2 border rounded bg-background">
                                    No resources configured
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {field.spendResources.map((resource) => (
                                      <div
                                        key={resource.id}
                                        className="flex gap-2 items-start p-2 border rounded bg-background"
                                      >
                                        <div className="flex-1 space-y-2">
                                          <div>
                                            <label className="text-xs text-muted-foreground block mb-1">
                                              Resource to Spend
                                            </label>
                                            <Input
                                              placeholder="e.g., {Character_Sheet.Resources.MP}"
                                              value={resource.resourcePath}
                                              onChange={(e) => {
                                                const updated = field.spendResources!.map((r) =>
                                                  r.id === resource.id
                                                    ? { ...r, resourcePath: e.target.value }
                                                    : r
                                                );
                                                updateField(field.id, { spendResources: updated });
                                              }}
                                              className="text-sm"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs text-muted-foreground block mb-1">
                                              Amount to Spend
                                            </label>
                                            <Input
                                              placeholder="e.g., -11 or -5*{fireball.level}"
                                              value={resource.amountFormula}
                                              onChange={(e) => {
                                                const updated = field.spendResources!.map((r) =>
                                                  r.id === resource.id
                                                    ? { ...r, amountFormula: e.target.value }
                                                    : r
                                                );
                                                updateField(field.id, { spendResources: updated });
                                              }}
                                              className="text-sm"
                                            />
                                          </div>
                                          <div className="border-t pt-2">
                                            <label className="text-xs font-medium text-muted-foreground block mb-1">
                                              Field to Change (optional)
                                            </label>
                                            <Input
                                              placeholder="e.g., {fireball.level}"
                                              value={resource.fieldToChange ?? ''}
                                              onChange={(e) => {
                                                const updated = field.spendResources!.map((r) =>
                                                  r.id === resource.id
                                                    ? { ...r, fieldToChange: e.target.value || undefined }
                                                    : r
                                                );
                                                updateField(field.id, { spendResources: updated });
                                              }}
                                              className="text-sm"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs text-muted-foreground block mb-1">
                                              Change Amount (optional)
                                            </label>
                                            <Input
                                              placeholder="e.g., +1 or -1"
                                              value={resource.changeAmount ?? ''}
                                              onChange={(e) => {
                                                const updated = field.spendResources!.map((r) =>
                                                  r.id === resource.id
                                                    ? { ...r, changeAmount: e.target.value || undefined }
                                                    : r
                                                );
                                                updateField(field.id, { spendResources: updated });
                                              }}
                                              className="text-sm"
                                            />
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => removeSpendResource(field.id, resource.id)}
                                          className="h-6 w-6 p-0 mt-6"
                                        >
                                          <Trash2 className="w-3 h-3 text-destructive" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  <p className="font-semibold">How it works:</p>
                                  <p>• <strong>Resource to Spend:</strong> Use <code className="bg-background px-1 py-0.5 rounded">{'{'}Content.Field{'}'}</code> syntax to reference a numeric field</p>
                                  <p>• <strong>Amount to Spend:</strong> Can be a number or formula using <code className="bg-background px-1 py-0.5 rounded">{'{'}field{'}'}</code> references</p>
                                  <p>• <strong>Field to Change (optional):</strong> Another field to modify when this action is performed</p>
                                  <p>• <strong>Change Amount (optional):</strong> How much to change the field by (can use formulas)</p>
                                  <p>• Use negative numbers to reduce (-11) or positive to increase (+5)</p>
                                  <p>• Replace spaces with <code className="bg-background px-1 py-0.5 rounded">_</code> (e.g., <code className="bg-background px-1 py-0.5 rounded">{'{'}Character_Sheet.MP{'}'}</code>)</p>
                                  <p className="font-semibold mt-2">Examples:</p>
                                  <p className="pl-2">• <strong>Cast Fireball:</strong> Resource: <code className="bg-background px-1 py-0.5 rounded">{'{'}Character_Sheet.Resources.MP{'}'}</code>, Amount: <code className="bg-background px-1 py-0.5 rounded">-11</code></p>
                                  <p className="pl-2">• <strong>Level Up:</strong> Resource: <code className="bg-background px-1 py-0.5 rounded">{'{'}Character_Sheet.Resources.EXP{'}'}</code>, Amount: <code className="bg-background px-1 py-0.5 rounded">-5*{'{'}fireball.level{'}'}</code>, Field: <code className="bg-background px-1 py-0.5 rounded">{'{'}fireball.level{'}'}</code>, Change: <code className="bg-background px-1 py-0.5 rounded">+1</code></p>
                                </div>
                              </div>
                            )}

                            {/* Numeric Field Options */}
                            {field.type === 'numeric' && (
                              <>
                                <div className="border-t pt-3">
                                  <label className="text-xs text-muted-foreground block mb-1">
                                    Formula (optional - calculated value)
                                  </label>
                                  <Input
                                    placeholder="e.g., {Strength} + {Dexterity}"
                                    value={field.formula ?? ''}
                                    onChange={(e) =>
                                      updateField(field.id, { formula: e.target.value || undefined })
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    If set, value is calculated automatically
                                  </p>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-xs text-muted-foreground">Default</label>
                                    <Input
                                      placeholder="0 or {field}"
                                      value={field.defaultValue ?? ''}
                                      onChange={(e) =>
                                        updateField(field.id, {
                                          defaultValue: e.target.value || undefined,
                                        })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground">Min</label>
                                    <Input
                                      placeholder="e.g., 0"
                                      value={field.minValue ?? ''}
                                      onChange={(e) =>
                                        updateField(field.id, {
                                          minValue: e.target.value || undefined,
                                        })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground">Max</label>
                                    <Input
                                      placeholder="e.g., 100"
                                      value={field.maxValue ?? ''}
                                      onChange={(e) =>
                                        updateField(field.id, {
                                          maxValue: e.target.value || undefined,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Can use numbers or formulas (e.g., <code className="bg-background px-1 py-0.5 rounded">{'{'}Strength{'}'}*2</code>)
                                </p>
                              </>
                            )}

                            {/* Content Reference Options */}
                            {(field.type === 'content' || field.type === 'content_list') && (
                              <div className="border-t pt-3 space-y-3">
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">
                                    Allowed Category (optional)
                                  </label>
                                  <select
                                    value={field.allowedCategoryId || ''}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        allowedCategoryId: e.target.value || undefined,
                                      })
                                    }
                                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                                  >
                                    <option value="">Any category...</option>
                                    {contentCategories.map((cat) => (
                                      <option key={cat.id} value={cat.id}>
                                        {getCategoryPath(cat.id)}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">
                                    Render Depth (how many layers deep to show nested content)
                                  </label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={field.renderDepth ?? 2}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 2;
                                      updateField(field.id, {
                                        renderDepth: Math.min(Math.max(value, 1), 5),
                                      });
                                    }}
                                    className="w-full text-sm"
                                    placeholder="Default: 2 (Max: 5)"
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Default: 2 levels, Maximum: 5 levels
                                  </p>
                                </div>

                                {/* Content List Specific Options */}
                                {field.type === 'content_list' && (
                                  <>
                                    <div>
                                      <label className="text-xs text-muted-foreground block mb-1">
                                        Max Items (optional)
                                      </label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={field.maxItems ?? ''}
                                        onChange={(e) =>
                                          updateField(field.id, {
                                            maxItems: e.target.value ? parseInt(e.target.value) : undefined,
                                          })
                                        }
                                        placeholder="e.g., 5 for max 5 items"
                                        className="w-full text-sm"
                                      />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Limits how many items can be added to this list
                                      </p>
                                    </div>

                                    <div>
                                      <label className="text-xs text-muted-foreground block mb-1">
                                        Slot Label (optional)
                                      </label>
                                      <Input
                                        value={field.slotLabel ?? ''}
                                        onChange={(e) =>
                                          updateField(field.id, {
                                            slotLabel: e.target.value || undefined,
                                          })
                                        }
                                        placeholder="e.g., Slot, Spell Slot, Power Slot"
                                        className="w-full text-sm"
                                      />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        If set, displays as "Label 1", "Label 2", etc. (e.g., "Slot 1", "Slot 2")
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom Save Button (Mobile Friendly) */}
          <div className="sticky bottom-0 bg-background border-t py-4 flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save Content
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}