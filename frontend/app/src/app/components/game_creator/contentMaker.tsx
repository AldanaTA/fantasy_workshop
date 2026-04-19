import { useEffect, useState, type FormEvent } from 'react';
import { CircleArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Content, ContentCategory, ContentPack } from '../../api/models';
import {
  AmountKind,
  CharacterSheetTemplateFieldsV1,
  CharacterSheetTemplateSection,
  ContentFields,
  ContentAmount,
  ContentEffect,
  ContentFormState,
  ContentRequirement,
  ContentScalingRule,
  ContentTrait,
  ContentType,
  MechanicKind,
  MechanicRow,
  NoteRow,
  RequirementRow,
  ScalingRow,
  TtrpgContentFieldsV1,
  TraitRow,
  createEmptyContentFields,
  isCharacterSheetTemplateFieldsV1,
  isTtrpgContentFieldsV1,
} from '../../types/contentFields';
import { JSONDict, JSONValue } from '../../types/misc';
import { contentApi } from '../../api/contentApi';
import { useToast } from '../ui/toastProvider';

const contentTypeOptions: Array<{ value: ContentType; label: string }> = [
  { value: 'spell', label: 'Spell' },
  { value: 'item', label: 'Item' },
  { value: 'rule', label: 'Rule' },
  { value: 'class', label: 'Class' },
  { value: 'creature', label: 'Creature' },
  { value: 'monster', label: 'Monster' },
  { value: 'ability', label: 'Ability' },
  { value: 'feat', label: 'Feat' },
  { value: 'condition', label: 'Condition' },
  { value: 'resource', label: 'Resource' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'encounter', label: 'Encounter' },
  { value: 'table', label: 'Table' },
  { value: 'character_sheet_template', label: 'Character Sheet Template' },
  { value: 'custom', label: 'Custom' },
];

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

const defaultSheetTemplateSectionsJson = () => JSON.stringify(defaultSheetTemplateSections(), null, 2);

const emptyTrait = (): TraitRow => ({ key: '', value: '', label: '' });

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
  add_type: 'dice',
  add_value: '',
});

const emptyNote = (type = 'rules_text'): NoteRow => ({ type, text: '' });

const emptyContentForm = (): ContentFormState => ({
  name: '',
  summary: '',
  content_type: 'custom',
  subtitle: '',
  tags: '',
  system_id: '',
  system_version: '',
  targeting_type: '',
  range_value: '',
  range_unit: '',
  target_count: '',
  targeting_text: '',
  render_short_text: '',
  render_tone: '',
  render_icon_key: '',
  traits: [emptyTrait()],
  requirements: [],
  mechanics: [emptyMechanic()],
  scaling: [],
  notes: [emptyNote()],
  sheet_template_sections_json: defaultSheetTemplateSectionsJson(),
});

type Props = {
  pack: ContentPack;
  category: ContentCategory;
  content?: Content;
  onCreated?: () => Promise<void> | void;
  onCancel?: () => void;
};

const splitCSV = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const parseNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseTraitValue = (value: string): JSONValue => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && trimmed !== '') return asNumber;

  try {
    return JSON.parse(trimmed) as JSONValue;
  } catch {
    return trimmed;
  }
};

const parseCustomData = (value: string): JSONDict => {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Custom data must be a JSON object.');
  }
  return parsed as JSONDict;
};

const parseSheetTemplateSections = (value: string): CharacterSheetTemplateSection[] => {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('Sheet template sections must be a JSON array.');
  }
  return parsed as CharacterSheetTemplateSection[];
};

