import type { Content } from '../../../api/models';
import type {
  CharacterSheetFieldOption,
  CharacterSheetTemplateField,
  CharacterSheetTemplateFieldsV1,
  CharacterSheetTemplateSection,
  ContentAmount,
  ContentEffect,
  ContentFields,
  ContentRequirement,
  ContentScalingRule,
  ContentSection,
  ContentTrait,
  TtrpgContentFieldsV1,
} from '../../../types/contentFields';
import {
  createEmptyContentFields,
  isCharacterSheetTemplateFieldsV1,
  isTtrpgContentFieldsV1,
} from '../../../types/contentFields';
import type { JSONDict, JSONValue } from '../../../types/misc';
import type {
  ContentFormState,
  ContentSectionEntryRow,
  ContentSectionRow,
  MechanicRow,
  NoteRow,
  RequirementRow,
  ScalingRow,
  SheetFieldRow,
  SheetSectionRow,
  TraitRow,
} from './editorTypes';

const splitCSV = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export const slugifySegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildDerivedSystemId = (name: string, contentType: string) => {
  const typeSlug = slugifySegment(contentType || 'custom') || 'custom';
  const nameSlug = slugifySegment(name || 'untitled') || 'untitled';
  return `${typeSlug}:${nameSlug}`;
};

const parseNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBoolean = (value: string) => value.trim().toLowerCase() === 'true';

export const parseJsonValue = (value: string): JSONValue => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return asNumber;

  try {
    return JSON.parse(trimmed) as JSONValue;
  } catch {
    return trimmed;
  }
};

const parseJsonObject = (value: string): JSONDict => {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Custom data must be a JSON object.');
  }
  return parsed as JSONDict;
};

const jsonValueToInput = (value: JSONValue) => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const buildAmount = (type: ContentAmount['type'], value: string): ContentAmount | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (type === 'fixed') {
    return { type, value: parseNumber(trimmed) ?? 0 };
  }

  return { type, expression: trimmed };
};

const amountToRow = (amount?: ContentAmount): Pick<MechanicRow, 'amount_type' | 'amount_value'> => {
  if (!amount) return { amount_type: 'dice', amount_value: '' };
  if (amount.type === 'fixed') return { amount_type: 'fixed', amount_value: String(amount.value) };
  return { amount_type: amount.type, amount_value: amount.expression };
};

const emptyTrait = (): TraitRow => ({ key: '', value: '' });

const emptyRequirement = (): RequirementRow => ({
  type: 'resource',
  resource: '',
  component: '',
  amount_type: 'fixed',
  amount_value: '',
  text: '',
});

const emptyMechanic = (): MechanicRow => ({
  id: '',
  type: 'damage',
  label: '',
  damage_type: '',
  amount_type: 'dice',
  amount_value: '',
  condition: '',
  duration_type: 'rounds',
  duration_value: '',
  save_ability: '',
  save_difficulty_type: 'fixed',
  save_difficulty_value: '',
  resource: '',
  resource_operation: 'spend',
  movement_mode: '',
  movement_distance: '',
  movement_unit: 'feet',
  text: '',
  custom_type: '',
  custom_data: '',
  applies_on: '',
  save_success_text: '',
  save_failure_text: '',
});

const emptyScaling = (): ScalingRow => ({
  trigger_type: 'level_above',
  trigger_base: '',
  trigger_text: '',
  target_effect: '',
  target_effect_type: '',
  add_type: 'dice',
  add_value: '',
  multiply: '',
});

const emptyNote = (type = 'rules_text'): NoteRow => ({ type, text: '' });

const emptyContentSectionEntry = (): ContentSectionEntryRow => ({ key: '', value: '', text: '' });

export const emptyContentSection = (): ContentSectionRow => ({
  id: '',
  title: '',
  entries: [emptyContentSectionEntry()],
});

const defaultSheetField = (): SheetFieldRow => ({
  id: '',
  label: '',
  field_type: 'text',
  default_value: '',
  required: false,
  description: '',
  options: [],
  min: '',
  max: '',
  formula: '',
  source: '',
  visibility_hidden: false,
  visibility_readonly: false,
  visibility_role: '',
});

