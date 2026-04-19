import { JSONDict, JSONValue } from "./misc";
// ---------- TTRPG CONTENT FIELDS ----------

export const TTRPG_CONTENT_SCHEMA_VERSION = 'ttrpg-content-v1' as const;

export type ContentType =
	| 'spell'
	| 'item'
	| 'rule'
	| 'class'
	| 'creature'
	| 'monster'
	| 'ability'
	| 'feat'
	| 'condition'
	| 'resource'
	| 'terrain'
	| 'encounter'
	| 'table'
	| 'character_sheet_template'
	| 'custom';

export type ContentAmount =
	| { type: 'dice'; expression: string; label?: string }
	| { type: 'fixed'; value: number; label?: string }
	| { type: 'formula'; expression: string; label?: string };

export type ContentDuration =
	| { type: 'instant' }
	| { type: 'rounds'; value: number }
	| { type: 'turns'; value: number }
	| { type: 'minutes'; value: number }
	| { type: 'hours'; value: number }
	| { type: 'days'; value: number }
	| { type: 'scene' }
	| { type: 'until_removed' }
	| { type: 'custom'; text: string; data?: JSONDict };

export type ContentDifficulty =
	| { type: 'fixed'; value: number }
	| { type: 'caster_dc' }
	| { type: 'attribute'; attribute: string }
	| { type: 'formula'; expression: string }
	| { type: 'custom'; text: string; data?: JSONDict };

export type ContentRange = {
	value?: number;
	unit?: string;
	text?: string;
};

export type ContentTargeting = {
	type: string;
	range?: ContentRange;
	area?: {
		shape: string;
		size?: ContentRange;
		origin?: string;
	};
	target_count?: ContentAmount;
	tags?: string[];
	text?: string;
};

export type ContentTrait = {
	key: string;
	value: JSONValue;
	label?: string;
};

export type ContentRequirement = {
	type: string;
	resource?: string;
	amount?: ContentAmount;
	component?: string;
	text?: string;
	data?: JSONDict;
};

export interface BaseContentEffect {
	id?: string;
	type: string;
	label?: string;
	tags?: string[];
	applies_on?: string;
	source?: string;
	render?: ContentEffectRenderHint;
}

export interface DamageEffect extends BaseContentEffect {
	type: 'damage';
	damage_type: string;
	amount: ContentAmount;
}

export interface HealingEffect extends BaseContentEffect {
	type: 'healing';
	amount: ContentAmount;
}

export interface ConditionEffect extends BaseContentEffect {
	type: 'condition';
	condition: string;
	duration?: ContentDuration;
}

export interface MovementEffect extends BaseContentEffect {
	type: 'movement';
	mode?: string;
	distance?: ContentRange;
	direction?: string;
}

export interface ResourceEffect extends BaseContentEffect {
	type: 'resource';
	resource: string;
	operation: 'gain' | 'spend' | 'restore' | 'reduce' | 'set' | string;
	amount?: ContentAmount;
}

export interface AttackEffect extends BaseContentEffect {
	type: 'attack';
	attack_type?: string;
	attribute?: string;
	difficulty?: ContentDifficulty;
	on_hit?: ContentOutcomeAction[];
	on_miss?: ContentOutcomeAction[];
}

export interface SavingThrowEffect extends BaseContentEffect {
	type: 'saving_throw';
	ability?: string;
	difficulty: ContentDifficulty;
	outcomes?: Record<string, ContentOutcomeAction[]>;
}

export interface AreaEffect extends BaseContentEffect {
	type: 'area';
	shape: string;
	size?: ContentRange;
	origin?: string;
}

export interface TextEffect extends BaseContentEffect {
	type: 'text';
	text: string;
}

export interface CustomEffect extends BaseContentEffect {
	type: 'custom';
	custom_type: string;
	data: JSONDict;
}

export type ContentEffect =
	| DamageEffect
	| HealingEffect
	| ConditionEffect
	| MovementEffect
	| ResourceEffect
	| AttackEffect
	| SavingThrowEffect
	| AreaEffect
	| TextEffect
	| CustomEffect;

export type ContentOutcomeAction =
	| {
		type: 'apply_effects';
		effect_ids: string[];
		modifier?: ContentEffectModifier;
	}
	| {
		type: 'damage_modifier';
		target_effects: string[];
		mode: 'half' | 'double' | 'none' | string;
	}
	| {
		type: 'text';
		text: string;
	}
	| {
		type: 'custom';
		custom_type: string;
		data: JSONDict;
	};

export type ContentEffectModifier =
	| { type: 'half_damage' }
	| { type: 'double_damage' }
	| { type: 'double_duration'; target_effects?: string[] }
	| { type: 'custom'; custom_type: string; data?: JSONDict };

export type ContentScalingRule = {
	trigger: {
		type: string;
		base?: number;
		value?: JSONValue;
		text?: string;
	};
	effects: ContentScalingEffect[];
};

