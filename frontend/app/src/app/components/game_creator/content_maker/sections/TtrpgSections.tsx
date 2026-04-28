import type React from 'react';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import type { AmountKind } from '../../../../types/contentFields';
import type {
  ContentFormState,
  ContentSectionEntryRow,
  ContentSectionRow,
  MechanicRow,
  NoteRow,
  RequirementRow,
  ScalingRow,
  TraitRow,
} from '../editorTypes';
import { EditorSection, RemoveButton, ReorderButtons, SectionHeader } from '../shared';

type SetForm = React.Dispatch<React.SetStateAction<ContentFormState>>;

type UpdateArrayItem = <T,>(
  key: 'traits' | 'requirements' | 'mechanics' | 'scaling' | 'sections' | 'notes',
  index: number,
  patch: Partial<T>,
) => void;

type RemoveArrayItem = (
  key: 'traits' | 'requirements' | 'mechanics' | 'scaling' | 'sections' | 'notes',
  index: number,
) => void;

type MoveArrayItem = (
  key: 'traits' | 'requirements' | 'mechanics' | 'scaling' | 'sections' | 'notes',
  index: number,
  direction: 'up' | 'down',
) => void;

export function SystemTargetingSection({
  form,
  setForm,
}: {
  form: ContentFormState;
  setForm: SetForm;
}) {
  return (
    <EditorSection
      value="system-targeting"
      title="Targeting"
      description="Capture portable target rules for non-sheet content."
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="targeting_type">Targeting Type</Label>
            <Input id="targeting_type" value={form.targeting_type} onChange={(event) => setForm((prev) => ({ ...prev, targeting_type: event.target.value }))} placeholder="creature_or_object" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="range_value">Range</Label>
            <Input id="range_value" type="number" value={form.range_value} onChange={(event) => setForm((prev) => ({ ...prev, range_value: event.target.value }))} placeholder="60" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="range_unit">Range Unit</Label>
            <Input id="range_unit" value={form.range_unit} onChange={(event) => setForm((prev) => ({ ...prev, range_unit: event.target.value }))} placeholder="feet" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="target_count">Targets</Label>
            <Input id="target_count" type="number" value={form.target_count} onChange={(event) => setForm((prev) => ({ ...prev, target_count: event.target.value }))} placeholder="1" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="targeting_text">Targeting Text</Label>
          <Textarea id="targeting_text" value={form.targeting_text} onChange={(event) => setForm((prev) => ({ ...prev, targeting_text: event.target.value }))} placeholder="A creature you can see within range." />
        </div>
      </div>
    </EditorSection>
  );
}

export function TraitsSection({
  form,
  setForm,
  updateArrayItem,
  removeArrayItem,
  moveArrayItem,
  emptyTrait,
}: {
  form: ContentFormState;
  setForm: SetForm;
  updateArrayItem: UpdateArrayItem;
  removeArrayItem: RemoveArrayItem;
  moveArrayItem: MoveArrayItem;
  emptyTrait: () => TraitRow;
}) {
  return (
    <EditorSection value="traits" title="Traits" description="Use ordered key/value facts for filtering and rendering.">
      <div className="space-y-4">
        <SectionHeader description="The key is both the stored identifier and the displayed trait name." actionLabel="Trait" onAction={() => setForm((prev) => ({ ...prev, traits: [...prev.traits, emptyTrait()] }))} />
        <div className="space-y-3">
          {form.traits.map((trait, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1fr_1fr_auto_auto]">
              <Input value={trait.key} onChange={(event) => updateArrayItem<TraitRow>('traits', index, { key: event.target.value })} placeholder="skills" aria-label="Trait key" />
              <Input value={trait.value} onChange={(event) => updateArrayItem<TraitRow>('traits', index, { value: event.target.value })} placeholder="expert hunter" aria-label="Trait value" />
              <ReorderButtons onMoveUp={() => moveArrayItem('traits', index, 'up')} onMoveDown={() => moveArrayItem('traits', index, 'down')} disableUp={index === 0} disableDown={index === form.traits.length - 1} />
              <RemoveButton onClick={() => removeArrayItem('traits', index)} />
            </div>
          ))}
        </div>
      </div>
    </EditorSection>
  );
}

