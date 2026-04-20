import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { contentApi } from '../../api/contentApi';
import { contentCategoriesApi } from '../../api/contentCategoriesApi';
import { contentPacksApi } from '../../api/contentPacksApi';
import type { Content, ContentCategory, ContentPack, ContentVersion } from '../../api/models';
import { STATUS } from '../../types/status';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';
import { ContentRender, type ContentRenderProps } from './ContentRender';

export type ContentRulesFilters = {
  search?: string;
  packIds?: string[];
  categoryIds?: string[];
  contentTypes?: string[];
  tags?: string[];
  systems?: string[];
  includeNoActiveVersion?: boolean;
};

export type GameRulesRendererProps = {
  gameId: string;
  selectedPackIds?: string[];
  onSelectedPackIdsChange?: (packIds: string[]) => void;
  packMode?: 'single' | 'multi';
  renderStrategy?: 'pack_first';
  mode?: 'compact' | 'full';
  visibility?: 'player' | 'gm';
  filters?: ContentRulesFilters;
  onFiltersChange?: (filters: ContentRulesFilters) => void;
  onRoll?: ContentRenderProps['onRoll'];
  className?: string;
};

type RulebookContentItem = {
  content: Content;
  activeVersion?: ContentVersion;
  error?: string;
};

type RulebookCategory = {
  category: ContentCategory;
  items: RulebookContentItem[];
};

type RulebookPack = {
  pack: ContentPack;
  categories: RulebookCategory[];
};

type LoadState = {
  packs: ContentPack[];
  rulebook: RulebookPack[];
  isLoading: boolean;
  error: string | null;
};

