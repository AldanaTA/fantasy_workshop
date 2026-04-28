import type React from 'react';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Checkbox } from '../../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import type { CharacterSheetFieldOption } from '../../../../types/contentFields';
import type { ContentFormState, SheetFieldRow, SheetSectionRow } from '../editorTypes';
import { createSheetOption, formatOptionValue, parseOptionValue, sheetFieldTypeOptions } from '../schema';
import { EditorSection, RemoveButton, ReorderButtons, SectionHeader } from '../shared';

type SetForm = React.Dispatch<React.SetStateAction<ContentFormState>>;

export function SheetTemplateSectionEditor({
  form,
  setForm,
  defaultSheetSection,
  defaultSheetField,
}: {
  form: ContentFormState;
  setForm: SetForm;
  defaultSheetSection: () => SheetSectionRow;
  defaultSheetField: () => SheetFieldRow;
}) {
  const updateSection = (sectionIndex: number, patch: Partial<SheetSectionRow>) => {
    setForm((prev) => ({
      ...prev,
      sheet_sections: prev.sheet_sections.map((section, currentIndex) => (
        currentIndex === sectionIndex ? { ...section, ...patch } : section
      )),
    }));
  };

  const moveSection = (sectionIndex: number, direction: 'up' | 'down') => {
    setForm((prev) => {
      const nextIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
      if (nextIndex < 0 || nextIndex >= prev.sheet_sections.length) return prev;
      const nextSections = [...prev.sheet_sections];
      [nextSections[sectionIndex], nextSections[nextIndex]] = [nextSections[nextIndex], nextSections[sectionIndex]];
      return { ...prev, sheet_sections: nextSections };
    });
  };

  const removeSection = (sectionIndex: number) => {
    setForm((prev) => ({
      ...prev,
      sheet_sections: prev.sheet_sections.filter((_, currentIndex) => currentIndex !== sectionIndex),
    }));
  };

  const addField = (sectionIndex: number) => {
    setForm((prev) => ({
      ...prev,
      sheet_sections: prev.sheet_sections.map((section, currentIndex) => (
        currentIndex === sectionIndex
          ? { ...section, fields: [...section.fields, defaultSheetField()] }
          : section
      )),
    }));
  };

  const updateField = (sectionIndex: number, fieldIndex: number, patch: Partial<SheetFieldRow>) => {
    setForm((prev) => ({
      ...prev,
      sheet_sections: prev.sheet_sections.map((section, currentIndex) => (
        currentIndex === sectionIndex
          ? {
              ...section,
              fields: section.fields.map((field, currentFieldIndex) => (
                currentFieldIndex === fieldIndex ? { ...field, ...patch } : field
              )),
            }
          : section
      )),
    }));
  };

  const removeField = (sectionIndex: number, fieldIndex: number) => {
    setForm((prev) => ({
      ...prev,
      sheet_sections: prev.sheet_sections.map((section, currentIndex) => (
        currentIndex === sectionIndex
          ? { ...section, fields: section.fields.filter((_, currentFieldIndex) => currentFieldIndex !== fieldIndex) }
          : section
      )),
    }));
  };

  const updateFieldOptions = (sectionIndex: number, fieldIndex: number, nextOptions: CharacterSheetFieldOption[]) => {
    updateField(sectionIndex, fieldIndex, { options: nextOptions });
  };

  return (
    <EditorSection value="sheet-sections" title="Sheet Sections" description="Build character sheet sections and fields with structured controls instead of raw JSON.">
      <div className="space-y-4">
        <SectionHeader description="Add sections and fields in the same shape the sheet renderer consumes." actionLabel="Section" onAction={() => setForm((prev) => ({ ...prev, sheet_sections: [...prev.sheet_sections, defaultSheetSection()] }))} />
        <div className="space-y-4">
          {form.sheet_sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-4 rounded-md border border-border p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
                <Input value={section.id} onChange={(event) => updateSection(sectionIndex, { id: event.target.value })} placeholder="attributes" />
                <Input value={section.label} onChange={(event) => updateSection(sectionIndex, { label: event.target.value })} placeholder="Attributes" />
                <Input value={section.sort_order} onChange={(event) => updateSection(sectionIndex, { sort_order: event.target.value })} placeholder="1" />
                <ReorderButtons onMoveUp={() => moveSection(sectionIndex, 'up')} onMoveDown={() => moveSection(sectionIndex, 'down')} disableUp={sectionIndex === 0} disableDown={sectionIndex === form.sheet_sections.length - 1} />
                <RemoveButton onClick={() => removeSection(sectionIndex)} />
              </div>
              <Textarea value={section.description} onChange={(event) => updateSection(sectionIndex, { description: event.target.value })} placeholder="Describe this section." />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={section.visibility_hidden} onCheckedChange={(checked) => updateSection(sectionIndex, { visibility_hidden: checked === true })} />
                  <Label>Hidden</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={section.visibility_readonly} onCheckedChange={(checked) => updateSection(sectionIndex, { visibility_readonly: checked === true })} />
                  <Label>Readonly</Label>
                </div>
                <Input value={section.visibility_role} onChange={(event) => updateSection(sectionIndex, { visibility_role: event.target.value })} placeholder="player or gm" />
              </div>
              <div className="space-y-4">
                {section.fields.map((field, fieldIndex) => (
                  <div key={fieldIndex} className="space-y-3 rounded-md border border-border/70 p-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                      <Input value={field.id} onChange={(event) => updateField(sectionIndex, fieldIndex, { id: event.target.value })} placeholder="strength" />
                      <Input value={field.label} onChange={(event) => updateField(sectionIndex, fieldIndex, { label: event.target.value })} placeholder="Strength" />
                      <Select value={field.field_type} onValueChange={(value) => updateField(sectionIndex, fieldIndex, { field_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sheetFieldTypeOptions.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <RemoveButton onClick={() => removeField(sectionIndex, fieldIndex)} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input value={field.default_value} onChange={(event) => updateField(sectionIndex, fieldIndex, { default_value: event.target.value })} placeholder='10 or {"current":10,"max":10}' />
                      <Input value={field.description} onChange={(event) => updateField(sectionIndex, fieldIndex, { description: event.target.value })} placeholder="Field description" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Input value={field.min} onChange={(event) => updateField(sectionIndex, fieldIndex, { min: event.target.value })} placeholder="min" />
                      <Input value={field.max} onChange={(event) => updateField(sectionIndex, fieldIndex, { max: event.target.value })} placeholder="max" />
                      <Input value={field.formula} onChange={(event) => updateField(sectionIndex, fieldIndex, { formula: event.target.value })} placeholder="formula" />
                      <Input value={field.source} onChange={(event) => updateField(sectionIndex, fieldIndex, { source: event.target.value })} placeholder="source" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={field.required} onCheckedChange={(checked) => updateField(sectionIndex, fieldIndex, { required: checked === true })} />
                        <Label>Required</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={field.visibility_hidden} onCheckedChange={(checked) => updateField(sectionIndex, fieldIndex, { visibility_hidden: checked === true })} />
                        <Label>Hidden</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={field.visibility_readonly} onCheckedChange={(checked) => updateField(sectionIndex, fieldIndex, { visibility_readonly: checked === true })} />
                        <Label>Readonly</Label>
                      </div>
                    </div>
                    <Input value={field.visibility_role} onChange={(event) => updateField(sectionIndex, fieldIndex, { visibility_role: event.target.value })} placeholder="player or gm" />
                    {(field.field_type === 'select' || field.field_type === 'multi_select') ? (
                      <div className="space-y-3 rounded-md border border-border/50 p-3">
                        {field.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                            <Input
                              value={option.label}
                              onChange={(event) => updateFieldOptions(sectionIndex, fieldIndex, field.options.map((currentOption, currentIndex) => (
                                currentIndex === optionIndex ? { ...currentOption, label: event.target.value } : currentOption
                              )))}
                              placeholder="Option label"
                            />
                            <Input
                              value={formatOptionValue(option.value)}
                              onChange={(event) => updateFieldOptions(sectionIndex, fieldIndex, field.options.map((currentOption, currentIndex) => (
                                currentIndex === optionIndex ? { ...currentOption, value: parseOptionValue(event.target.value) } : currentOption
                              )))}
                              placeholder="Option value"
                            />
                            <RemoveButton onClick={() => updateFieldOptions(sectionIndex, fieldIndex, field.options.filter((_, currentIndex) => currentIndex !== optionIndex))} />
                          </div>
                        ))}
                        <SectionHeader description="Select fields can define labeled options here." actionLabel="Option" onAction={() => updateFieldOptions(sectionIndex, fieldIndex, [...field.options, createSheetOption()])} />
                      </div>
                    ) : null}
                  </div>
                ))}
                <SectionHeader description="Fields map directly to the live character sheet renderer." actionLabel="Field" onAction={() => addField(sectionIndex)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </EditorSection>
  );
}
