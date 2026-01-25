import { Character, Content, CharacterContentInstance, ContentCategoryDefinition } from '../../types/game';

/**
 * Get all descendant category IDs (including the parent itself)
 */
export function getAllDescendantCategoryIds(
  categoryId: string,
  contentCategories: ContentCategoryDefinition[]
): string[] {
  const descendants = [categoryId];
  const subcategories = contentCategories.filter((c) => c.parentId === categoryId);
  
  subcategories.forEach((subcat) => {
    descendants.push(...getAllDescendantCategoryIds(subcat.id, contentCategories));
  });
  
  return descendants;
}

/**
 * Get content definition by ID
 */
export function getContentDef(contentId: string, content: Content[]) {
  return content.find((c) => c.id === contentId);
}

/**
 * Initialize field values with defaults for a content instance
 */
export function initializeFieldValues(contentDef: Content): Record<string, number | string | string[]> {
  const fieldValues: Record<string, number | string | string[]> = {};
  
  contentDef.fields.forEach((field) => {
    if (field.type === 'numeric') {
      fieldValues[field.id] = field.defaultValue ?? 0;
    } else if (field.type === 'content_list') {
      fieldValues[field.id] = [];
    } else {
      fieldValues[field.id] = '';
    }
  });
  
  return fieldValues;
}

/**
 * Create a new content instance
 */
export function createContentInstance(contentId: string, content: Content[]): CharacterContentInstance {
  const contentDef = getContentDef(contentId, content);
  if (!contentDef) {
    throw new Error(`Content definition not found: ${contentId}`);
  }

  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    contentId,
    fieldValues: initializeFieldValues(contentDef),
  };
}

/**
 * Get top-level instances (instances not referenced by other instances)
 */
export function getTopLevelInstances(
  character: Character,
  content: Content[]
): CharacterContentInstance[] {
  // Get all referenced instance IDs
  const referencedInstanceIds = new Set<string>();
  
  character.contentInstances.forEach((instance) => {
    const contentDef = getContentDef(instance.contentId, content);
    if (!contentDef) return;

    contentDef.fields.forEach((field) => {
      if (field.type === 'content') {
        const refId = instance.fieldValues[field.id] as string;
        if (refId) referencedInstanceIds.add(refId);
      } else if (field.type === 'content_list') {
        const refIds = instance.fieldValues[field.id] as string[];
        if (refIds) refIds.forEach((id) => referencedInstanceIds.add(id));
      }
    });
  });

  // Return only instances that are not referenced
  return character.contentInstances.filter(
    (instance) => !referencedInstanceIds.has(instance.id)
  );
}

/**
 * Group instances by their category
 */
export function groupInstancesByCategory(
  instances: CharacterContentInstance[],
  content: Content[]
): Record<string, CharacterContentInstance[]> {
  const grouped: Record<string, CharacterContentInstance[]> = {};
  
  instances.forEach((instance) => {
    const contentDef = getContentDef(instance.contentId, content);
    if (!contentDef) return;

    const categoryId = contentDef.category;
    if (!grouped[categoryId]) {
      grouped[categoryId] = [];
    }
    grouped[categoryId].push(instance);
  });

  return grouped;
}