export function GameRulesRenderer({
  gameId,
  selectedPackIds,
  onSelectedPackIdsChange,
  packMode = 'multi',
  mode = 'compact',
  visibility = 'player',
  filters,
  onFiltersChange,
  onRoll,
  className,
}: GameRulesRendererProps) {
  const [state, setState] = useState<LoadState>({
    packs: [],
    rulebook: [],
    isLoading: true,
    error: null,
  });
  const [internalPackIds, setInternalPackIds] = useState<string[]>([]);
  const [internalFilters, setInternalFilters] = useState<ContentRulesFilters>({});

  const activeFilters = filters ?? internalFilters;
  const activePackIds = selectedPackIds ?? internalPackIds;

  useEffect(() => {
    let isCancelled = false;

    const loadRules = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const packs = await contentPacksApi.listByGame(gameId, 100, 0);
        const visiblePacks = visibility === 'player'
          ? packs.filter((pack) => pack.status === STATUS.PUBLISHED)
          : packs;
        const rulebook = await Promise.all(visiblePacks.map(loadRulebookPack));

        if (!isCancelled) {
          setState({ packs: visiblePacks, rulebook, isLoading: false, error: null });
        }
      } catch (err) {
        if (!isCancelled) {
          setState({ packs: [], rulebook: [], isLoading: false, error: (err as Error)?.message || 'Unable to load rules.' });
        }
      }
    };

    loadRules();

    return () => {
      isCancelled = true;
    };
  }, [gameId, visibility]);

  useEffect(() => {
    if (selectedPackIds || !state.packs.length || internalPackIds.length) return;
    setInternalPackIds(state.packs.map((pack) => pack.id));
  }, [internalPackIds.length, selectedPackIds, state.packs]);

  const selectedRulebook = useMemo(() => {
    const selected = activePackIds.length ? activePackIds : state.packs.map((pack) => pack.id);
    return state.rulebook
      .filter((packGroup) => selected.includes(packGroup.pack.id))
      .map((packGroup) => filterRulebookPack(packGroup, activeFilters, visibility));
  }, [activeFilters, activePackIds, state.packs, state.rulebook, visibility]);

  const updateSelectedPackIds = (nextPackIds: string[]) => {
    const normalized = packMode === 'single' ? nextPackIds.slice(-1) : nextPackIds;
    if (onSelectedPackIdsChange) {
      onSelectedPackIdsChange(normalized);
    } else {
      setInternalPackIds(normalized);
    }
  };

  const updateFilters = (patch: Partial<ContentRulesFilters>) => {
    const nextFilters = { ...activeFilters, ...patch };
    if (onFiltersChange) {
      onFiltersChange(nextFilters);
    } else {
      setInternalFilters(nextFilters);
    }
  };

  if (state.isLoading) {
    return <RulesStateMessage className={className} title="Loading rules" message="Gathering packs, categories, and active content versions." />;
  }

  if (state.error) {
    return <RulesStateMessage className={className} title="Unable to load rules" message={state.error} destructive />;
  }

  if (!state.packs.length) {
    return <RulesStateMessage className={className} title="No rules available" message="No visible content packs were found for this game." />;
  }

  return (
    <div className={cn('min-w-0 space-y-6', className)}>
      <RulesToolbar
        packs={state.packs}
        selectedPackIds={activePackIds}
        packMode={packMode}
        filters={activeFilters}
        onSelectedPackIdsChange={updateSelectedPackIds}
        onFiltersChange={updateFilters}
      />

      {selectedRulebook.every((packGroup) => packGroup.categories.every((category) => !category.items.length)) ? (
        <RulesStateMessage title="No matching rules" message="Try changing the selected packs or filters." />
      ) : (
        <div className="space-y-8">
          {selectedRulebook.map((packGroup) => (
            <RulePackSection
              key={packGroup.pack.id}
              packGroup={packGroup}
              mode={mode}
              visibility={visibility}
              onRoll={onRoll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

async function loadRulebookPack(pack: ContentPack): Promise<RulebookPack> {
  const categories = await contentCategoriesApi.listByPack(pack.id, 100, 0);
  const orderedCategories = [...categories].sort((a, b) => a.sort_key - b.sort_key);
  const categoryGroups = await Promise.all(
    orderedCategories.map(async (category) => {
      const contentItems = await contentApi.listByCategory(category.id, 100, 0);
      const items = await Promise.all(contentItems.map(loadRulebookContentItem));
      return { category, items };
    }),
  );

  return {
    pack,
    categories: categoryGroups,
  };
}

async function loadRulebookContentItem(content: Content): Promise<RulebookContentItem> {
  try {
    const activeVersion = await contentApi.getActive(content.id);
    return { content, activeVersion };
  } catch (err) {
    return {
      content,
      error: (err as Error)?.message || 'No active version found.',
    };
  }
}

function RulesToolbar({
  packs,
  selectedPackIds,
  packMode,
  filters,
  onSelectedPackIdsChange,
  onFiltersChange,
}: {
  packs: ContentPack[];
  selectedPackIds: string[];
  packMode: 'single' | 'multi';
  filters: ContentRulesFilters;
  onSelectedPackIdsChange: (packIds: string[]) => void;
  onFiltersChange: (filters: Partial<ContentRulesFilters>) => void;
}) {
  const activePackIds = selectedPackIds.length ? selectedPackIds : packs.map((pack) => pack.id);

  const togglePack = (packId: string) => {
    if (packMode === 'single') {
      onSelectedPackIdsChange([packId]);
      return;
    }

    onSelectedPackIdsChange(
      activePackIds.includes(packId)
        ? activePackIds.filter((id) => id !== packId)
        : [...activePackIds, packId],
    );
  };

  return (
    <Card className="min-w-0 rounded-md border-border bg-background shadow-none">
      <CardHeader className="min-w-0 gap-2 px-4 pt-4">
        <CardTitle className="text-base">Rules Sources</CardTitle>
        <p className="text-sm text-muted-foreground">Choose the packs that make up this rules view.</p>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <div className="grid gap-2 md:grid-cols-2">
          {packs.map((pack) => (
            <label key={pack.id} className="flex min-w-0 items-start gap-3 rounded-md border border-border p-3">
              <Checkbox
                checked={activePackIds.includes(pack.id)}
                onCheckedChange={() => togglePack(pack.id)}
                className="mt-0.5"
              />
              <span className="min-w-0 space-y-1">
                <span className="block break-words text-sm font-medium">{pack.pack_name}</span>
                {pack.description ? <span className="block break-words text-sm text-muted-foreground">{pack.description}</span> : null}
                <span className="flex flex-wrap gap-2">
                  <Badge variant="outline">{pack.status}</Badge>
                  <Badge variant="outline">{pack.visibility}</Badge>
                </span>
              </span>
            </label>
          ))}
        </div>

        <Separator />

        <div className="grid gap-2">
          <Label htmlFor="rules-search">Filter Rules</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="rules-search"
              value={filters.search ?? ''}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              placeholder="Search names, summaries, tags, systems, or rule text"
              className="pl-9"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RulePackSection({
  packGroup,
  mode,
  visibility,
  onRoll,
}: {
  packGroup: RulebookPack;
  mode: 'compact' | 'full';
  visibility: 'player' | 'gm';
  onRoll?: ContentRenderProps['onRoll'];
}) {
  const categoriesWithItems = packGroup.categories.filter((categoryGroup) => categoryGroup.items.length);
  if (!categoriesWithItems.length) return null;

  return (
    <section className="min-w-0 space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-xl font-semibold">{packGroup.pack.pack_name}</h2>
          <Badge variant="outline">{packGroup.pack.status}</Badge>
        </div>
        {packGroup.pack.description ? (
          <p className="break-words text-sm text-muted-foreground">{packGroup.pack.description}</p>
        ) : null}
      </div>

      <div className="space-y-6">
        {categoriesWithItems.map((categoryGroup) => (
          <RuleCategorySection
            key={categoryGroup.category.id}
            categoryGroup={categoryGroup}
            mode={mode}
            visibility={visibility}
            onRoll={onRoll}
          />
        ))}
      </div>
    </section>
  );
}

function RuleCategorySection({
  categoryGroup,
  mode,
  visibility,
  onRoll,
}: {
  categoryGroup: RulebookCategory;
  mode: 'compact' | 'full';
  visibility: 'player' | 'gm';
  onRoll?: ContentRenderProps['onRoll'];
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="border-b border-border pb-2">
        <h3 className="break-words text-lg font-semibold">{categoryGroup.category.name}</h3>
      </div>
      <div className={cn('grid min-w-0 gap-4', mode === 'compact' && 'md:grid-cols-2')}>
        {categoryGroup.items.map((item) => (
          <RuleContentItem
            key={item.content.id}
            item={item}
            mode={mode}
            visibility={visibility}
            onRoll={onRoll}
          />
        ))}
      </div>
    </section>
  );
}

function RuleContentItem({
  item,
  mode,
  visibility,
  onRoll,
}: {
  item: RulebookContentItem;
  mode: 'compact' | 'full';
  visibility: 'player' | 'gm';
  onRoll?: ContentRenderProps['onRoll'];
}) {
  if (!item.activeVersion) {
    return (
      <Alert className="rounded-md bg-background">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{item.content.name}</AlertTitle>
        <AlertDescription>{item.error || 'No active version found.'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <ContentRender
      fields={item.activeVersion.fields}
      contentName={item.content.name}
      summary={item.content.summary}
      mode={mode}
      visibility={visibility}
      onRoll={onRoll}
    />
  );
}

function RulesStateMessage({
  title,
  message,
  destructive = false,
  className,
}: {
  title: string;
  message: string;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <Alert variant={destructive ? 'destructive' : 'default'} className={cn('rounded-md bg-background', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function filterRulebookPack(
  packGroup: RulebookPack,
  filters: ContentRulesFilters,
  visibility: 'player' | 'gm',
): RulebookPack {
  return {
    ...packGroup,
    categories: packGroup.categories
      .filter((categoryGroup) => !filters.categoryIds?.length || filters.categoryIds.includes(categoryGroup.category.id))
      .map((categoryGroup) => ({
        ...categoryGroup,
        items: categoryGroup.items.filter((item) => matchesRulesFilters(item, categoryGroup.category, filters, visibility)),
      })),
  };
}

function matchesRulesFilters(
  item: RulebookContentItem,
  category: ContentCategory,
  filters: ContentRulesFilters,
  visibility: 'player' | 'gm',
) {
  if (!item.activeVersion && visibility === 'player') return false;
  if (!item.activeVersion && !filters.includeNoActiveVersion) return false;

  const fields = item.activeVersion?.fields;
  const maybeTypedFields = fields as {
    content_type?: string;
    tags?: string[];
    system?: { id?: string };
    render?: { short_text?: string; long_text?: string };
  } | undefined;

  if (filters.contentTypes?.length && !filters.contentTypes.includes(maybeTypedFields?.content_type ?? '')) {
    return false;
  }

  if (filters.tags?.length && !filters.tags.some((tag) => maybeTypedFields?.tags?.includes(tag))) {
    return false;
  }

  if (filters.systems?.length && !filters.systems.includes(maybeTypedFields?.system?.id ?? '')) {
    return false;
  }

  const search = filters.search?.trim().toLowerCase();
  if (!search) return true;

  const haystack = [
    item.content.name,
    item.content.summary,
    category.name,
    maybeTypedFields?.content_type,
    maybeTypedFields?.system?.id,
    maybeTypedFields?.render?.short_text,
    maybeTypedFields?.render?.long_text,
    ...(maybeTypedFields?.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(search);
}