const defaultSheetSection = (): SheetSectionRow => ({
  id: '',
  label: '',
  sort_order: '',
  description: '',
  fields: [defaultSheetField()],
  visibility_hidden: false,
  visibility_readonly: false,
  visibility_role: '',
});

const defaultSheetTemplateSections = (): CharacterSheetTemplateSection[] => [
  {
    id: 'attributes',
    label: 'Attributes',
    sort_order: 1,
    fields: [
      {
        id: 'strength',
        label: 'Strength',
        field_type: 'number',
        default: 10,
        required: true,
        min: 1,
        max: 30,
      },
      {
        id: 'hit_points',
        label: 'Hit Points',
        field_type: 'resource',
        default: {
          current: 10,
          max: 10,
        },
      },
    ],
  },
];

const sheetFieldToRow = (field: CharacterSheetTemplateField): SheetFieldRow => ({
  id: field.id,
  label: field.label,
  field_type: field.field_type,
  default_value: field.default === undefined ? '' : jsonValueToInput(field.default),
  required: Boolean(field.required),
  description: field.description ?? '',
  options: field.options ?? [],
  min: field.min !== undefined ? String(field.min) : '',
  max: field.max !== undefined ? String(field.max) : '',
  formula: field.formula ?? '',
  source: field.source ?? '',
  visibility_hidden: Boolean(field.visibility?.hidden),
  visibility_readonly: Boolean(field.visibility?.readonly),
  visibility_role: field.visibility?.role ?? '',
});

const sheetSectionToRow = (section: CharacterSheetTemplateSection): SheetSectionRow => ({
  id: section.id,
  label: section.label,
  sort_order: section.sort_order !== undefined ? String(section.sort_order) : '',
  description: section.description ?? '',
  fields: section.fields.length ? section.fields.map(sheetFieldToRow) : [defaultSheetField()],
  visibility_hidden: Boolean(section.visibility?.hidden),
  visibility_readonly: Boolean(section.visibility?.readonly),
  visibility_role: section.visibility?.role ?? '',
});

const rowToSheetField = (field: SheetFieldRow): CharacterSheetTemplateField => ({
  id: field.id.trim(),
  label: field.label.trim(),
  field_type: field.field_type.trim() || 'text',
  default: field.default_value.trim() ? parseJsonValue(field.default_value) : undefined,
  required: field.required || undefined,
  description: field.description.trim() || undefined,
  options: field.options.length ? field.options : undefined,
  min: parseNumber(field.min),
  max: parseNumber(field.max),
  formula: field.formula.trim() || undefined,
  source: field.source.trim() || undefined,
  visibility:
    field.visibility_hidden || field.visibility_readonly || field.visibility_role.trim()
      ? {
          hidden: field.visibility_hidden || undefined,
          readonly: field.visibility_readonly || undefined,
          role: field.visibility_role.trim() || undefined,
        }
      : undefined,
});

export const emptyContentForm = (): ContentFormState => ({
  name: '',
  summary: '',
  content_type: 'custom',
  subtitle: '',
  tags: '',
  system_version: '',
  targeting_type: '',
  range_value: '',
  range_unit: '',
  target_count: '',
  targeting_text: '',
  render_tone: '',
  render_icon_key: '',
  traits: [emptyTrait()],
  requirements: [],
  mechanics: [emptyMechanic()],
  scaling: [],
  sections: [],
  notes: [emptyNote()],
  sheet_sections: defaultSheetTemplateSections().map(sheetSectionToRow),
});