export function RequirementsSection({
  form,
  setForm,
  updateArrayItem,
  removeArrayItem,
  emptyRequirement,
}: {
  form: ContentFormState;
  setForm: SetForm;
  updateArrayItem: UpdateArrayItem;
  removeArrayItem: RemoveArrayItem;
  emptyRequirement: () => RequirementRow;
}) {
  return (
    <EditorSection value="requirements" title="Requirements" description="Resources, components, prerequisites, and rule text.">
      <div className="space-y-4">
        <SectionHeader description="Capture prerequisites, costs, and plain-language restrictions in one place." actionLabel="Requirement" onAction={() => setForm((prev) => ({ ...prev, requirements: [...prev.requirements, emptyRequirement()] }))} />
        <div className="space-y-3">
          {form.requirements.map((requirement, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-border p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <Input value={requirement.type} onChange={(event) => updateArrayItem<RequirementRow>('requirements', index, { type: event.target.value })} placeholder="resource" />
                <Input value={requirement.resource} onChange={(event) => updateArrayItem<RequirementRow>('requirements', index, { resource: event.target.value })} placeholder="spell_slot" />
                <Input value={requirement.amount_value} onChange={(event) => updateArrayItem<RequirementRow>('requirements', index, { amount_value: event.target.value })} placeholder="1" />
                <Input value={requirement.component} onChange={(event) => updateArrayItem<RequirementRow>('requirements', index, { component: event.target.value })} placeholder="verbal" />
              </div>
              <Textarea value={requirement.text} onChange={(event) => updateArrayItem<RequirementRow>('requirements', index, { text: event.target.value })} placeholder="Optional requirement text." />
              <RemoveButton onClick={() => removeArrayItem('requirements', index)} label="Remove Requirement" />
            </div>
          ))}
        </div>
      </div>
    </EditorSection>
  );
}

export function MechanicsSection({
  form,
  setForm,
  updateArrayItem,
  removeArrayItem,
  emptyMechanic,
}: {
  form: ContentFormState;
  setForm: SetForm;
  updateArrayItem: UpdateArrayItem;
  removeArrayItem: RemoveArrayItem;
  emptyMechanic: () => MechanicRow;
}) {
  return (
    <EditorSection value="mechanics" title="Mechanics" description="Add typed effects for damage, saves, conditions, resources, and custom rules.">
      <div className="space-y-4">
        <SectionHeader description="Structure the actual rules here so preview and rendering stay in sync." actionLabel="Mechanic" onAction={() => setForm((prev) => ({ ...prev, mechanics: [...prev.mechanics, emptyMechanic()] }))} />
        <div className="space-y-4">
          {form.mechanics.map((mechanic, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-border p-3">
              <div className="grid gap-3 md:grid-cols-5">
                <Input value={mechanic.id} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { id: event.target.value })} placeholder="bite-attack" aria-label="Mechanic ID" />
                <Input value={mechanic.label} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { label: event.target.value })} placeholder="Bite Attack" aria-label="Mechanic display label" />
                <Input value={mechanic.applies_on} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { applies_on: event.target.value })} placeholder="on_hit" aria-label="Mechanic applies on" />
                <Select value={mechanic.type} onValueChange={(value) => updateArrayItem<MechanicRow>('mechanics', index, { type: value as MechanicRow['type'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['damage', 'healing', 'condition', 'saving_throw', 'resource', 'movement', 'text', 'custom'].map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <RemoveButton onClick={() => removeArrayItem('mechanics', index)} />
              </div>
              {(mechanic.type === 'damage' || mechanic.type === 'healing' || mechanic.type === 'resource') ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {mechanic.type === 'damage' ? (
                    <Input value={mechanic.damage_type} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { damage_type: event.target.value })} placeholder="cold" />
                  ) : null}
                  {mechanic.type === 'resource' ? (
                    <>
                      <Input value={mechanic.resource} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { resource: event.target.value })} placeholder="focus" />
                      <Input value={mechanic.resource_operation} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { resource_operation: event.target.value })} placeholder="spend" />
                    </>
                  ) : null}
                  <Select value={mechanic.amount_type} onValueChange={(value) => updateArrayItem<MechanicRow>('mechanics', index, { amount_type: value as AmountKind })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dice">dice</SelectItem>
                      <SelectItem value="fixed">fixed</SelectItem>
                      <SelectItem value="formula">formula</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={mechanic.amount_value} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { amount_value: event.target.value })} placeholder="3d6" />
                </div>
              ) : null}
              {mechanic.type === 'condition' ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Input value={mechanic.condition} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { condition: event.target.value })} placeholder="slowed" />
                  <Input value={mechanic.duration_type} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { duration_type: event.target.value })} placeholder="rounds" />
                  <Input type="number" value={mechanic.duration_value} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { duration_value: event.target.value })} placeholder="1" />
                </div>
              ) : null}
              {mechanic.type === 'saving_throw' ? (
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input value={mechanic.save_ability} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { save_ability: event.target.value })} placeholder="agility" />
                    <Select value={mechanic.save_difficulty_type} onValueChange={(value) => updateArrayItem<MechanicRow>('mechanics', index, { save_difficulty_type: value as MechanicRow['save_difficulty_type'] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">fixed</SelectItem>
                        <SelectItem value="caster_dc">caster_dc</SelectItem>
                        <SelectItem value="attribute">attribute</SelectItem>
                        <SelectItem value="formula">formula</SelectItem>
                        <SelectItem value="custom">custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={mechanic.save_difficulty_value} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { save_difficulty_value: event.target.value })} placeholder="14 or caster_dc note" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Textarea value={mechanic.save_success_text} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { save_success_text: event.target.value })} placeholder="Success outcome text." />
                    <Textarea value={mechanic.save_failure_text} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { save_failure_text: event.target.value })} placeholder="Failure outcome text." />
                  </div>
                </div>
              ) : null}
              {mechanic.type === 'movement' ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Input value={mechanic.movement_mode} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { movement_mode: event.target.value })} placeholder="push" />
                  <Input type="number" value={mechanic.movement_distance} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { movement_distance: event.target.value })} placeholder="10" />
                  <Input value={mechanic.movement_unit} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { movement_unit: event.target.value })} placeholder="feet" />
                </div>
              ) : null}
              {mechanic.type === 'text' ? (
                <Textarea value={mechanic.text} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { text: event.target.value })} placeholder="Rules text for this effect." />
              ) : null}
              {mechanic.type === 'custom' ? (
                <div className="grid gap-3">
                  <Input value={mechanic.custom_type} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { custom_type: event.target.value })} placeholder="my_system_effect" />
                  <Textarea value={mechanic.custom_data} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { custom_data: event.target.value })} placeholder='{"key": "value"}' />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </EditorSection>
  );
}

