import type {
  AmountKind,
  CharacterSheetFieldOption,
  CharacterSheetFieldType,
  ContentType,
  MechanicKind,
} from '../../../types/contentFields';

export type TraitRow = {
  key: string;
  value: string;
};

export type RequirementRow = {
  type: string;
  resource: string;
  component: string;
  amount_type: AmountKind;
  amount_value: string;
  text: string;
};

export type MechanicRow = {
  id: string;
  type: MechanicKind;
  label: string;
  damage_type: string;
  amount_type: AmountKind;
  amount_value: string;
  condition: string;
  duration_type: string;
  duration_value: string;
  save_ability: string;
  save_difficulty_type: 'fixed' | 'caster_dc' | 'attribute' | 'formula' | 'custom';
  save_difficulty_value: string;
  resource: string;
  resource_operation: string;
  movement_mode: string;
  movement_distance: string;
  movement_unit: string;
  text: string;
  custom_type: string;
  custom_data: string;
  applies_on: string;
  save_success_text: string;
  save_failure_text: string;
};

export type ScalingRow = {
  trigger_type: string;
  trigger_base: string;
  trigger_text: string;
  target_effect: string;
  target_effect_type: string;
  add_type: AmountKind;
  add_value: string;
  multiply: string;
};

export type NoteRow = {
  type: string;
  text: string;
};

export type ContentSectionEntryRow = {
  key: string;
  value: string;
  text: string;
};

export type ContentSectionRow = {
  id: string;
  title: string;
  entries: ContentSectionEntryRow[];
};

export type SheetFieldRow = {
  id: string;
  label: string;
  field_type: CharacterSheetFieldType | string;
  default_value: string;
  required: boolean;
  description: string;
  options: CharacterSheetFieldOption[];
  min: string;
  max: string;
  formula: string;
  source: string;
  visibility_hidden: boolean;
  visibility_readonly: boolean;
  visibility_role: string;
};

export type SheetSectionRow = {
  id: string;
  label: string;
  sort_order: string;
  description: string;
  fields: SheetFieldRow[];
  visibility_hidden: boolean;
  visibility_readonly: boolean;
  visibility_role: string;
};

export interface ContentFormState {
  name: string;
  summary: string;
  content_type: ContentType;
  subtitle: string;
  tags: string;
  system_version: string;
  targeting_type: string;
  range_value: string;
  range_unit: string;
  target_count: string;
  targeting_text: string;
  render_tone: string;
  render_icon_key: string;
  traits: TraitRow[];
  requirements: RequirementRow[];
  mechanics: MechanicRow[];
  scaling: ScalingRow[];
  sections: ContentSectionRow[];
  notes: NoteRow[];
  sheet_sections: SheetSectionRow[];
}