const buildAmount = (type: AmountKind, value: string): ContentAmount | undefined => {
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

const jsonValueToInput = (value: JSONValue) => {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const formFromContentFields = (content: Content, fields?: ContentFields): ContentFormState => {
  const form = emptyContentForm();
  form.name = content.name;
  form.summary = content.summary ?? '';

  if (!fields) return form;

  const sharedFields = fields as Partial<TtrpgContentFieldsV1 & CharacterSheetTemplateFieldsV1>;
  form.content_type = (fields.content_type || 'custom') as ContentType;
  form.subtitle = sharedFields.subtitle ?? '';
  form.tags = sharedFields.tags?.join(', ') ?? '';
  form.system_id = sharedFields.system?.id ?? '';
  form.system_version = sharedFields.system?.version ?? '';

  if (isCharacterSheetTemplateFieldsV1(fields)) {
    form.sheet_template_sections_json = JSON.stringify(fields.sections, null, 2);
    form.render_short_text = fields.render?.short_text ?? '';
    form.render_tone = fields.render?.tone ?? '';
    form.render_icon_key = fields.render?.icon_key ?? '';
    form.notes = fields.notes?.length
      ? fields.notes.map((note) => ({ type: note.type, text: note.text }))
      : [emptyNote()];
    return form;
  }

  if (!isTtrpgContentFieldsV1(fields)) return form;

  form.targeting_type = fields.targeting?.type ?? '';
  form.range_value = fields.targeting?.range?.value !== undefined ? String(fields.targeting.range.value) : '';
  form.range_unit = fields.targeting?.range?.unit ?? '';
  form.target_count = fields.targeting?.target_count?.type === 'fixed'
    ? String(fields.targeting.target_count.value)
    : '';
  form.targeting_text = fields.targeting?.text ?? '';
  form.render_short_text = fields.render?.short_text ?? '';
  form.render_tone = fields.render?.tone ?? '';
  form.render_icon_key = fields.render?.icon_key ?? '';

  form.traits = fields.traits?.length
    ? fields.traits.map((trait) => ({
        key: trait.key,
        value: jsonValueToInput(trait.value),
        label: trait.label ?? '',
      }))
    : [emptyTrait()];

  form.requirements = fields.requirements?.map((requirement) => ({
    type: requirement.type,
    resource: requirement.resource ?? '',
    component: requirement.component ?? '',
    ...amountToRow(requirement.amount),
    text: requirement.text ?? '',
  })) ?? [];

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
    return {
      trigger_type: scaling.trigger.type,
      trigger_base: scaling.trigger.base !== undefined ? String(scaling.trigger.base) : '',
      trigger_text: scaling.trigger.text ?? '',
      target_effect: firstEffect && 'target_effect' in firstEffect ? firstEffect.target_effect : '',
      add_type: firstEffect && 'add' in firstEffect ? amountToRow(firstEffect.add).amount_type : 'dice',
      add_value: firstEffect && 'add' in firstEffect ? amountToRow(firstEffect.add).amount_value : '',
    };
  }) ?? [];

  form.notes = fields.notes?.length
    ? fields.notes.map((note) => ({ type: note.type, text: note.text }))
    : [emptyNote()];

  return form;
};

