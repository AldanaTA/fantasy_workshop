import { CharacterContentInstance, Content } from '../../types/game';
import { Input } from '../ui/input';

interface StringFieldProps {
  instance: CharacterContentInstance;
  field: Content['fields'][0];
  readOnly: boolean;
  onUpdate: (fieldId: string, value: string) => void;
}

export function StringField({ instance, field, readOnly, onUpdate }: StringFieldProps) {
  const value = instance.fieldValues[field.id] as string;
  const isFieldDisabled = readOnly && !field.editable;

  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">
        {field.label || field.name}
      </label>
      <Input
        type="text"
        value={value || ''}
        onChange={(e) => onUpdate(field.id, e.target.value)}
        disabled={isFieldDisabled}
      />
    </div>
  );
}
