import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';
import {
  CharacterSheetTemplateField,
  CharacterSheetTemplateSection,
  ContentAmount,
  ContentDifficulty,
  ContentDuration,
  ContentEffect,
  ContentFields,
  ContentNote,
  ContentOutcomeAction,
  ContentRange,
  ContentRequirement,
  ContentScalingEffect,
  ContentScalingRule,
  ContentTargeting,
  ContentTrait,
  isCharacterSheetTemplateFieldsV1,
  isTtrpgContentFieldsV1,
} from '../../types/contentFields';
import { JSONValue } from '../../types/misc';

export type ContentRenderMode = 'compact' | 'full';
export type ContentRenderVisibility = 'player' | 'gm';

export type ContentRollContext = {
  source: 'amount' | 'difficulty' | 'sheet_field';
  contentType?: string;
  effectId?: string;
  effectType?: string;
  fieldId?: string;
  label?: string;
};

export type ContentRenderProps = {
  fields: ContentFields;
  contentName?: string;
  summary?: string | null;
  mode?: ContentRenderMode;
  visibility?: ContentRenderVisibility;
  className?: string;
  onRoll?: (expression: string, context?: ContentRollContext) => void;
};

export function ContentRender({
  fields,
  contentName,
  summary,
  mode = 'full',
  visibility = 'player',
  className,
  onRoll,
}: ContentRenderProps) {
  if (!isRecord(fields)) {
    return (
      <UnknownContentRender
        fields={fields}
        contentName={contentName}
        summary={summary}
        mode={mode}
        className={className}
      />
    );
  }

  if (isCharacterSheetTemplateFieldsV1(fields)) {
    return (
      <CharacterSheetTemplateRender
        fields={fields}
        contentName={contentName}
        summary={summary}
        mode={mode}
        visibility={visibility}
        className={className}
        onRoll={onRoll}
      />
    );
  }

  if (isTtrpgContentFieldsV1(fields)) {
    return (
      <TtrpgContentRender
        fields={fields}
        contentName={contentName}
        summary={summary}
        mode={mode}
        visibility={visibility}
        className={className}
        onRoll={onRoll}
      />
    );
  }

  return (
    <UnknownContentRender
      fields={fields}
      contentName={contentName}
      summary={summary}
      mode={mode}
      className={className}
    />
  );
}

type TtrpgRenderProps = Required<Pick<ContentRenderProps, 'mode' | 'visibility'>> &
  Pick<ContentRenderProps, 'contentName' | 'summary' | 'className' | 'onRoll'> & {
    fields: Extract<ContentFields, { mechanics: ContentEffect[] }>;
  };