export type ContentScalingEffect =
	| {
		type: 'modify_damage';
		target_effect: string;
		add?: ContentAmount;
		multiply?: number;
	}
	| {
		type: 'modify_healing';
		target_effect: string;
		add?: ContentAmount;
		multiply?: number;
	}
	| {
		type: 'add_effect';
		effect: ContentEffect;
	}
	| {
		type: 'custom';
		custom_type: string;
		data: JSONDict;
	};

export type ContentEffectRenderHint = {
	emphasis?: 'primary' | 'secondary' | 'muted' | string;
	group?: string;
	hidden?: boolean;
};

export type ContentRenderSection = {
	title: string;
	include?: string;
	include_effects?: string[];
};

export type ContentRenderHints = {
	layout?: string;
	short_text?: string;
	long_text?: string;
	icon_key?: string;
	tone?: string;
	summary_order?: string[];
	sections?: ContentRenderSection[];
	emphasis?: string[];
	collapsed_by_default?: string[];
	visibility?: 'player_visible' | 'gm_only' | 'hidden_until_identified' | string;
	extensions?: Record<string, JSONDict>;
};

export type ContentNote = {
	type: 'rules_text' | 'author_note' | 'gm_note' | 'custom' | string;
	text: string;
	data?: JSONDict;
};

export interface TtrpgContentFieldsV1 {
	schema_version: typeof TTRPG_CONTENT_SCHEMA_VERSION;
	content_type: ContentType | string;
	title?: string;
	subtitle?: string;
	tags?: string[];
	system?: {
		id: string;
		version?: string;
	};
	traits?: ContentTrait[];
	requirements?: ContentRequirement[];
	targeting?: ContentTargeting;
	mechanics: ContentEffect[];
	scaling?: ContentScalingRule[];
	render?: ContentRenderHints;
	notes?: ContentNote[];
	extensions?: Record<string, JSONDict>;
}

export type CharacterSheetFieldType =
	| 'text'
	| 'number'
	| 'boolean'
	| 'select'
	| 'multi_select'
	| 'dice'
	| 'formula'
	| 'resource'
	| 'counter'
	| 'textarea'
	| 'reference'
	| 'custom';

export type CharacterSheetFieldOption = {
	label: string;
	value: JSONValue;
	description?: string;
};

export type CharacterSheetFieldVisibility = {
	hidden?: boolean;
	readonly?: boolean;
	condition?: string;
	role?: 'player' | 'gm' | string;
};

export type CharacterSheetTemplateField = {
	id: string;
	label: string;
	field_type: CharacterSheetFieldType | string;
	default?: JSONValue;
	required?: boolean;
	description?: string;
	options?: CharacterSheetFieldOption[];
	min?: number;
	max?: number;
	formula?: string;
	source?: string;
	visibility?: CharacterSheetFieldVisibility;
	custom?: JSONDict;
};

export type CharacterSheetTemplateSection = {
	id: string;
	label: string;
	sort_order?: number;
	description?: string;
	fields: CharacterSheetTemplateField[];
	visibility?: CharacterSheetFieldVisibility;
	custom?: JSONDict;
};

export interface CharacterSheetTemplateFieldsV1 {
	schema_version: typeof TTRPG_CONTENT_SCHEMA_VERSION;
	content_type: 'character_sheet_template';
	title?: string;
	subtitle?: string;
	tags?: string[];
	system?: {
		id: string;
		version?: string;
	};
	sections: CharacterSheetTemplateSection[];
	mechanics?: ContentEffect[];
	render?: ContentRenderHints;
	notes?: ContentNote[];
	extensions?: Record<string, JSONDict>;
}

export type UnknownContentFields = JSONDict & {
	schema_version?: string;
	content_type?: string;
};

export type ContentFields = TtrpgContentFieldsV1 | CharacterSheetTemplateFieldsV1 | UnknownContentFields;

export type AmountKind = 'dice' | 'fixed' | 'formula';
export type MechanicKind = 'damage' | 'healing' | 'condition' | 'saving_throw' | 'resource' | 'movement' | 'text' | 'custom';

export type TraitRow = {
  key: string;
  value: string;
  label: string;
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
  add_type: AmountKind;
  add_value: string;
};

export type NoteRow = {
  type: string;
  text: string;
};

export interface ContentFormState {
  name: string;
  summary: string;
  content_type: ContentType;
  subtitle: string;
  tags: string;
  system_id: string;
  system_version: string;
  targeting_type: string;
  range_value: string;
  range_unit: string;
  target_count: string;
  targeting_text: string;
  render_short_text: string;
  render_tone: string;
  render_icon_key: string;
  traits: TraitRow[];
  requirements: RequirementRow[];
  mechanics: MechanicRow[];
  scaling: ScalingRow[];
  notes: NoteRow[];
  sheet_template_sections_json: string;
}