export const formFromContentFields = (content: Content, fields?: ContentFields): ContentFormState => {
  const form = emptyContentForm();
  form.name = content.name;
  form.summary = content.summary ?? '';

  if (!fields) return form;

  const sharedFields = fields as Partial<TtrpgContentFieldsV1 & CharacterSheetTemplateFieldsV1>;
  form.content_type = (fields.content_type || 'custom') as ContentFormState['content_type'];
  form.subtitle = sharedFields.subtitle ?? '';
  form.tags = sharedFields.tags?.join(', ') ?? '';
  form.system_version = sharedFields.system?.version ?? '';
  form.render_tone = fields.render?.tone ?? '';
  form.render_icon_key = fields.render?.icon_key ?? '';
  form.notes = fields.notes?.length ? fields.notes.map((note) => ({ type: note.type, text: note.text })) : [emptyNote()];

  if (isCharacterSheetTemplateFieldsV1(fields)) {
    form.sheet_sections = fields.sections.length ? fields.sections.map(sheetSectionToRow) : [defaultSheetSection()];
    return form;
  }

  if (!isTtrpgContentFieldsV1(fields)) return form;

  form.targeting_type = fields.targeting?.type ?? '';
  form.range_value = fields.targeting?.range?.value !== undefined ? String(fields.targeting.range.value) : '';
  form.range_unit = fields.targeting?.range?.unit ?? '';
  form.target_count = fields.targeting?.target_count?.type === 'fixed' ? String(fields.targeting.target_count.value) : '';
  form.targeting_text = fields.targeting?.text ?? '';
  form.traits = fields.traits?.length ? fields.traits.map((trait) => ({ key: trait.key, value: jsonValueToInput(trait.value) })) : [emptyTrait()];
  form.requirements = fields.requirements?.map((requirement) => ({
    type: requirement.type,
    resource: requirement.resource ?? '',
    component: requirement.component ?? '',
    ...amountToRow(requirement.amount),
    text: requirement.text ?? '',
  })) ?? [];
  form.sections = fields.sections?.length
    ? fields.sections.map((section) => ({
        id: section.id,
        title: section.title,
        entries: section.entries.length
          ? section.entries.map((entry) => ({
              key: entry.key,
              value: entry.value === undefined ? '' : jsonValueToInput(entry.value),
              text: entry.text ?? '',
            }))
          : [emptyContentSectionEntry()],
      }))
    : [];

  form.mechanics = fields.mechanics.length
    ? fields.mechanics.map((effect) => {
        const row = emptyMechanic();
        row.id = effect.id ?? '';
        row.label = effect.label ?? '';
        row.applies_on = effect.applies_on ?? '';

        if (effect.type === 'damage') {
          row.type = 'damage';
          row.damage_type = effect.damage_type;
          Object.assign(row, amountToRow(effect.amount));
        } else if (effect.type === 'healing') {
          row.type = 'healing';
          Object.assign(row, amountToRow(effect.amount));
        } else if (effect.type === 'condition') {
          row.type = 'condition';
          row.condition = effect.condition;
          if (effect.duration && 'value' in effect.duration) {
            row.duration_type = effect.duration.type;
            row.duration_value = String(effect.duration.value);
          } else if (effect.duration) {
            row.duration_type = effect.duration.type;
          }
        } else if (effect.type === 'saving_throw') {
          row.type = 'saving_throw';
          row.save_ability = effect.ability ?? '';
          row.save_difficulty_type = effect.difficulty.type as MechanicRow['save_difficulty_type'];
          if (effect.difficulty.type === 'fixed') row.save_difficulty_value = String(effect.difficulty.value);
          if (effect.difficulty.type === 'attribute') row.save_difficulty_value = effect.difficulty.attribute;
          if (effect.difficulty.type === 'formula') row.save_difficulty_value = effect.difficulty.expression;
          if (effect.difficulty.type === 'custom') row.save_difficulty_value = effect.difficulty.text;
          const successText = effect.outcomes?.success?.find((outcome) => outcome.type === 'text');
          const failureText = effect.outcomes?.failure?.find((outcome) => outcome.type === 'text');
          row.save_success_text = successText?.type === 'text' ? successText.text : '';
          row.save_failure_text = failureText?.type === 'text' ? failureText.text : '';
        } else if (effect.type === 'resource') {
          row.type = 'resource';
          row.resource = effect.resource;
          row.resource_operation = effect.operation;
          Object.assign(row, amountToRow(effect.amount));
        } else if (effect.type === 'movement') {
          row.type = 'movement';
          row.movement_mode = effect.mode ?? '';
          row.movement_distance = effect.distance?.value !== undefined ? String(effect.distance.value) : '';
          row.movement_unit = effect.distance?.unit ?? '';
        } else if (effect.type === 'custom') {
          row.type = 'custom';
          row.custom_type = effect.custom_type;
          row.custom_data = JSON.stringify(effect.data, null, 2);
        } else {
          row.type = 'text';
          row.text = effect.text;
        }

        return row;
      })
    : [emptyMechanic()];

  form.scaling = fields.scaling?.map((scaling) => {
    const firstEffect = scaling.effects[0];
    const targetEffect = firstEffect && 'target_effect' in firstEffect ? firstEffect.target_effect : '';
    const amountRow = firstEffect && 'add' in firstEffect ? amountToRow(firstEffect.add) : { amount_type: 'dice' as const, amount_value: '' };
    return {
      trigger_type: scaling.trigger.type,
      trigger_base: scaling.trigger.base !== undefined ? String(scaling.trigger.base) : '',
      trigger_text: scaling.trigger.text ?? '',
      target_effect: targetEffect,
      target_effect_type:
        firstEffect?.type === 'modify_damage'
          ? 'damage'
          : firstEffect?.type === 'modify_healing'
            ? 'healing'
            : firstEffect?.type === 'modify_mechanic'
              ? firstEffect.target_effect_type ?? ''
              : '',
      add_type: amountRow.amount_type,
      add_value: amountRow.amount_value,
      multiply: firstEffect && 'multiply' in firstEffect && firstEffect.multiply !== undefined ? String(firstEffect.multiply) : '',
    };
  }) ?? [];

  return form;
};

