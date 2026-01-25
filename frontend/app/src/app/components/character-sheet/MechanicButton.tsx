import { Character, Content, CharacterContentInstance } from '../../types/game';
import { Button } from '../ui/button';
import { Dices, Coins } from 'lucide-react';
import { evaluateFormulaForInstance, evaluateNumericFormula, truncateNumber } from './formula-helpers';
import { getContentDef } from './helpers';
import { toast } from 'sonner';

interface MechanicButtonProps {
  instance: CharacterContentInstance;
  field: Content['fields'][0];
  character: Character;
  content: Content[];
  readOnly: boolean;
  onRollDice: (formula: string) => void;
  onUpdateCharacter: (character: Character) => void;
}

export function MechanicButton({
  instance,
  field,
  character,
  content,
  readOnly,
  onRollDice,
  onUpdateCharacter,
}: MechanicButtonProps) {
  const handleRollDie = () => {
    if (!field.rollFormula) return;
    const evaluatedFormula = evaluateFormulaForInstance(
      instance.id,
      field.rollFormula,
      character,
      content
    );
    onRollDice(evaluatedFormula);
  };

  const handleRollForSuccess = () => {
    if (!field.successCriteria || field.successCriteria.length === 0) {
      toast.error('No success criteria defined');
      return;
    }

    // Sort criteria by order
    const sortedCriteria = [...field.successCriteria].sort((a, b) => a.order - b.order);

    // Evaluate each criterion until one succeeds
    for (const criterion of sortedCriteria) {
      const evaluatedFormula = evaluateFormulaForInstance(
        instance.id,
        criterion.formula,
        character,
        content
      );

      try {
        const result = Function(`"use strict"; return (${evaluatedFormula})`)();
        if (result) {
          toast.success(`${criterion.label}: ${evaluatedFormula}`);
          return;
        }
      } catch (error) {
        console.error('Success criterion evaluation error:', error);
      }
    }

    toast.error('All criteria failed');
  };

  const handleSpendResource = () => {
    if (!field.spendResources || field.spendResources.length === 0) {
      toast.error('No spend resources defined');
      return;
    }

    let updatedCharacter = { ...character };

    // Process each resource spend entry
    for (const entry of field.spendResources) {
      // Evaluate the amount to spend
      const amountFormula = evaluateFormulaForInstance(
        instance.id,
        entry.amountFormula,
        updatedCharacter,
        content
      );

      let spendAmount: number;
      try {
        spendAmount = Function(`"use strict"; return (${amountFormula})`)();
      } catch (error) {
        toast.error(`Error evaluating spend amount: ${entry.amountFormula}`);
        return;
      }

      // Parse the resource path {ContentName.FieldName}
      const resourcePath = entry.resourcePath.replace(/[{}]/g, '');
      const parts = resourcePath.split('.');

      if (parts.length < 2) {
        toast.error(`Invalid resource path: ${entry.resourcePath}`);
        return;
      }

      const targetContentName = parts[0].replace(/_/g, ' ');
      const targetFieldName = parts[1];

      // Find the target content definition
      const targetContentDef = content.find((c) => c.name === targetContentName);
      if (!targetContentDef) {
        toast.error(`Content not found: ${targetContentName}`);
        return;
      }

      // Find the target instance
      const targetInstance = updatedCharacter.contentInstances.find(
        (inst) => inst.contentId === targetContentDef.id
      );
      if (!targetInstance) {
        toast.error(`Instance not found: ${targetContentName}`);
        return;
      }

      // Find the target field
      const targetField = targetContentDef.fields.find((f) => f.name === targetFieldName);
      if (!targetField) {
        toast.error(`Field not found: ${targetFieldName}`);
        return;
      }

      // Get current value
      const currentValue = (targetInstance.fieldValues[targetField.id] as number) || 0;
      const newValue = currentValue - spendAmount;

      // Check if we have enough resources
      if (targetField.minValue !== undefined) {
        const minValue =
          typeof targetField.minValue === 'string'
            ? evaluateNumericFormula(targetInstance.id, targetField.minValue, updatedCharacter, content)
            : targetField.minValue;

        if (newValue < minValue) {
          toast.error(`Not enough ${targetFieldName}!`);
          return;
        }
      }

      // Update the resource value
      updatedCharacter = {
        ...updatedCharacter,
        contentInstances: updatedCharacter.contentInstances.map((inst) =>
          inst.id === targetInstance.id
            ? {
                ...inst,
                fieldValues: {
                  ...inst.fieldValues,
                  [targetField.id]: newValue,
                },
              }
            : inst
        ),
      };

      // Handle field to change (if specified)
      if (entry.fieldToChange && entry.changeAmount) {
        // Parse the field to change path
        const changeFieldPath = entry.fieldToChange.replace(/[{}]/g, '');
        const changeParts = changeFieldPath.split('.');

        if (changeParts.length >= 2) {
          const changeContentName = changeParts[0].replace(/_/g, ' ');
          const changeFieldName = changeParts[1];

          // Find content and field
          const changeContentDef = content.find((c) => c.name === changeContentName);
          if (changeContentDef) {
            const changeInstance = updatedCharacter.contentInstances.find(
              (inst) => inst.contentId === changeContentDef.id
            );
            if (changeInstance) {
              const changeField = changeContentDef.fields.find((f) => f.name === changeFieldName);
              if (changeField) {
                const currentChangeValue = (changeInstance.fieldValues[changeField.id] as number) || 0;
                const changeAmountValue = parseInt(entry.changeAmount, 10) || 0;

                updatedCharacter = {
                  ...updatedCharacter,
                  contentInstances: updatedCharacter.contentInstances.map((inst) =>
                    inst.id === changeInstance.id
                      ? {
                          ...inst,
                          fieldValues: {
                            ...inst.fieldValues,
                            [changeField.id]: currentChangeValue + changeAmountValue,
                          },
                        }
                      : inst
                  ),
                };
              }
            }
          }
        }
      }
    }

    onUpdateCharacter(updatedCharacter);
    toast.success('Resources spent!');
  };

  if (field.mechanicType === 'roll_die') {
    return (
      <Button size="sm" variant="outline" onClick={handleRollDie} disabled={readOnly}>
        <Dices className="w-4 h-4 mr-1" />
        Roll
      </Button>
    );
  }

  if (field.mechanicType === 'roll_for_success') {
    return (
      <Button size="sm" variant="outline" onClick={handleRollForSuccess} disabled={readOnly}>
        <Dices className="w-4 h-4 mr-1" />
        Check
      </Button>
    );
  }

  if (field.mechanicType === 'spend_resource') {
    return (
      <Button size="sm" variant="outline" onClick={handleSpendResource} disabled={readOnly}>
        <Coins className="w-4 h-4 mr-1" />
        Spend
      </Button>
    );
  }

  return null;
}
