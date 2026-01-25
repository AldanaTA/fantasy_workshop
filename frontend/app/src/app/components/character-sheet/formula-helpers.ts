import { Character, Content, CharacterContentInstance } from '../../types/game';
import { getContentDef } from './helpers';

/**
 * Evaluate a formula for a specific instance
 * Replaces {ContentName.FieldName} references with actual values
 */
export function evaluateFormulaForInstance(
  instanceId: string,
  formula: string,
  character: Character,
  content: Content[]
): string {
  const instance = character.contentInstances.find((inst) => inst.id === instanceId);
  if (!instance) return formula;

  const contentDef = getContentDef(instance.contentId, content);
  if (!contentDef) return formula;

  let evaluatedFormula = formula;

  // Replace references like {ContentName.FieldName}
  const matches = formula.match(/\{([^}]+)\}/g);
  if (matches) {
    matches.forEach((match) => {
      const refContent = match.replace(/[{}]/g, '');
      const parts = refContent.split('.');

      if (parts.length >= 2) {
        const targetContentName = parts[0].replace(/_/g, ' ');
        const targetFieldName = parts[1];

        // Special case: Self-reference
        if (targetContentName === contentDef.name) {
          const field = contentDef.fields.find((f) => f.name === targetFieldName);
          if (field) {
            const value = instance.fieldValues[field.id];
            evaluatedFormula = evaluatedFormula.replace(match, String(value ?? 0));
          }
        } else {
          // Find the target content definition
          const targetContentDef = content.find((c) => c.name === targetContentName);
          if (targetContentDef) {
            // Find the instance
            const targetInstance = character.contentInstances.find(
              (inst) => inst.contentId === targetContentDef.id
            );

            if (targetInstance) {
              const targetField = targetContentDef.fields.find((f) => f.name === targetFieldName);
              if (targetField) {
                const value = targetInstance.fieldValues[targetField.id];
                evaluatedFormula = evaluatedFormula.replace(match, String(value ?? 0));
              }
            }
          }
        }
      }
    });
  }

  return evaluatedFormula;
}

/**
 * Evaluate a numeric formula
 */
export function evaluateNumericFormula(
  instanceId: string,
  formula: string,
  character: Character,
  content: Content[]
): number {
  try {
    const evaluatedFormula = evaluateFormulaForInstance(instanceId, formula, character, content);
    const result = Function(`"use strict"; return (${evaluatedFormula})`)();
    return Number(result);
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return 0;
  }
}

/**
 * Truncate a number (remove decimal part)
 */
export function truncateNumber(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}