export function ScalingSection({
  form,
  setForm,
  updateArrayItem,
  removeArrayItem,
  emptyScaling,
}: {
  form: ContentFormState;
  setForm: SetForm;
  updateArrayItem: UpdateArrayItem;
  removeArrayItem: RemoveArrayItem;
  emptyScaling: () => ScalingRow;
}) {
  const mechanicsWithIds = form.mechanics.filter((mechanic) => mechanic.id.trim());

  return (
    <EditorSection value="scaling" title="Scaling" description="Tie scaling rules directly to the mechanic they modify.">
      <div className="space-y-4">
        <SectionHeader description="Use scaling rules when a mechanic changes by level, tier, slot, or another trigger." actionLabel="Scaling Rule" onAction={() => setForm((prev) => ({ ...prev, scaling: [...prev.scaling, emptyScaling()] }))} />
        <div className="space-y-3">
          {form.scaling.map((scaling, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-border p-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Input value={scaling.trigger_type} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { trigger_type: event.target.value })} placeholder="slot_level_above" />
                <Input value={scaling.trigger_base} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { trigger_base: event.target.value })} placeholder="2" />
                <Input value={scaling.trigger_text} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { trigger_text: event.target.value })} placeholder="At higher levels" />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Select
                  value={scaling.target_effect}
                  onValueChange={(value) => {
                    const target = mechanicsWithIds.find((mechanic) => mechanic.id === value);
                    updateArrayItem<ScalingRow>('scaling', index, {
                      target_effect: value,
                      target_effect_type: target?.type ?? '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mechanic" />
                  </SelectTrigger>
                  <SelectContent>
                    {mechanicsWithIds.map((mechanic) => (
                      <SelectItem key={mechanic.id} value={mechanic.id}>
                        {(mechanic.label || mechanic.id)} ({mechanic.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={scaling.add_type} onValueChange={(value) => updateArrayItem<ScalingRow>('scaling', index, { add_type: value as AmountKind })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dice">dice</SelectItem>
                    <SelectItem value="fixed">fixed</SelectItem>
                    <SelectItem value="formula">formula</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={scaling.add_value} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { add_value: event.target.value })} placeholder="1d6" />
                <Input value={scaling.multiply} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { multiply: event.target.value })} placeholder="2" />
              </div>
              <RemoveButton onClick={() => removeArrayItem('scaling', index)} />
            </div>
          ))}
        </div>
      </div>
    </EditorSection>
  );
}

export function CustomSectionsSection({
  form,
  setForm,
  updateArrayItem,
  removeArrayItem,
  moveArrayItem,
  emptySection,
  emptyEntry,
}: {
  form: ContentFormState;
  setForm: SetForm;
  updateArrayItem: UpdateArrayItem;
  removeArrayItem: RemoveArrayItem;
  moveArrayItem: MoveArrayItem;
  emptySection: () => ContentSectionRow;
  emptyEntry: () => ContentSectionEntryRow;
}) {
  const updateEntry = (sectionIndex: number, entryIndex: number, patch: Partial<ContentSectionEntryRow>) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) => (
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              entries: section.entries.map((entry, currentEntryIndex) => (
                currentEntryIndex === entryIndex ? { ...entry, ...patch } : entry
              )),
            }
          : section
      )),
    }));
  };

  const addEntry = (sectionIndex: number) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) => (
        currentSectionIndex === sectionIndex
          ? { ...section, entries: [...section.entries, emptyEntry()] }
          : section
      )),
    }));
  };

  const removeEntry = (sectionIndex: number, entryIndex: number) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, currentSectionIndex) => (
        currentSectionIndex === sectionIndex
          ? { ...section, entries: section.entries.filter((_, currentEntryIndex) => currentEntryIndex !== entryIndex) }
          : section
      )),
    }));
  };

  return (
    <EditorSection value="custom-sections" title="Custom Sections" description="Add structured sections like skills, resistances, loot, or senses.">
      <div className="space-y-4">
        <SectionHeader description="These sections render as their own titled blocks and keep entry order." actionLabel="Section" onAction={() => setForm((prev) => ({ ...prev, sections: [...prev.sections, emptySection()] }))} />
        <div className="space-y-4">
          {form.sections.map((section, index) => (
            <div key={index} className="space-y-3 rounded-md border border-border p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <Input value={section.id} onChange={(event) => updateArrayItem<ContentSectionRow>('sections', index, { id: event.target.value })} placeholder="skills" />
                <Input value={section.title} onChange={(event) => updateArrayItem<ContentSectionRow>('sections', index, { title: event.target.value })} placeholder="Skills" />
                <ReorderButtons onMoveUp={() => moveArrayItem('sections', index, 'up')} onMoveDown={() => moveArrayItem('sections', index, 'down')} disableUp={index === 0} disableDown={index === form.sections.length - 1} />
                <RemoveButton onClick={() => removeArrayItem('sections', index)} />
              </div>
              <div className="space-y-3">
                {section.entries.map((entry, entryIndex) => (
                  <div key={entryIndex} className="grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input value={entry.key} onChange={(event) => updateEntry(index, entryIndex, { key: event.target.value })} placeholder="stealth" />
                    <Input value={entry.value} onChange={(event) => updateEntry(index, entryIndex, { value: event.target.value })} placeholder="+6" />
                    <Input value={entry.text} onChange={(event) => updateEntry(index, entryIndex, { text: event.target.value })} placeholder="Advantage in snow." />
                    <RemoveButton onClick={() => removeEntry(index, entryIndex)} />
                  </div>
                ))}
              </div>
              <SectionHeader description="Entries can store a value, descriptive text, or both." actionLabel="Entry" onAction={() => addEntry(index)} />
            </div>
          ))}
        </div>
      </div>
    </EditorSection>
  );
}