const buildTraits = (traits: TraitRow[]): ContentTrait[] =>
  traits
    .filter((trait) => trait.key.trim())
    .map((trait) => ({
      key: trait.key.trim(),
      value: parseJsonValue(trait.value),
    }));

const buildRequirements = (requirements: RequirementRow[]): ContentRequirement[] =>
  requirements
    .filter((requirement) => requirement.type.trim() || requirement.text.trim())
    .map((requirement) => ({
      type: requirement.type.trim() || 'custom',
      resource: requirement.resource.trim() || undefined,
      component: requirement.component.trim() || undefined,
      amount: buildAmount(requirement.amount_type, requirement.amount_value),
      text: requirement.text.trim() || undefined,
    }));

const buildMechanics = (mechanics: MechanicRow[]): ContentEffect[] =>
  mechanics
    .filter((mechanic) => mechanic.type && (mechanic.id.trim() || mechanic.label.trim() || mechanic.text.trim() || mechanic.amount_value.trim() || mechanic.condition.trim()))
    .map((mechanic) => {
      const base = {
        id: mechanic.id.trim() || undefined,
        label: mechanic.label.trim() || undefined,
        applies_on: mechanic.applies_on.trim() || undefined,
      };

      if (mechanic.type === 'damage') {
        return {
          ...base,
          type: 'damage',
          damage_type: mechanic.damage_type.trim() || 'untyped',
          amount: buildAmount(mechanic.amount_type, mechanic.amount_value) ?? { type: 'fixed', value: 0 },
        };
      }

      if (mechanic.type === 'healing') {
        return {
          ...base,
          type: 'healing',
          amount: buildAmount(mechanic.amount_type, mechanic.amount_value) ?? { type: 'fixed', value: 0 },
        };
      }

      if (mechanic.type === 'condition') {
        const durationValue = parseNumber(mechanic.duration_value);
        return {
          ...base,
          type: 'condition',
          condition: mechanic.condition.trim() || 'custom',
          duration: durationValue !== undefined
            ? { type: mechanic.duration_type || 'rounds', value: durationValue }
            : undefined,
        };
      }

      if (mechanic.type === 'saving_throw') {
        const fixedDifficulty = parseNumber(mechanic.save_difficulty_value);
        return {
          ...base,
          type: 'saving_throw',
          ability: mechanic.save_ability.trim() || undefined,
          difficulty: mechanic.save_difficulty_type === 'fixed'
            ? { type: 'fixed', value: fixedDifficulty ?? 0 }
            : mechanic.save_difficulty_type === 'attribute'
              ? { type: 'attribute', attribute: mechanic.save_difficulty_value.trim() || 'attribute' }
              : mechanic.save_difficulty_type === 'formula'
                ? { type: 'formula', expression: mechanic.save_difficulty_value.trim() || '0' }
                : mechanic.save_difficulty_type === 'custom'
                  ? { type: 'custom', text: mechanic.save_difficulty_value.trim() || 'Custom difficulty' }
                  : { type: 'caster_dc' },
          outcomes: {
            ...(mechanic.save_success_text.trim()
              ? { success: [{ type: 'text', text: mechanic.save_success_text.trim() }] }
              : {}),
            ...(mechanic.save_failure_text.trim()
              ? { failure: [{ type: 'text', text: mechanic.save_failure_text.trim() }] }
              : {}),
          },
        };
      }

      if (mechanic.type === 'resource') {
        return {
          ...base,
          type: 'resource',
          resource: mechanic.resource.trim() || 'resource',
          operation: mechanic.resource_operation.trim() || 'spend',
          amount: buildAmount(mechanic.amount_type, mechanic.amount_value),
        };
      }

      if (mechanic.type === 'movement') {
        const distance = parseNumber(mechanic.movement_distance);
        return {
          ...base,
          type: 'movement',
          mode: mechanic.movement_mode.trim() || undefined,
          distance: distance !== undefined || mechanic.movement_unit.trim()
            ? {
                value: distance,
                unit: mechanic.movement_unit.trim() || undefined,
              }
            : undefined,
        };
      }

      if (mechanic.type === 'custom') {
        return {
          ...base,
          type: 'custom',
          custom_type: mechanic.custom_type.trim() || 'custom',
          data: parseJsonObject(mechanic.custom_data),
        };
      }

      return {
        ...base,
        type: 'text',
        text: mechanic.text.trim() || mechanic.label.trim() || 'Rules text',
      };
    }) as ContentEffect[];