export const createEmptyContentFields = (
	contentType: ContentType | string = 'custom',
	title?: string,
): TtrpgContentFieldsV1 | CharacterSheetTemplateFieldsV1 => {
	if (contentType === 'character_sheet_template') {
		return {
			schema_version: TTRPG_CONTENT_SCHEMA_VERSION,
			content_type: 'character_sheet_template',
			title,
			sections: [],
			render: {
				layout: 'character_sheet',
			},
			notes: [],
		};
	}

	return {
		schema_version: TTRPG_CONTENT_SCHEMA_VERSION,
		content_type: contentType,
		title,
		traits: [],
		requirements: [],
		mechanics: [],
		scaling: [],
		notes: [],
	};
};

export const isTtrpgContentFieldsV1 = (fields: ContentFields): fields is TtrpgContentFieldsV1 =>
	fields.schema_version === TTRPG_CONTENT_SCHEMA_VERSION &&
	typeof fields.content_type === 'string' &&
	fields.content_type !== 'character_sheet_template' &&
	Array.isArray((fields as TtrpgContentFieldsV1).mechanics);

export const isCharacterSheetTemplateFieldsV1 = (fields: ContentFields): fields is CharacterSheetTemplateFieldsV1 =>
	fields.schema_version === TTRPG_CONTENT_SCHEMA_VERSION &&
	fields.content_type === 'character_sheet_template' &&
	Array.isArray((fields as CharacterSheetTemplateFieldsV1).sections);

export const getEffectsByType = <T extends ContentEffect>(
	fields: ContentFields,
	type: T['type'],
): T[] => {
	if (!isTtrpgContentFieldsV1(fields)) return [];
	return fields.mechanics.filter((effect): effect is T => effect.type === type);
};

export const validateContentFields = (fields: ContentFields): string[] => {
	const errors: string[] = [];

	if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
		return ['Content fields must be a JSON object.'];
	}

	if (typeof fields.schema_version !== 'string' || !fields.schema_version.trim()) {
		errors.push('Content fields require a schema_version.');
	}

	if (typeof fields.content_type !== 'string' || !fields.content_type.trim()) {
		errors.push('Content fields require a content_type.');
	}

	if (fields.content_type === 'character_sheet_template') {
		const maybeTemplate = fields as Partial<CharacterSheetTemplateFieldsV1>;

		if (!Array.isArray(maybeTemplate.sections)) {
			errors.push('Character sheet template fields require sections to be an array.');
		} else {
			maybeTemplate.sections.forEach((section, sectionIndex) => {
				if (!section || typeof section !== 'object' || Array.isArray(section)) {
					errors.push(`Character sheet section ${sectionIndex + 1} must be an object.`);
					return;
				}

				if (typeof section.id !== 'string' || !section.id.trim()) {
					errors.push(`Character sheet section ${sectionIndex + 1} requires an id.`);
				}

				if (typeof section.label !== 'string' || !section.label.trim()) {
					errors.push(`Character sheet section ${sectionIndex + 1} requires a label.`);
				}

				if (!Array.isArray(section.fields)) {
					errors.push(`Character sheet section ${sectionIndex + 1} requires fields to be an array.`);
					return;
				}

				section.fields.forEach((field, fieldIndex) => {
					if (!field || typeof field !== 'object' || Array.isArray(field)) {
						errors.push(`Character sheet section ${sectionIndex + 1} field ${fieldIndex + 1} must be an object.`);
						return;
					}

					if (typeof field.id !== 'string' || !field.id.trim()) {
						errors.push(`Character sheet section ${sectionIndex + 1} field ${fieldIndex + 1} requires an id.`);
					}

					if (typeof field.label !== 'string' || !field.label.trim()) {
						errors.push(`Character sheet section ${sectionIndex + 1} field ${fieldIndex + 1} requires a label.`);
					}

					if (typeof field.field_type !== 'string' || !field.field_type.trim()) {
						errors.push(`Character sheet section ${sectionIndex + 1} field ${fieldIndex + 1} requires a field_type.`);
					}
				});
			});
		}
	}

	const maybeTypedFields = fields as Partial<TtrpgContentFieldsV1>;
	if (maybeTypedFields.mechanics !== undefined && !Array.isArray(maybeTypedFields.mechanics)) {
		errors.push('Content fields mechanics must be an array.');
	}

	if (maybeTypedFields.scaling !== undefined && !Array.isArray(maybeTypedFields.scaling)) {
		errors.push('Content fields scaling must be an array.');
	}

	if (maybeTypedFields.traits !== undefined && !Array.isArray(maybeTypedFields.traits)) {
		errors.push('Content fields traits must be an array.');
	}

	if (Array.isArray(maybeTypedFields.mechanics)) {
		maybeTypedFields.mechanics.forEach((effect, index) => {
			if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
				errors.push(`Mechanic ${index + 1} must be an object.`);
				return;
			}

			if (typeof effect.type !== 'string' || !effect.type.trim()) {
				errors.push(`Mechanic ${index + 1} requires a type.`);
			}
		});
	}

	return errors;
};