const buildFields = (form: ContentFormState): TtrpgContentFieldsV1 | CharacterSheetTemplateFieldsV1 => {
  const fields = createEmptyContentFields(form.content_type, form.name.trim());
  fields.subtitle = form.subtitle.trim() || undefined;
  fields.tags = splitCSV(form.tags);

  if (form.system_id.trim()) {
    fields.system = {
      id: form.system_id.trim(),
      version: form.system_version.trim() || undefined,
    };
  }

  if (form.content_type === 'character_sheet_template') {
    const templateFields = fields as CharacterSheetTemplateFieldsV1;
    templateFields.sections = parseSheetTemplateSections(form.sheet_template_sections_json);
    templateFields.render = {
      layout: 'character_sheet',
      short_text: form.render_short_text.trim() || undefined,
      tone: form.render_tone.trim() || undefined,
      icon_key: form.render_icon_key.trim() || undefined,
    };
    templateFields.notes = form.notes
      .filter((note) => note.text.trim())
      .map((note) => ({
        type: note.type.trim() || 'rules_text',
        text: note.text.trim(),
      }));
    return templateFields;
  }

  const ttrpgFields = fields as TtrpgContentFieldsV1;

  const traits: ContentTrait[] = form.traits
    .filter((trait) => trait.key.trim())
    .map((trait) => ({
      key: trait.key.trim(),
      value: parseTraitValue(trait.value),
      label: trait.label.trim() || undefined,
    }));
  ttrpgFields.traits = traits;

  const requirements: ContentRequirement[] = form.requirements
    .filter((requirement) => requirement.type.trim() || requirement.text.trim())
    .map((requirement) => ({
      type: requirement.type.trim() || 'custom',
      resource: requirement.resource.trim() || undefined,
      component: requirement.component.trim() || undefined,
      amount: buildAmount(requirement.amount_type, requirement.amount_value),
      text: requirement.text.trim() || undefined,
    }));
  ttrpgFields.requirements = requirements;

  if (form.targeting_type.trim() || form.targeting_text.trim()) {
    const rangeValue = parseNumber(form.range_value);
    const targetCount = parseNumber(form.target_count);
    ttrpgFields.targeting = {
      type: form.targeting_type.trim() || 'custom',
      range: rangeValue || form.range_unit.trim()
        ? {
            value: rangeValue,
            unit: form.range_unit.trim() || undefined,
          }
        : undefined,
      target_count: targetCount !== undefined ? { type: 'fixed', value: targetCount } : undefined,
      text: form.targeting_text.trim() || undefined,
    };
  }

  ttrpgFields.mechanics = form.mechanics
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
          data: parseCustomData(mechanic.custom_data),
        };
      }

      return {
        ...base,
        type: 'text',
        text: mechanic.text.trim() || mechanic.label.trim() || 'Rules text',
      };
    }) as ContentEffect[];

  ttrpgFields.scaling = form.scaling
    .filter((scaling) => scaling.trigger_type.trim() || scaling.add_value.trim() || scaling.trigger_text.trim())
    .map((scaling): ContentScalingRule => ({
      trigger: {
        type: scaling.trigger_type.trim() || 'custom',
        base: parseNumber(scaling.trigger_base),
        text: scaling.trigger_text.trim() || undefined,
      },
      effects: scaling.target_effect.trim() || scaling.add_value.trim()
        ? [{
            type: 'modify_damage',
            target_effect: scaling.target_effect.trim(),
            add: buildAmount(scaling.add_type, scaling.add_value),
          }]
        : [],
    }));

  ttrpgFields.notes = form.notes
    .filter((note) => note.text.trim())
    .map((note) => ({
      type: note.type.trim() || 'rules_text',
      text: note.text.trim(),
    }));

  if (form.render_short_text.trim() || form.render_tone.trim() || form.render_icon_key.trim()) {
    ttrpgFields.render = {
      short_text: form.render_short_text.trim() || undefined,
      tone: form.render_tone.trim() || undefined,
      icon_key: form.render_icon_key.trim() || undefined,
      summary_order: ['traits', 'targeting', 'requirements', 'mechanics', 'scaling'],
    };
  }

  return ttrpgFields;
};