function TtrpgContentRender({
  fields,
  contentName,
  summary,
  mode,
  visibility,
  className,
  onRoll,
}: TtrpgRenderProps) {
  if (visibility === 'player' && fields.render?.visibility === 'gm_only') {
    return <RestrictedContent className={className} />;
  }

  const visibleEffects = fields.mechanics.filter((effect) => !isHiddenEffect(effect, visibility));
  const compactEffects = visibleEffects
    .filter((effect) => ['damage', 'healing', 'saving_throw', 'attack', 'condition', 'resource'].includes(effect.type))
    .slice(0, 4);
  const title = fields.title || contentName || 'Untitled content';
  const shortText = fields.render?.short_text || summary;

  return (
    <Card className={cn('gap-4 rounded-md border-border bg-background shadow-none', className)}>
      <CardHeader className="gap-3 px-4 pt-4">
        <ContentHeader
          title={title}
          subtitle={fields.subtitle}
          summary={mode === 'compact' ? shortText : summary}
          shortText={mode === 'full' ? fields.render?.short_text : undefined}
          contentType={fields.content_type}
          tags={fields.tags}
          system={fields.system}
        />
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        {mode === 'compact' ? (
          <CompactMechanics
            effects={compactEffects}
            remainingCount={Math.max(visibleEffects.length - compactEffects.length, 0)}
            contentType={fields.content_type}
            onRoll={onRoll}
          />
        ) : (
          <>
            {fields.traits?.length ? <TraitsList traits={fields.traits} /> : null}
            {fields.requirements?.length ? <RequirementsList requirements={fields.requirements} onRoll={onRoll} /> : null}
            {fields.targeting ? <TargetingBlock targeting={fields.targeting} onRoll={onRoll} /> : null}
            {visibleEffects.length ? (
              <SectionBlock title="Mechanics">
                <MechanicsList effects={visibleEffects} contentType={fields.content_type} onRoll={onRoll} />
              </SectionBlock>
            ) : null}
            {fields.scaling?.length ? <ScalingList scaling={fields.scaling} contentType={fields.content_type} onRoll={onRoll} /> : null}
            <NotesList notes={fields.notes} visibility={visibility} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

type SheetRenderProps = Required<Pick<ContentRenderProps, 'mode' | 'visibility'>> &
  Pick<ContentRenderProps, 'contentName' | 'summary' | 'className' | 'onRoll'> & {
    fields: Extract<ContentFields, { content_type: 'character_sheet_template' }>;
  };

function CharacterSheetTemplateRender({
  fields,
  contentName,
  summary,
  mode,
  visibility,
  className,
  onRoll,
}: SheetRenderProps) {
  if (visibility === 'player' && fields.render?.visibility === 'gm_only') {
    return <RestrictedContent className={className} />;
  }

  const sections = [...fields.sections]
    .filter((section) => isVisibleSheetPart(section.visibility, visibility))
    .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));
  const title = fields.title || contentName || 'Untitled sheet template';
  const shortText = fields.render?.short_text || summary;

  return (
    <Card className={cn('gap-4 rounded-md border-border bg-background shadow-none', className)}>
      <CardHeader className="gap-3 px-4 pt-4">
        <ContentHeader
          title={title}
          subtitle={fields.subtitle}
          summary={mode === 'compact' ? shortText : summary}
          shortText={mode === 'full' ? fields.render?.short_text : undefined}
          contentType="character_sheet_template"
          tags={fields.tags}
          system={fields.system}
        />
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        {mode === 'compact' ? (
          <div className="space-y-3">
            <MetadataRow label="Sections" value={String(sections.length)} />
            {sections.slice(0, 4).map((section) => (
              <Badge key={section.id} variant="outline">{section.label}</Badge>
            ))}
            {sections.length > 4 ? (
              <p className="text-xs text-muted-foreground">+{sections.length - 4} more sections</p>
            ) : null}
          </div>
        ) : (
          <>
            <SectionBlock title="Sheet Sections">
              <div className="space-y-3">
                {sections.map((section) => (
                  <SheetSectionPreview key={section.id} section={section} visibility={visibility} onRoll={onRoll} />
                ))}
              </div>
            </SectionBlock>
            {fields.mechanics?.length ? (
              <SectionBlock title="Template Mechanics">
                <MechanicsList
                  effects={fields.mechanics.filter((effect) => !isHiddenEffect(effect, visibility))}
                  contentType="character_sheet_template"
                  onRoll={onRoll}
                />
              </SectionBlock>
            ) : null}
            <NotesList notes={fields.notes} visibility={visibility} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UnknownContentRender({
  fields,
  contentName,
  summary,
  mode,
  className,
}: Pick<ContentRenderProps, 'fields' | 'contentName' | 'summary' | 'mode' | 'className'>) {
  const schemaVersion = isRecord(fields) && typeof fields.schema_version === 'string' ? fields.schema_version : undefined;
  const contentType = isRecord(fields) && typeof fields.content_type === 'string' ? fields.content_type : undefined;

  return (
    <Alert className={cn('rounded-md bg-background', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{contentName || 'Unsupported content format'}</AlertTitle>
      <AlertDescription>
        {summary ? <p>{summary}</p> : null}
        <div className="flex flex-wrap gap-2">
          {contentType ? <Badge variant="outline">{contentType}</Badge> : null}
          {schemaVersion ? <Badge variant="outline">{schemaVersion}</Badge> : null}
        </div>
        {mode === 'full' ? (
          <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
            {truncate(safeJson(fields), 1200)}
          </pre>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function RestrictedContent({ className }: { className?: string }) {
  return (
    <Alert className={cn('rounded-md bg-background', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>GM-only content</AlertTitle>
      <AlertDescription>This content is not visible to players.</AlertDescription>
    </Alert>
  );
}

function ContentHeader({
  title,
  subtitle,
  summary,
  shortText,
  contentType,
  tags,
  system,
}: {
  title: string;
  subtitle?: string;
  summary?: string | null;
  shortText?: string;
  contentType?: string;
  tags?: string[];
  system?: { id: string; version?: string };
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <CardTitle className="text-lg font-semibold leading-tight">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {summary ? <p className="text-sm">{summary}</p> : null}
      {shortText && shortText !== summary ? <p className="text-sm text-muted-foreground">{shortText}</p> : null}
      <div className="flex flex-wrap gap-2">
        {contentType ? <Badge variant="secondary">{formatLabel(contentType)}</Badge> : null}
        {system?.id ? (
          <Badge variant="outline">{system.version ? `${system.id} ${system.version}` : system.id}</Badge>
        ) : null}
        <TagList tags={tags} />
      </div>
    </div>
  );
}

function TagList({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <>
      {tags.map((tag) => (
        <Badge key={tag} variant="outline">{tag}</Badge>
      ))}
    </>
  );
}

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Separator className="flex-1" />
      </div>
      {children}
    </section>
  );
}

function MetadataRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="grid gap-1 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function TraitsList({ traits }: { traits: ContentTrait[] }) {
  return (
    <SectionBlock title="Traits">
      <dl className="grid gap-2 md:grid-cols-2">
        {traits.map((trait) => (
          <MetadataRow
            key={trait.key}
            label={trait.label || formatLabel(trait.key)}
            value={formatJsonValue(trait.value)}
          />
        ))}
      </dl>
    </SectionBlock>
  );
}

function RequirementsList({
  requirements,
  onRoll,
}: {
  requirements: ContentRequirement[];
  onRoll?: ContentRenderProps['onRoll'];
}) {
  return (
    <SectionBlock title="Requirements">
      <div className="space-y-2">
        {requirements.map((requirement, index) => (
          <div key={`${requirement.type}-${index}`} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatLabel(requirement.type || 'requirement')}</Badge>
              {requirement.resource ? <span className="text-sm">{requirement.resource}</span> : null}
              {requirement.component ? <span className="text-sm text-muted-foreground">Component: {requirement.component}</span> : null}
              {requirement.amount ? (
                <RollableText
                  amount={requirement.amount}
                  label={formatAmount(requirement.amount)}
                  onRoll={onRoll}
                  context={{ source: 'amount', label: requirement.type }}
                />
              ) : null}
            </div>
            {requirement.text ? <p className="text-sm text-muted-foreground">{requirement.text}</p> : null}
          </div>
        ))}
      </div>
    </SectionBlock>
  );
}

function TargetingBlock({
  targeting,
  onRoll,
}: {
  targeting: ContentTargeting;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  return (
    <SectionBlock title="Targeting">
      <div className="space-y-2 rounded-md border border-border p-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{formatLabel(targeting.type)}</Badge>
          {targeting.range ? <Badge variant="outline">Range: {formatRange(targeting.range)}</Badge> : null}
          {targeting.area ? (
            <Badge variant="outline">
              Area: {[targeting.area.size ? formatRange(targeting.area.size) : undefined, targeting.area.shape, targeting.area.origin].filter(Boolean).join(' ')}
            </Badge>
          ) : null}
          {targeting.target_count ? (
            <Badge variant="outline">
              Targets:{' '}
              <RollableText
                amount={targeting.target_count}
                label={formatAmount(targeting.target_count)}
                onRoll={onRoll}
                context={{ source: 'amount', label: 'Targets' }}
              />
            </Badge>
          ) : null}
          <TagList tags={targeting.tags} />
        </div>
        {targeting.text ? <p className="text-sm text-muted-foreground">{targeting.text}</p> : null}
      </div>
    </SectionBlock>
  );
}

function CompactMechanics({
  effects,
  remainingCount,
  contentType,
  onRoll,
}: {
  effects: ContentEffect[];
  remainingCount: number;
  contentType?: string;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  if (!effects.length && remainingCount === 0) {
    return <p className="text-sm text-muted-foreground">No mechanics defined.</p>;
  }

  return (
    <div className="space-y-2">
      {effects.map((effect, index) => (
        <EffectRow key={effect.id || `${effect.type}-${index}`} effect={effect} contentType={contentType} compact onRoll={onRoll} />
      ))}
      {remainingCount > 0 ? <p className="text-xs text-muted-foreground">+{remainingCount} more mechanics</p> : null}
    </div>
  );
}

function MechanicsList({
  effects,
  contentType,
  onRoll,
}: {
  effects: ContentEffect[];
  contentType?: string;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  return (
    <div className="space-y-3">
      {effects.map((effect, index) => (
        <EffectRow key={effect.id || `${effect.type}-${index}`} effect={effect} contentType={contentType} onRoll={onRoll} />
      ))}
    </div>
  );
}

function EffectRow({
  effect,
  contentType,
  compact = false,
  onRoll,
}: {
  effect: ContentEffect;
  contentType?: string;
  compact?: boolean;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  const label = effect.label || formatLabel(effect.type);

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline">{formatLabel(effect.type)}</Badge>
        {effect.applies_on ? <Badge variant="secondary">{formatLabel(effect.applies_on)}</Badge> : null}
        {effect.source ? <Badge variant="outline">Source: {effect.source}</Badge> : null}
        <TagList tags={effect.tags} />
      </div>
      <div className="text-sm text-muted-foreground">
        {renderEffectBody(effect, contentType, compact, onRoll)}
      </div>
    </div>
  );
}

function renderEffectBody(
  effect: ContentEffect,
  contentType: string | undefined,
  compact: boolean,
  onRoll?: ContentRenderProps['onRoll'],
) {
  const rollContext = {
    contentType,
    effectId: effect.id,
    effectType: effect.type,
    label: effect.label || formatLabel(effect.type),
  };

  switch (effect.type) {
    case 'damage':
      return (
        <span>
          <RollableText amount={effect.amount} label={formatAmount(effect.amount)} onRoll={onRoll} context={{ ...rollContext, source: 'amount' }} />{' '}
          {effect.damage_type} damage
        </span>
      );
    case 'healing':
      return (
        <span>
          Healing:{' '}
          <RollableText amount={effect.amount} label={formatAmount(effect.amount)} onRoll={onRoll} context={{ ...rollContext, source: 'amount' }} />
        </span>
      );
    case 'condition':
      return [effect.condition, formatDuration(effect.duration)].filter(Boolean).join(', ');
    case 'movement':
      return [formatLabel(effect.mode || 'movement'), formatRange(effect.distance), effect.direction].filter(Boolean).join(' ');
    case 'resource':
      return (
        <span>
          {formatLabel(effect.operation)} {effect.amount ? (
            <RollableText amount={effect.amount} label={formatAmount(effect.amount)} onRoll={onRoll} context={{ ...rollContext, source: 'amount' }} />
          ) : null}{' '}
          {effect.resource}
        </span>
      );
    case 'attack':
      return (
        <div className="space-y-2">
          <p>{[formatLabel(effect.attack_type || 'attack'), effect.attribute, formatDifficulty(effect.difficulty)].filter(Boolean).join(', ')}</p>
          {!compact ? <OutcomeList title="On Hit" outcomes={effect.on_hit} /> : null}
          {!compact ? <OutcomeList title="On Miss" outcomes={effect.on_miss} /> : null}
        </div>
      );
    case 'saving_throw':
      return (
        <div className="space-y-2">
          <p>{[effect.ability ? `${formatLabel(effect.ability)} save` : 'Saving throw', formatDifficulty(effect.difficulty)].filter(Boolean).join(', ')}</p>
          {!compact && effect.outcomes ? (
            <div className="space-y-2">
              {Object.entries(effect.outcomes).map(([outcome, actions]) => (
                <OutcomeList key={outcome} title={formatLabel(outcome)} outcomes={actions} />
              ))}
            </div>
          ) : null}
        </div>
      );
    case 'area':
      return [formatRange(effect.size), effect.shape, effect.origin ? `from ${effect.origin}` : undefined].filter(Boolean).join(' ');
    case 'text':
      return effect.text;
    case 'custom':
      return (
        <div className="space-y-2">
          <p>Custom: {effect.custom_type}</p>
          {!compact ? <JsonPreview value={effect.data} /> : null}
        </div>
      );
    default: {
      const unknownEffect = effect as { type?: string };
      return `Unknown mechanic: ${unknownEffect.type || 'custom'}`;
    }
  }
}

function OutcomeList({ title, outcomes }: { title: string; outcomes?: ContentOutcomeAction[] }) {
  if (!outcomes?.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {outcomes.map((outcome, index) => (
          <li key={index} className="rounded-md bg-muted/30 px-2 py-1 text-xs">
            {formatOutcome(outcome)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScalingList({
  scaling,
  contentType,
  onRoll,
}: {
  scaling: ContentScalingRule[];
  contentType?: string;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  return (
    <SectionBlock title="Scaling">
      <div className="space-y-3">
        {scaling.map((rule, index) => (
          <div key={index} className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">{formatScalingTrigger(rule)}</p>
            {rule.effects.length ? (
              <div className="space-y-2">
                {rule.effects.map((effect, effectIndex) => (
                  <ScalingEffectRow
                    key={effectIndex}
                    effect={effect}
                    contentType={contentType}
                    onRoll={onRoll}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionBlock>
  );
}

function ScalingEffectRow({
  effect,
  contentType,
  onRoll,
}: {
  effect: ContentScalingEffect;
  contentType?: string;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  if (effect.type === 'add_effect') {
    return <EffectRow effect={effect.effect} contentType={contentType} onRoll={onRoll} />;
  }

  if (effect.type === 'custom') {
    return (
      <div className="rounded-md bg-muted/30 p-2 text-sm text-muted-foreground">
        Custom scaling: {effect.custom_type}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-muted/30 p-2 text-sm text-muted-foreground">
      {formatLabel(effect.type)} {effect.target_effect ? `for ${effect.target_effect}` : null}
      {effect.add ? `, add ${formatAmount(effect.add)}` : null}
      {effect.multiply !== undefined ? `, multiply by ${effect.multiply}` : null}
    </div>
  );
}

function NotesList({
  notes,
  visibility,
}: {
  notes?: ContentNote[];
  visibility: ContentRenderVisibility;
}) {
  const visibleNotes = notes?.filter((note) => visibility === 'gm' || note.type !== 'gm_note') ?? [];
  if (!visibleNotes.length) return null;

  return (
    <SectionBlock title="Notes">
      <div className="space-y-2">
        {visibleNotes.map((note, index) => (
          <div key={`${note.type}-${index}`} className="space-y-1 rounded-md border border-border p-3">
            <Badge variant="outline">{formatLabel(note.type)}</Badge>
            <p className="text-sm text-muted-foreground">{note.text}</p>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
}

function SheetSectionPreview({
  section,
  visibility,
  onRoll,
}: {
  section: CharacterSheetTemplateSection;
  visibility: ContentRenderVisibility;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  const fields = section.fields.filter((field) => isVisibleSheetPart(field.visibility, visibility));

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold">{section.label}</h4>
          <SheetVisibilityBadges visibility={section.visibility} />
        </div>
        {section.description ? <p className="text-sm text-muted-foreground">{section.description}</p> : null}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {fields.map((field) => (
          <SheetFieldPreview key={field.id} field={field} onRoll={onRoll} />
        ))}
      </div>
    </div>
  );
}

function SheetFieldPreview({
  field,
  onRoll,
}: {
  field: CharacterSheetTemplateField;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  const formula = field.formula || (field.field_type === 'dice' || field.field_type === 'formula' ? field.source : undefined);

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{field.label}</span>
        <Badge variant="outline">{formatLabel(field.field_type)}</Badge>
        {field.required ? <Badge variant="secondary">Required</Badge> : null}
        <SheetVisibilityBadges visibility={field.visibility} />
      </div>
      {field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {field.default !== undefined ? <span>Default: {formatJsonValue(field.default)}</span> : null}
        {field.min !== undefined ? <span>Min: {field.min}</span> : null}
        {field.max !== undefined ? <span>Max: {field.max}</span> : null}
        {field.source ? <span>Source: {field.source}</span> : null}
      </div>
      {formula ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{field.field_type === 'dice' ? 'Dice' : 'Formula'}: {formula}</span>
          {onRoll ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRoll(formula, { source: 'sheet_field', fieldId: field.id, label: field.label })}
            >
              Roll
            </Button>
          ) : null}
        </div>
      ) : null}
      {field.options?.length ? (
        <div className="flex flex-wrap gap-2">
          {field.options.map((option) => (
            <Badge key={`${option.label}-${formatJsonValue(option.value)}`} variant="outline">
              {option.label}
            </Badge>
          ))}
        </div>
      ) : null}
      {field.custom ? <JsonPreview value={field.custom} /> : null}
    </div>
  );
}

function SheetVisibilityBadges({ visibility }: { visibility?: CharacterSheetTemplateField['visibility'] }) {
  if (!visibility) return null;
  return (
    <>
      {visibility.readonly ? <Badge variant="outline">Readonly</Badge> : null}
      {visibility.role ? <Badge variant="outline">{formatLabel(visibility.role)}</Badge> : null}
      {visibility.condition ? <Badge variant="outline">Conditional</Badge> : null}
    </>
  );
}

function RollableText({
  amount,
  label,
  context,
  onRoll,
}: {
  amount: ContentAmount;
  label: string;
  context: ContentRollContext;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  const expression = getAmountExpression(amount);
  if (!expression || !onRoll) return <>{label}</>;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{label}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => onRoll(expression, context)}>
        Roll
      </Button>
    </span>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="max-h-40 overflow-auto rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
      {truncate(safeJson(value), 800)}
    </pre>
  );
}

function formatAmount(amount?: ContentAmount) {
  if (!amount) return '';
  if (amount.label) return amount.label;
  if (amount.type === 'fixed') return String(amount.value);
  return amount.expression;
}

function getAmountExpression(amount?: ContentAmount) {
  if (!amount || amount.type === 'fixed') return undefined;
  return amount.expression;
}

function formatDuration(duration?: ContentDuration) {
  if (!duration) return '';
  if (duration.type === 'instant') return 'instant';
  if (duration.type === 'scene') return 'for the scene';
  if (duration.type === 'until_removed') return 'until removed';
  if (duration.type === 'custom') return duration.text;
  return `for ${duration.value} ${duration.type}`;
}

function formatDifficulty(difficulty?: ContentDifficulty) {
  if (!difficulty) return '';
  if (difficulty.type === 'fixed') return `DC ${difficulty.value}`;
  if (difficulty.type === 'caster_dc') return 'caster DC';
  if (difficulty.type === 'attribute') return `attribute: ${difficulty.attribute}`;
  if (difficulty.type === 'formula') return `formula: ${difficulty.expression}`;
  if (difficulty.type === 'custom') return difficulty.text;
  return '';
}

function formatRange(range?: ContentRange) {
  if (!range) return '';
  if (range.text) return range.text;
  return [range.value, range.unit].filter((part) => part !== undefined && part !== '').join(' ');
}

function formatJsonValue(value: JSONValue | undefined) {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return safeJson(value);
}

function formatOutcome(outcome: ContentOutcomeAction) {
  if (outcome.type === 'text') return outcome.text;
  if (outcome.type === 'apply_effects') {
    return `Apply effects: ${outcome.effect_ids.join(', ')}${outcome.modifier ? ` (${formatLabel(outcome.modifier.type)})` : ''}`;
  }
  if (outcome.type === 'damage_modifier') {
    return `${formatLabel(outcome.mode)} damage for ${outcome.target_effects.join(', ')}`;
  }
  return `Custom outcome: ${outcome.custom_type}`;
}

function formatScalingTrigger(rule: ContentScalingRule) {
  const parts = [
    formatLabel(rule.trigger.type),
    rule.trigger.base !== undefined ? `base ${rule.trigger.base}` : undefined,
    rule.trigger.value !== undefined ? formatJsonValue(rule.trigger.value) : undefined,
    rule.trigger.text,
  ].filter(Boolean);
  return parts.join(', ');
}

function formatLabel(value?: string) {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isHiddenEffect(effect: ContentEffect, visibility: ContentRenderVisibility) {
  if (effect.render?.hidden) return true;
  return visibility === 'player' && effect.render?.emphasis === 'gm_only';
}

function isVisibleSheetPart(
  visibility: CharacterSheetTemplateSection['visibility'] | CharacterSheetTemplateField['visibility'],
  role: ContentRenderVisibility,
) {
  if (!visibility) return true;
  if (visibility.hidden) return false;
  if (role === 'player' && visibility.role === 'gm') return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[Unserializable content]';
  }
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}