const buildScaling = (scalingRows: ScalingRow[]): ContentScalingRule[] =>
  scalingRows
    .filter((scaling) => scaling.trigger_type.trim() || scaling.add_value.trim() || scaling.trigger_text.trim())
    .map((scaling) => ({
      trigger: {
        type: scaling.trigger_type.trim() || 'custom',
        base: parseNumber(scaling.trigger_base),
        text: scaling.trigger_text.trim() || undefined,
      },
      effects: scaling.target_effect.trim() || scaling.add_value.trim() || scaling.multiply.trim()
        ? [{
            type: 'modify_mechanic',
            target_effect: scaling.target_effect.trim(),
            target_effect_type: scaling.target_effect_type.trim() || undefined,
            add: buildAmount(scaling.add_type, scaling.add_value),
            multiply: parseNumber(scaling.multiply),
          }]
        : [],
    }));

const buildCustomSections = (sections: ContentSectionRow[]): ContentSection[] =>
  sections
    .filter((section) => section.id.trim() || section.title.trim())
    .map((section) => ({
      id: section.id.trim() || slugifySegment(section.title) || 'section',
      title: section.title.trim() || section.id.trim(),
      entries: section.entries
        .filter((entry) => entry.key.trim() || entry.value.trim() || entry.text.trim())
        .map((entry) => ({
          key: entry.key.trim() || 'entry',
          value: entry.value.trim() ? parseJsonValue(entry.value) : undefined,
          text: entry.text.trim() || undefined,
        })),
    }));

const buildNotes = (notes: NoteRow[]) =>
  notes
    .filter((note) => note.text.trim())
    .map((note) => ({
      type: note.type.trim() || 'rules_text',
      text: note.text.trim(),
    }));