export function ContentMaker({ pack, category, content, onCreated, onCancel }: Props) {
  const [form, setForm] = useState<ContentFormState>(() => emptyContentForm());
  const [error, setError] = useState<string | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(Boolean(content));
  const { toastPromise } = useToast();
  const isEditing = Boolean(content);
  const isSheetTemplate = form.content_type === 'character_sheet_template';

  useEffect(() => {
    let isCancelled = false;

    const loadExistingContent = async () => {
      if (!content) {
        setForm(emptyContentForm());
        setIsLoadingVersion(false);
        return;
      }

      setIsLoadingVersion(true);
      setError(null);

      try {
        let fields: ContentFields | undefined;

        try {
          const activeVersion = await contentApi.getActive(content.id);
          fields = isTtrpgContentFieldsV1(activeVersion.fields) || isCharacterSheetTemplateFieldsV1(activeVersion.fields)
            ? activeVersion.fields
            : undefined;
        } catch {
          const versions = await contentApi.listVersions(content.id);
          const latestVersion = versions.sort((a, b) => b.version_num - a.version_num)[0];
          fields = latestVersion && (isTtrpgContentFieldsV1(latestVersion.fields) || isCharacterSheetTemplateFieldsV1(latestVersion.fields))
            ? latestVersion.fields
            : undefined;
        }

        if (!isCancelled) {
          setForm(formFromContentFields(content, fields));
        }
      } catch (err) {
        if (!isCancelled) {
          setForm(formFromContentFields(content));
          setError((err as Error)?.message || 'Unable to load content fields.');
        }
      } finally {
        if (!isCancelled) setIsLoadingVersion(false);
      }
    };

    loadExistingContent();

    return () => {
      isCancelled = true;
    };
  }, [content?.id]);

  const updateArrayItem = <T,>(
    key: 'traits' | 'requirements' | 'mechanics' | 'scaling' | 'notes',
    index: number,
    patch: Partial<T>,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: (prev[key] as T[]).map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  };

  const removeArrayItem = (
    key: 'traits' | 'requirements' | 'mechanics' | 'scaling' | 'notes',
    index: number,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('A content name is required.');
      return;
    }

    setError(null);

    try {
      const fields = buildFields(form);
      await toastPromise((async () => {
        const savedContent = content
          ? await contentApi.patch(content.id, {
              name: form.name.trim(),
              summary: form.summary.trim() || null,
            })
          : await contentApi.create({
          pack_id: pack.id,
          category_id: category.id,
          name: form.name.trim(),
          summary: form.summary.trim() || null,
        });

        const createdVersion = await contentApi.createVersion(savedContent.id, { fields });
        await contentApi.upsertActive(savedContent.id, {
          content_id: savedContent.id,
          active_version_num: createdVersion.version_num,
          deleted_at: null,
        });

        return savedContent;
      })(), {
        loading: isEditing ? 'Saving content...' : 'Creating content...',
        success: isEditing ? 'Content saved successfully.' : 'Content created successfully.',
        error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          (isEditing ? 'Failed to save content.' : 'Failed to create content.'),
      });

      setForm(emptyContentForm());
      await onCreated?.();
    } catch (err) {
      setError((err as Error)?.message || (isEditing ? 'Failed to save content.' : 'Failed to create content.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{isEditing ? 'Edit content' : `Create content in ${category.name}`}</h2>
            <p className="text-sm text-muted-foreground">
              Define the rules document for {pack.pack_name}.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onCancel} className="min-h-[44px] sm:w-auto">
            <CircleArrowLeft className="h-4 w-4 shrink-0" />
            Back to Categories
          </Button>
        </div>
        <Separator />

        {isLoadingVersion ? (
          <p className="text-sm text-muted-foreground">Loading content...</p>
        ) : (
        <form className="space-y-8" onSubmit={handleSubmit}>
          <section className="grid gap-4">
            <div>
              <h3 className="font-semibold">Identity</h3>
              <p className="text-sm text-muted-foreground">Name the content and choose the broad rules category.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="content_name">Name</Label>
                <Input
                  id="content_name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Frostbite Lance"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="content_type">Content Type</Label>
                <Select
                  value={form.content_type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, content_type: value as ContentType }))}
                >
                  <SelectTrigger id="content_type">
                    <SelectValue placeholder="Choose a content type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="content_subtitle">Subtitle</Label>
                <Input
                  id="content_subtitle"
                  value={form.subtitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))}
                  placeholder="A shard of killing winter"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="content_tags">Tags</Label>
                <Input
                  id="content_tags"
                  value={form.tags}
                  onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="cold, ice, attack"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content_summary">Summary</Label>
              <Textarea
                id="content_summary"
                value={form.summary}
                onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                placeholder="Short list text for this content."
              />
            </div>
          </section>

          <Separator />

          {isSheetTemplate ? (
            <>
              <section className="grid gap-4">
                <div>
                  <h3 className="font-semibold">Sheet Sections</h3>
                  <p className="text-sm text-muted-foreground">Define reusable sections and fields for character sheets as JSON.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sheet_template_sections">Sections JSON</Label>
                  <Textarea
                    id="sheet_template_sections"
                    value={form.sheet_template_sections_json}
                    onChange={(event) => setForm((prev) => ({ ...prev, sheet_template_sections_json: event.target.value }))}
                    className="min-h-[360px] font-mono text-sm"
                    placeholder={defaultSheetTemplateSectionsJson()}
                  />
                  <p className="text-sm text-muted-foreground">
                    Fields can use text, number, boolean, select, multi_select, dice, formula, resource, counter, textarea, reference, or custom.
                  </p>
                </div>
              </section>

              <Separator />
            </>
          ) : null}

          {!isSheetTemplate ? (
          <>
          <section className="grid gap-4">
            <div>
              <h3 className="font-semibold">System And Targeting</h3>
              <p className="text-sm text-muted-foreground">Capture portable system metadata and target rules.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="system_id">System ID</Label>
                <Input
                  id="system_id"
                  value={form.system_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, system_id: event.target.value }))}
                  placeholder="homebrew-arcanum"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="system_version">System Version</Label>
                <Input
                  id="system_version"
                  value={form.system_version}
                  onChange={(event) => setForm((prev) => ({ ...prev, system_version: event.target.value }))}
                  placeholder="0.3"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="targeting_type">Targeting Type</Label>
                <Input
                  id="targeting_type"
                  value={form.targeting_type}
                  onChange={(event) => setForm((prev) => ({ ...prev, targeting_type: event.target.value }))}
                  placeholder="creature_or_object"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="range_value">Range</Label>
                <Input
                  id="range_value"
                  type="number"
                  value={form.range_value}
                  onChange={(event) => setForm((prev) => ({ ...prev, range_value: event.target.value }))}
                  placeholder="60"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="range_unit">Range Unit</Label>
                <Input
                  id="range_unit"
                  value={form.range_unit}
                  onChange={(event) => setForm((prev) => ({ ...prev, range_unit: event.target.value }))}
                  placeholder="feet"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="target_count">Targets</Label>
                <Input
                  id="target_count"
                  type="number"
                  value={form.target_count}
                  onChange={(event) => setForm((prev) => ({ ...prev, target_count: event.target.value }))}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targeting_text">Targeting Text</Label>
              <Textarea
                id="targeting_text"
                value={form.targeting_text}
                onChange={(event) => setForm((prev) => ({ ...prev, targeting_text: event.target.value }))}
                placeholder="A creature you can see within range."
              />
            </div>
          </section>

          <Separator />
          </>
          ) : null}

          {!isSheetTemplate ? (
          <>
          <section className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Traits</h3>
                <p className="text-sm text-muted-foreground">Use key/value facts for filtering and rendering.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, traits: [...prev.traits, emptyTrait()] }))}>
                <Plus className="h-4 w-4" />
                Trait
              </Button>
            </div>
            <div className="space-y-3">
              {form.traits.map((trait, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <Input value={trait.key} onChange={(event) => updateArrayItem<TraitRow>('traits', index, { key: event.target.value })} placeholder="school" />
                  <Input value={trait.value} onChange={(event) => updateArrayItem<TraitRow>('traits', index, { value: event.target.value })} placeholder="evocation" />
                  <Input value={trait.label} onChange={(event) => updateArrayItem<TraitRow>('traits', index, { label: event.target.value })} placeholder="School" />
                  <Button type="button" variant="outline" onClick={() => removeArrayItem('traits', index)} aria-label="Remove trait">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <Separator />
          </>
          ) : null}

          {!isSheetTemplate ? (
          <>
          <section className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Requirements</h3>
                <p className="text-sm text-muted-foreground">Resources, components, prerequisites, and rule text.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, requirements: [...prev.requirements, emptyRequirement()] }))}>
                <Plus className="h-4 w-4" />
                Requirement
              </Button>
            </div>
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
                  <Button type="button" variant="outline" onClick={() => removeArrayItem('requirements', index)} className="justify-self-start">
                    <Trash2 className="h-4 w-4" />
                    Remove Requirement
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <Separator />
          </>
          ) : null}

          {!isSheetTemplate ? (
          <>
          <section className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Mechanics</h3>
                <p className="text-sm text-muted-foreground">Add typed effects for damage, saves, conditions, resources, and custom rules.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, mechanics: [...prev.mechanics, emptyMechanic()] }))}>
                <Plus className="h-4 w-4" />
                Mechanic
              </Button>
            </div>
            <div className="space-y-4">
              {form.mechanics.map((mechanic, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-border p-3">
                  <div className="grid gap-3 md:grid-cols-5">
                    <Input value={mechanic.id} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { id: event.target.value })} placeholder="cold-damage" />
                    <Input value={mechanic.label} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { label: event.target.value })} placeholder="Cold damage" />
                    <Input value={mechanic.applies_on} onChange={(event) => updateArrayItem<MechanicRow>('mechanics', index, { applies_on: event.target.value })} placeholder="failed_save" />
                    <Select value={mechanic.type} onValueChange={(value) => updateArrayItem<MechanicRow>('mechanics', index, { type: value as MechanicKind })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['damage', 'healing', 'condition', 'saving_throw', 'resource', 'movement', 'text', 'custom'].map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={() => removeArrayItem('mechanics', index)}>
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
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
          </section>

          <Separator />
          </>
          ) : null}

          {!isSheetTemplate ? (
          <>
          <section className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Scaling</h3>
                <p className="text-sm text-muted-foreground">Describe how mechanics change at higher tiers or levels.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, scaling: [...prev.scaling, emptyScaling()] }))}>
                <Plus className="h-4 w-4" />
                Scaling Rule
              </Button>
            </div>
            <div className="space-y-3">
              {form.scaling.map((scaling, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-5">
                  <Input value={scaling.trigger_type} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { trigger_type: event.target.value })} placeholder="slot_level_above" />
                  <Input value={scaling.trigger_base} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { trigger_base: event.target.value })} placeholder="2" />
                  <Input value={scaling.target_effect} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { target_effect: event.target.value })} placeholder="cold-damage" />
                  <Input value={scaling.add_value} onChange={(event) => updateArrayItem<ScalingRow>('scaling', index, { add_value: event.target.value })} placeholder="1d6" />
                  <Button type="button" variant="outline" onClick={() => removeArrayItem('scaling', index)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <Separator />
          </>
          ) : null}

          <section className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Notes And Rendering</h3>
                <p className="text-sm text-muted-foreground">Add human-readable rules text and semantic display hints.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setForm((prev) => ({ ...prev, notes: [...prev.notes, emptyNote()] }))}>
                <Plus className="h-4 w-4" />
                Note
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Input value={form.render_short_text} onChange={(event) => setForm((prev) => ({ ...prev, render_short_text: event.target.value }))} placeholder="Short rules summary" />
              <Input value={form.render_tone} onChange={(event) => setForm((prev) => ({ ...prev, render_tone: event.target.value }))} placeholder="damage, utility, healing" />
              <Input value={form.render_icon_key} onChange={(event) => setForm((prev) => ({ ...prev, render_icon_key: event.target.value }))} placeholder="snowflake" />
            </div>
            <div className="space-y-3">
              {form.notes.map((note, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-border p-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Input value={note.type} onChange={(event) => updateArrayItem<NoteRow>('notes', index, { type: event.target.value })} placeholder="rules_text" />
                    <Button type="button" variant="outline" onClick={() => removeArrayItem('notes', index)}>
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                  <Textarea value={note.text} onChange={(event) => updateArrayItem<NoteRow>('notes', index, { text: event.target.value })} placeholder="The frost clings to the target." />
                </div>
              ))}
            </div>
          </section>

          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {isEditing ? 'Save Content' : 'Create Content'}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