export function NotesSection({
  form,
  setForm,
  updateArrayItem,
  removeArrayItem,
  emptyNote,
}: {
  form: ContentFormState;
  setForm: SetForm;
  updateArrayItem: UpdateArrayItem;
  removeArrayItem: RemoveArrayItem;
  emptyNote: () => NoteRow;
}) {
  return (
    <EditorSection value="notes" title="Notes And Rendering" description="Add readable notes and display hints without a redundant rules summary field.">
      <div className="space-y-4">
        <SectionHeader description="Keep readable rule text here and tune semantic display hints." actionLabel="Note" onAction={() => setForm((prev) => ({ ...prev, notes: [...prev.notes, emptyNote()] }))} />
        <div className="grid gap-4 md:grid-cols-2">
          <Input value={form.render_tone} onChange={(event) => setForm((prev) => ({ ...prev, render_tone: event.target.value }))} placeholder="damage, utility, healing" />
          <Input value={form.render_icon_key} onChange={(event) => setForm((prev) => ({ ...prev, render_icon_key: event.target.value }))} placeholder="snowflake" />
        </div>
        <div className="space-y-3">
          {form.notes.map((note, index) => (
            <div key={index} className="grid gap-3 rounded-md border border-border p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input value={note.type} onChange={(event) => updateArrayItem<NoteRow>('notes', index, { type: event.target.value })} placeholder="rules_text" />
                <RemoveButton onClick={() => removeArrayItem('notes', index)} />
              </div>
              <Textarea value={note.text} onChange={(event) => updateArrayItem<NoteRow>('notes', index, { text: event.target.value })} placeholder="The frost clings to the target." />
            </div>
          ))}
        </div>
      </div>
    </EditorSection>
  );
}
