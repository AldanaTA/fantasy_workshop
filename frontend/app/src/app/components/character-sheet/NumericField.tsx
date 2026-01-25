import { Character, Content, CharacterContentInstance } from '../../types/game';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Plus, Minus } from 'lucide-react';
import { evaluateNumericFormula, truncateNumber } from './formula-helpers';
import { getContentDef } from './helpers';

interface NumericFieldProps {
  instance: CharacterContentInstance;
  field: Content['fields'][0];
  character: Character;
  content: Content[];
  readOnly: boolean;
  onUpdate: (fieldId: string, value: number) => void;
}

export function NumericField({
  instance,
  field,
  character,
  content,
  readOnly,
  onUpdate,
}: NumericFieldProps) {
  const value = instance.fieldValues[field.id] as number;
  const isFieldDisabled = readOnly && !field.editable;
  const hasMechanic = !!field.mechanicType;

  // Evaluate min/max if they're formulas
  let minValue: number | undefined;
  let maxValue: number | undefined;

  if (field.minValue !== undefined) {
    if (typeof field.minValue === 'string') {
      minValue = evaluateNumericFormula(instance.id, field.minValue, character, content);
    } else {
      minValue = field.minValue;
    }
  }

  if (field.maxValue !== undefined) {
    if (typeof field.maxValue === 'string') {
      maxValue = evaluateNumericFormula(instance.id, field.maxValue, character, content);
    } else {
      maxValue = field.maxValue;
    }
  }

  // Calculate percentage for progress bar
  let percentage = 0;
  if (minValue !== undefined && maxValue !== undefined) {
    const range = maxValue - minValue;
    if (range > 0) {
      percentage = ((value - minValue) / range) * 100;
    }
  }

  const handleIncrement = () => {
    const newValue = (value || 0) + 1;
    if (maxValue === undefined || newValue <= maxValue) {
      onUpdate(field.id, newValue);
    }
  };

  const handleDecrement = () => {
    const newValue = (value || 0) - 1;
    if (minValue === undefined || newValue >= minValue) {
      onUpdate(field.id, newValue);
    }
  };

  if (hasMechanic) {
    // Compact layout for fields with mechanics
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <label className="text-xs text-muted-foreground block mb-1">
            {field.label || field.name}
            {minValue !== undefined && maxValue !== undefined && ` (${minValue}-${maxValue})`}
          </label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={value ?? 0}
              onChange={(e) => onUpdate(field.id, parseFloat(e.target.value) || 0)}
              disabled={isFieldDisabled}
              className="text-center h-8 px-2"
              min={minValue}
              max={maxValue}
            />
            <div className="flex gap-0.5">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDecrement}
                disabled={isFieldDisabled || (minValue !== undefined && value <= minValue)}
                className="h-8 w-6 p-0"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleIncrement}
                disabled={isFieldDisabled || (maxValue !== undefined && value >= maxValue)}
                className="h-8 w-6 p-0"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard layout for fields without mechanics
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted-foreground">
          {field.label || field.name}
        </label>
        {minValue !== undefined && maxValue !== undefined && (
          <span className="text-xs text-muted-foreground">
            {value ?? 0} / {maxValue}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value ?? 0}
          onChange={(e) => onUpdate(field.id, parseFloat(e.target.value) || 0)}
          disabled={isFieldDisabled}
          className="flex-1"
          min={minValue}
          max={maxValue}
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDecrement}
            disabled={isFieldDisabled || (minValue !== undefined && value <= minValue)}
            className="h-9 w-9 p-0"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleIncrement}
            disabled={isFieldDisabled || (maxValue !== undefined && value >= maxValue)}
            className="h-9 w-9 p-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {/* Progress bar for bounded numeric fields */}
      {minValue !== undefined && maxValue !== undefined && (
        <div className="w-full bg-muted rounded-full h-1.5 mt-2">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
      )}
    </div>
  );
}