const buildSheetSections = (sections: SheetSectionRow[]): CharacterSheetTemplateSection[] =>
  sections
    .filter((section) => section.id.trim() || section.label.trim())
    .map((section, index) => ({
      id: section.id.trim() || slugifySegment(section.label) || `section-${index + 1}`,
      label: section.label.trim() || section.id.trim() || `Section ${index + 1}`,
      sort_order: parseNumber(section.sort_order) ?? index + 1,
      description: section.description.trim() || undefined,
      fields: section.fields
        .filter((field) => field.id.trim() || field.label.trim())
        .map(rowToSheetField),
      visibility:
        section.visibility_hidden || section.visibility_readonly || section.visibility_role.trim()
          ? {
              hidden: section.visibility_hidden || undefined,
              readonly: section.visibility_readonly || undefined,
              role: section.visibility_role.trim() || undefined,
            }
          : undefined,
    }));

export const buildFields = (form: ContentFormState): TtrpgContentFieldsV1 | CharacterSheetTemplateFieldsV1 => {
  const fields = createEmptyContentFields(form.content_type, form.name.trim());
  fields.subtitle = form.subtitle.trim() || undefined;
  fields.tags = splitCSV(form.tags);
  fields.system = {
    id: buildDerivedSystemId(form.name, form.content_type),
    version: form.system_version.trim() || undefined,
  };

  if (form.content_type === 'character_sheet_template') {
    const templateFields = fields as CharacterSheetTemplateFieldsV1;
    templateFields.sections = buildSheetSections(form.sheet_sections);
    templateFields.render = {
      layout: 'character_sheet',
      tone: form.render_tone.trim() || undefined,
      icon_key: form.render_icon_key.trim() || undefined,
    };
    templateFields.notes = buildNotes(form.notes);
    return templateFields;
  }

  const ttrpgFields = fields as TtrpgContentFieldsV1;
  ttrpgFields.traits = buildTraits(form.traits);
  ttrpgFields.requirements = buildRequirements(form.requirements);
  ttrpgFields.mechanics = buildMechanics(form.mechanics);
  ttrpgFields.scaling = buildScaling(form.scaling);
  ttrpgFields.sections = buildCustomSections(form.sections);
  ttrpgFields.notes = buildNotes(form.notes);

  if (form.targeting_type.trim() || form.targeting_text.trim()) {
    const rangeValue = parseNumber(form.range_value);
    const targetCount = parseNumber(form.target_count);
    ttrpgFields.targeting = {
      type: form.targeting_type.trim() || 'custom',
      range: rangeValue !== undefined || form.range_unit.trim()
        ? {
            value: rangeValue,
            unit: form.range_unit.trim() || undefined,
          }
        : undefined,
      target_count: targetCount !== undefined ? { type: 'fixed', value: targetCount } : undefined,
      text: form.targeting_text.trim() || undefined,
    };
  }

  if (form.render_tone.trim() || form.render_icon_key.trim()) {
    ttrpgFields.render = {
      tone: form.render_tone.trim() || undefined,
      icon_key: form.render_icon_key.trim() || undefined,
      summary_order: ['traits', 'targeting', 'requirements', 'sections', 'mechanics', 'scaling'],
    };
  }

  return ttrpgFields;
};

export const buildPreviewFields = (form: ContentFormState): { fields?: ContentFields; error?: string } => {
  try {
    return { fields: buildFields(form) };
  } catch (err) {
    return {
      error: (err as Error)?.message || 'Preview is unavailable until the content fields are valid.',
    };
  }
};

export const contentMakerDefaults = {
  emptyTrait,
  emptyRequirement,
  emptyMechanic,
  emptyScaling,
  emptyNote,
  emptyContentSection,
  emptyContentSectionEntry,
  defaultSheetField,
  defaultSheetSection,
};

export const sheetFieldTypeOptions: Array<CharacterSheetFieldType> = [
  'text',
  'number',
  'boolean',
  'select',
  'multi_select',
  'dice',
  'formula',
  'resource',
  'counter',
  'textarea',
  'reference',
  'custom',
];

export const createSheetOption = (): CharacterSheetFieldOption => ({
  label: '',
  value: '',
});

export const formatSystemIdPreview = (form: Pick<ContentFormState, 'name' | 'content_type'>) =>
  buildDerivedSystemId(form.name, form.content_type);

export const parseOptionValue = (value: string) => parseJsonValue(value);
export const formatOptionValue = (value: JSONValue) => jsonValueToInput(value);
export const parseLooseBoolean = parseBoolean;
