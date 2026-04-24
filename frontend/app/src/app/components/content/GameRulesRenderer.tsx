import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react';
import { campaignsApi } from '../../api/campaignsApi';
import { contentApi } from '../../api/contentApi';
import { contentCategoriesApi } from '../../api/contentCategoriesApi';
import { contentPacksApi } from '../../api/contentPacksApi';
import type { CampaignContentVersion, Content, ContentCategory, ContentPack, ContentVersion, ContentWithActiveVersion } from '../../api/models';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { useToast } from '../ui/toastProvider';
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
  campaignId?: string;
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
  legacyVersions: ContentVersion[];
  error?: string;
  searchText: string;
};

type RulebookCategory = {
  category: ContentCategory;
  items: RulebookContentItem[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  hasMore: boolean;
  nextOffset: number;
};

type RulebookPack = {
  pack: ContentPack;
  categories: RulebookCategory[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
};

type LoadState = {
  packs: ContentPack[];
  isLoading: boolean;
  error: string | null;
};

const PACK_LIMIT = 100;
const CATEGORY_LIMIT = 100;
const CONTENT_PAGE_SIZE = 20;

export function GameRulesRenderer({
  gameId,
  campaignId,
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
  const { toast } = useToast();
  const [state, setState] = useState<LoadState>({
    packs: [],
    isLoading: true,
    error: null,
  });
  const [packRulebooks, setPackRulebooks] = useState<Record<string, RulebookPack>>({});
  const [campaignPins, setCampaignPins] = useState<Record<string, CampaignContentVersion>>({});
  const [pendingPinnedContentId, setPendingPinnedContentId] = useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [internalPackIds, setInternalPackIds] = useState<string[]>([]);
  const [internalFilters, setInternalFilters] = useState<ContentRulesFilters>({});
  const packControllers = useRef<Record<string, AbortController>>({});
  const categoryControllers = useRef<Record<string, AbortController>>({});

  const activeFilters = filters ?? internalFilters;
  const debouncedSearch = useDebouncedValue(activeFilters.search ?? '', 250);
  const effectiveFilters = useMemo(
    () => ({ ...activeFilters, search: debouncedSearch }),
    [
      activeFilters.categoryIds,
      activeFilters.contentTypes,
      activeFilters.includeNoActiveVersion,
      activeFilters.packIds,
      activeFilters.systems,
      activeFilters.tags,
      debouncedSearch,
    ],
  );
  const activePackIds = selectedPackIds ?? internalPackIds;

  useEffect(() => {
    if (!campaignId) {
      setCampaignPins({});
      return;
    }

    let cancelled = false;

    const loadPins = async () => {
      try {
        const pins = await campaignsApi.listPins(campaignId);
        if (cancelled) return;
        setCampaignPins(Object.fromEntries(pins.map((pin) => [pin.content_id, pin])));
      } catch {
        if (cancelled) return;
        setCampaignPins({});
      }
    };

    void loadPins();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    const controller = new AbortController();

    const loadPacks = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      setPackRulebooks({});
      setExpandedCategoryId(null);

      try {
        const packs = await contentPacksApi.listByGame(gameId, PACK_LIMIT, 0, { signal: controller.signal });
        setState({ packs, isLoading: false, error: null });
      } catch (err) {
        if (isAbortError(err)) return;
        setState({ packs: [], isLoading: false, error: (err as Error)?.message || 'Unable to load rules.' });
      }
    };

    loadPacks();

    return () => {
      controller.abort();
    };
  }, [gameId, visibility]);

  useEffect(() => {
    return () => {
      Object.values(packControllers.current).forEach((controller) => controller.abort());
      packControllers.current = {};
      Object.values(categoryControllers.current).forEach((controller) => controller.abort());
      categoryControllers.current = {};
    };
  }, []);

  useEffect(() => {
    if (selectedPackIds || !state.packs.length || internalPackIds.length) return;
    setInternalPackIds([state.packs[0].id]);
  }, [internalPackIds.length, selectedPackIds, state.packs]);

  const selectedIds = useMemo(() => {
    if (activePackIds.length) return activePackIds;
    return state.packs[0] ? [state.packs[0].id] : [];
  }, [activePackIds, state.packs]);

  const selectedRulebooks = useMemo(() => (
    selectedIds
      .map((packId) => packRulebooks[packId] ?? createEmptyRulebookPack(state.packs.find((pack) => pack.id === packId)))
      .filter((packGroup): packGroup is RulebookPack => Boolean(packGroup))
      .map((packGroup) => filterRulebookPack(packGroup, effectiveFilters, visibility))
  ), [effectiveFilters, packRulebooks, selectedIds, state.packs, visibility]);

  const loadPackCategories = useCallback(async (pack: ContentPack, signal?: AbortSignal) => {
    setPackRulebooks((prev) => ({
      ...prev,
      [pack.id]: prev[pack.id] ?? {
        pack,
        categories: [],
        isLoading: true,
        error: null,
        hasLoaded: false,
      },
    }));

    try {
      const categories = await contentCategoriesApi.listByPack(pack.id, CATEGORY_LIMIT, 0, { signal });
      const orderedCategories = [...categories].sort((a, b) => a.sort_key - b.sort_key);
      setPackRulebooks((prev) => ({
        ...prev,
        [pack.id]: {
          pack,
          categories: orderedCategories.map(createEmptyRulebookCategory),
          isLoading: false,
          error: null,
          hasLoaded: true,
        },
      }));
    } catch (err) {
      if (isAbortError(err)) return;
      setPackRulebooks((prev) => ({
        ...prev,
        [pack.id]: {
          pack,
          categories: prev[pack.id]?.categories ?? [],
          isLoading: false,
          error: (err as Error)?.message || 'Unable to load categories.',
          hasLoaded: true,
        },
      }));
    } finally {
      if (packControllers.current[pack.id]?.signal === signal) {
        delete packControllers.current[pack.id];
      }
    }
  }, []);

  useEffect(() => {
    const missingPackIds = selectedIds.filter((packId) => {
      const packState = packRulebooks[packId];
      return !packState?.hasLoaded && !packState?.isLoading;
    });
    if (!missingPackIds.length) return;

    missingPackIds.forEach((packId) => {
      const pack = state.packs.find((candidate) => candidate.id === packId);
      if (!pack) return;
      packControllers.current[packId]?.abort();
      const controller = new AbortController();
      packControllers.current[packId] = controller;
      void loadPackCategories(pack, controller.signal);
    });
  }, [loadPackCategories, packRulebooks, selectedIds, state.packs]);

  const loadCategoryContent = useCallback(async (packId: string, category: ContentCategory, force = false) => {
    const packGroup = packRulebooks[packId];
    const current = packGroup?.categories.find((candidate) => candidate.category.id === category.id);
    if (!current || (current.hasLoaded && !current.hasMore && !force) || current.isLoading) return;

    categoryControllers.current[category.id]?.abort();
    const controller = new AbortController();
    categoryControllers.current[category.id] = controller;
    const offset = force ? 0 : current.nextOffset;

    setPackRulebooks((prev) => updateCategory(prev, packId, category.id, (categoryGroup) => ({
      ...categoryGroup,
      items: force ? [] : categoryGroup.items,
      isLoading: true,
      error: null,
    })));

    try {
      const contentRows = await contentApi.listByCategoryWithActive(category.id, CONTENT_PAGE_SIZE, offset, true, { signal: controller.signal });
      const items = await Promise.all(
        contentRows.map(async (row) => {
          if (visibility !== 'gm') {
            return createRulebookContentItem(row, category);
          }

          try {
            const versions = await contentApi.listVersions(row.content.id, { signal: controller.signal });
            return createRulebookContentItem(row, category, versions);
          } catch (err) {
            if (isAbortError(err)) throw err;
            return createRulebookContentItem(row, category);
          }
        }),
      );

      setPackRulebooks((prev) => updateCategory(prev, packId, category.id, (categoryGroup) => ({
        ...categoryGroup,
        items: force ? items : [...categoryGroup.items, ...items],
        isLoading: false,
        error: null,
        hasLoaded: true,
        hasMore: contentRows.length === CONTENT_PAGE_SIZE,
        nextOffset: offset + contentRows.length,
      })));
    } catch (err) {
      if (isAbortError(err)) return;
      setPackRulebooks((prev) => updateCategory(prev, packId, category.id, (categoryGroup) => ({
        ...categoryGroup,
        isLoading: false,
        error: (err as Error)?.message || 'Unable to load content.',
        hasLoaded: true,
      })));
    } finally {
      if (categoryControllers.current[category.id] === controller) {
        delete categoryControllers.current[category.id];
      }
    }
  }, [packRulebooks]);

  const toggleCategory = (packId: string, category: ContentCategory) => {
    const categoryId = category.id;
    if (expandedCategoryId === categoryId) {
      categoryControllers.current[categoryId]?.abort();
      delete categoryControllers.current[categoryId];
      setExpandedCategoryId(null);
      setPackRulebooks((prev) => pruneCategoryContent(prev, null));
      return;
    }

    Object.entries(categoryControllers.current).forEach(([id, controller]) => {
      if (id !== categoryId) controller.abort();
    });
    categoryControllers.current = {};
    setExpandedCategoryId(categoryId);
    setPackRulebooks((prev) => pruneCategoryContent(prev, categoryId));
    void loadCategoryContent(packId, category);
  };

  const updateSelectedPackIds = (nextPackIds: string[]) => {
    const normalized = packMode === 'single' ? nextPackIds.slice(-1) : nextPackIds;
    setExpandedCategoryId(null);
    setPackRulebooks((prev) => pruneCategoryContent(prev, null));
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

  const handlePinnedVersionChange = async (contentId: string, value: string) => {
    if (!campaignId) return;

    setPendingPinnedContentId(contentId);

    try {
      if (value === 'active') {
        await campaignsApi.deletePin(campaignId, contentId);
        setCampaignPins((prev) => {
          const next = { ...prev };
          delete next[contentId];
          return next;
        });
        toast({
          title: 'Rule version reset',
          description: 'This rule now follows the game default active version.',
          variant: 'success',
        });
        return;
      }

      const pinnedVersionNum = Number(value);
      const pin = await campaignsApi.upsertPin(campaignId, contentId, {
        campaign_id: campaignId,
        content_id: contentId,
        pinned_version_num: pinnedVersionNum,
      });
      setCampaignPins((prev) => ({ ...prev, [contentId]: pin }));
      toast({
        title: 'Rule version pinned',
        description: `This campaign now uses v${pinnedVersionNum} for this rule.`,
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Unable to update rule version',
        description: (err as Error)?.message || 'The campaign rule version could not be updated.',
        variant: 'destructive',
      });
    } finally {
      setPendingPinnedContentId(null);
    }
  };

  if (state.isLoading) {
    return <RulesStateMessage className={className} title="Loading rules" message="Gathering available rule packs." />;
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
        selectedPackIds={selectedIds}
        packMode={packMode}
        filters={activeFilters}
        onSelectedPackIdsChange={updateSelectedPackIds}
        onFiltersChange={updateFilters}
      />

      {selectedRulebooks.length ? (
        <div className="space-y-8">
          {selectedRulebooks.map((packGroup) => (
            <RulePackSection
              key={packGroup.pack.id}
              packGroup={packGroup}
              expandedCategoryId={expandedCategoryId}
              mode={mode}
              visibility={visibility}
              campaignId={campaignId}
              campaignPins={campaignPins}
              pendingPinnedContentId={pendingPinnedContentId}
              onToggleCategory={toggleCategory}
              onLoadMore={loadCategoryContent}
              onPinnedVersionChange={handlePinnedVersionChange}
              onRoll={onRoll}
            />
          ))}
        </div>
      ) : (
        <RulesStateMessage title="No selected rules" message="Choose a pack to load its rules." />
      )}
    </div>
  );
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
  const togglePack = (packId: string) => {
    if (packMode === 'single') {
      onSelectedPackIdsChange([packId]);
      return;
    }

    onSelectedPackIdsChange(
      selectedPackIds.includes(packId)
        ? selectedPackIds.filter((id) => id !== packId)
        : [...selectedPackIds, packId],
    );
  };

  return (
    <Card className="min-w-0 rounded-md border-border bg-background shadow-none">
      <CardHeader className="min-w-0 gap-2 px-4 pt-4">
        <CardTitle className="text-base">Rules Sources</CardTitle>
        <p className="text-sm text-muted-foreground">Choose the packs that make up this rules view. Rule details load when opened.</p>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <div className="grid gap-2 md:grid-cols-2">
          {packs.map((pack) => (
            <label key={pack.id} className="flex min-w-0 items-start gap-3 rounded-md border border-border p-3">
              <Checkbox
                checked={selectedPackIds.includes(pack.id)}
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
          <Label htmlFor="rules-search">Filter Loaded Rules</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="rules-search"
              value={filters.search ?? ''}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              placeholder="Search loaded names, summaries, tags, systems, or rule text"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">Open a category to include its full rule text in search.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RulePackSection({
  packGroup,
  expandedCategoryId,
  mode,
  visibility,
  campaignId,
  campaignPins,
  pendingPinnedContentId,
  onToggleCategory,
  onLoadMore,
  onPinnedVersionChange,
  onRoll,
}: {
  packGroup: RulebookPack;
  expandedCategoryId: string | null;
  mode: 'compact' | 'full';
  visibility: 'player' | 'gm';
  campaignId?: string;
  campaignPins: Record<string, CampaignContentVersion>;
  pendingPinnedContentId: string | null;
  onToggleCategory: (packId: string, category: ContentCategory) => void;
  onLoadMore: (packId: string, category: ContentCategory) => void;
  onPinnedVersionChange: (contentId: string, value: string) => Promise<void>;
  onRoll?: ContentRenderProps['onRoll'];
}) {
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

      {packGroup.isLoading ? (
        <InlineLoading message="Loading categories..." />
      ) : packGroup.error ? (
        <RulesStateMessage title="Unable to load categories" message={packGroup.error} destructive />
      ) : packGroup.categories.length ? (
        <div className="space-y-3">
          {packGroup.categories.map((categoryGroup) => (
            <RuleCategorySection
              key={categoryGroup.category.id}
              packId={packGroup.pack.id}
              categoryGroup={categoryGroup}
              isExpanded={expandedCategoryId === categoryGroup.category.id}
              mode={mode}
              visibility={visibility}
              campaignId={campaignId}
              campaignPins={campaignPins}
              pendingPinnedContentId={pendingPinnedContentId}
              onToggleCategory={onToggleCategory}
              onLoadMore={onLoadMore}
              onPinnedVersionChange={onPinnedVersionChange}
              onRoll={onRoll}
            />
          ))}
        </div>
      ) : (
        <RulesStateMessage title="No categories" message="This pack does not have any categories yet." />
      )}
    </section>
  );
}

function RuleCategorySection({
  packId,
  categoryGroup,
  isExpanded,
  mode,
  visibility,
  campaignId,
  campaignPins,
  pendingPinnedContentId,
  onToggleCategory,
  onLoadMore,
  onPinnedVersionChange,
  onRoll,
}: {
  packId: string;
  categoryGroup: RulebookCategory;
  isExpanded: boolean;
  mode: 'compact' | 'full';
  visibility: 'player' | 'gm';
  campaignId?: string;
  campaignPins: Record<string, CampaignContentVersion>;
  pendingPinnedContentId: string | null;
  onToggleCategory: (packId: string, category: ContentCategory) => void;
  onLoadMore: (packId: string, category: ContentCategory) => void;
  onPinnedVersionChange: (contentId: string, value: string) => Promise<void>;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  return (
    <section className="min-w-0 rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => onToggleCategory(packId, categoryGroup.category)}
        className="flex min-h-[52px] w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block break-words text-base font-semibold">{categoryGroup.category.name}</span>
          <span className="block text-xs text-muted-foreground">
            {categoryGroup.hasLoaded ? `${categoryGroup.items.length}${categoryGroup.hasMore ? '+' : ''} loaded rules` : 'Rule content loads when opened'}
          </span>
        </span>
        {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {isExpanded ? (
        <div className="space-y-4 border-t border-border p-4">
          {categoryGroup.isLoading && !categoryGroup.items.length ? (
            <InlineLoading message="Loading content..." />
          ) : categoryGroup.error ? (
            <RulesStateMessage title="Unable to load content" message={categoryGroup.error} destructive />
          ) : categoryGroup.items.length ? (
            <>
              <div className={cn('grid min-w-0 gap-4', mode === 'compact' && 'md:grid-cols-2')}>
                {categoryGroup.items.map((item) => (
                  <RuleContentItem
                    key={item.content.id}
                    item={item}
                    mode={mode}
                    visibility={visibility}
                    campaignId={campaignId}
                    pinnedVersionNum={campaignPins[item.content.id]?.pinned_version_num}
                    isUpdatingVersion={pendingPinnedContentId === item.content.id}
                    onPinnedVersionChange={onPinnedVersionChange}
                    onRoll={onRoll}
                  />
                ))}
              </div>
              {categoryGroup.hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onLoadMore(packId, categoryGroup.category)}
                  disabled={categoryGroup.isLoading}
                  className="min-h-[44px] w-full"
                >
                  {categoryGroup.isLoading ? 'Loading more...' : 'Load More Rules'}
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No matching content in this category.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function RuleContentItem({
  item,
  mode,
  visibility,
  campaignId,
  pinnedVersionNum,
  isUpdatingVersion,
  onPinnedVersionChange,
  onRoll,
}: {
  item: RulebookContentItem;
  mode: 'compact' | 'full';
  visibility: 'player' | 'gm';
  campaignId?: string;
  pinnedVersionNum?: number;
  isUpdatingVersion: boolean;
  onPinnedVersionChange: (contentId: string, value: string) => Promise<void>;
  onRoll?: ContentRenderProps['onRoll'];
}) {
  const availableVersions = [
    ...(item.activeVersion ? [item.activeVersion] : []),
    ...item.legacyVersions,
  ].sort((a, b) => b.version_num - a.version_num);
  const effectiveVersion = availableVersions.find((version) => version.version_num === pinnedVersionNum)
    ?? item.activeVersion
    ?? availableVersions[0];
  const comparisonVersions = availableVersions.filter((version) => version.version_num !== effectiveVersion?.version_num);

  if (!effectiveVersion) {
    return (
      <Alert className="rounded-md bg-background">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{item.content.name}</AlertTitle>
        <AlertDescription>{item.error || 'No active version found.'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {pinnedVersionNum ? `In Effect v${effectiveVersion.version_num}` : `Active v${effectiveVersion.version_num}`}
        </Badge>
        {pinnedVersionNum && item.activeVersion && pinnedVersionNum !== item.activeVersion.version_num ? (
          <Badge variant="outline">Default active v{item.activeVersion.version_num}</Badge>
        ) : null}
        {comparisonVersions.length ? (
          <Badge variant="outline">{comparisonVersions.length} other versions</Badge>
        ) : null}
      </div>

      {visibility === 'gm' && campaignId && availableVersions.length ? (
        <div className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center">
          <div className="space-y-1">
            <p className="text-sm font-medium">Campaign Rule Version</p>
            <p className="text-xs text-muted-foreground">
              Pick the version this table is using. Choose active to follow the game default.
            </p>
          </div>
          <Select
            value={pinnedVersionNum ? String(pinnedVersionNum) : 'active'}
            onValueChange={(value) => void onPinnedVersionChange(item.content.id, value)}
            disabled={isUpdatingVersion}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">
                {item.activeVersion ? `Use active default (v${item.activeVersion.version_num})` : 'Use active default'}
              </SelectItem>
              {availableVersions.map((version) => (
                <SelectItem key={version.id} value={String(version.version_num)}>
                  v{version.version_num}{version.version_num === item.activeVersion?.version_num ? ' (active)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <ContentRender
        fields={effectiveVersion.fields}
        contentName={item.content.name}
        summary={item.content.summary}
        mode={mode}
        visibility={visibility}
        onRoll={onRoll}
      />

      {visibility === 'gm' && comparisonVersions.length ? (
        <Accordion type="single" collapsible className="rounded-md border border-border bg-background">
          <AccordionItem value="other-versions" className="border-b-0">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              <span className="flex flex-wrap items-center gap-2">
                <span>Other Versions</span>
                <Badge variant="outline">{comparisonVersions.length}</Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                {comparisonVersions.map((version) => (
                  <div key={version.id} className="space-y-3 rounded-md border border-dashed border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {version.version_num === item.activeVersion?.version_num ? `Default active v${version.version_num}` : `Version v${version.version_num}`}
                      </Badge>
                    </div>
                    <ContentRender
                      fields={version.fields}
                      contentName={`${item.content.name} (v${version.version_num})`}
                      summary={item.content.summary}
                      mode={mode}
                      visibility={visibility}
                      onRoll={onRoll}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
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

function InlineLoading({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {message}
    </div>
  );
}

function createRulebookContentItem(
  row: ContentWithActiveVersion,
  category: ContentCategory,
  versions: ContentVersion[] = [],
): RulebookContentItem {
  const activeVersion = row.active_version ?? undefined;
  const legacyVersions = versions
    .filter((version) => version.version_num !== activeVersion?.version_num)
    .sort((a, b) => b.version_num - a.version_num);

  return {
    content: row.content,
    activeVersion,
    legacyVersions,
    error: row.error || 'No active version found.',
    searchText: buildRuleSearchText(row.content, category, activeVersion, legacyVersions),
  };
}

function createEmptyRulebookPack(pack?: ContentPack): RulebookPack | null {
  if (!pack) return null;
  return {
    pack,
    categories: [],
    isLoading: true,
    error: null,
    hasLoaded: false,
  };
}

function createEmptyRulebookCategory(category: ContentCategory): RulebookCategory {
  return {
    category,
    items: [],
    isLoading: false,
    error: null,
    hasLoaded: false,
    hasMore: false,
    nextOffset: 0,
  };
}

function updateCategory(
  packRulebooks: Record<string, RulebookPack>,
  packId: string,
  categoryId: string,
  updater: (category: RulebookCategory) => RulebookCategory,
) {
  const packGroup = packRulebooks[packId];
  if (!packGroup) return packRulebooks;

  return {
    ...packRulebooks,
    [packId]: {
      ...packGroup,
      categories: packGroup.categories.map((categoryGroup) => (
        categoryGroup.category.id === categoryId ? updater(categoryGroup) : categoryGroup
      )),
    },
  };
}

function pruneCategoryContent(packRulebooks: Record<string, RulebookPack>, keepCategoryId: string | null) {
  return Object.fromEntries(
    Object.entries(packRulebooks).map(([packId, packGroup]) => [
      packId,
      {
        ...packGroup,
        categories: packGroup.categories.map((categoryGroup) => (
          categoryGroup.category.id === keepCategoryId
            ? categoryGroup
            : {
                ...categoryGroup,
                items: [],
                isLoading: false,
                error: null,
                hasLoaded: false,
                hasMore: false,
                nextOffset: 0,
              }
        )),
      },
    ]),
  );
}

function filterRulebookPack(
  packGroup: RulebookPack,
  filters: ContentRulesFilters,
  visibility: 'player' | 'gm',
): RulebookPack {
  const search = filters.search?.trim().toLowerCase();

  return {
    ...packGroup,
    categories: packGroup.categories
      .filter((categoryGroup) => !filters.categoryIds?.length || filters.categoryIds.includes(categoryGroup.category.id))
      .filter((categoryGroup) => !search || categoryGroup.category.name.toLowerCase().includes(search) || categoryGroup.items.some((item) => item.searchText.includes(search)))
      .map((categoryGroup) => ({
        ...categoryGroup,
        items: categoryGroup.items.filter((item) => matchesRulesFilters(item, filters, visibility, search)),
      })),
  };
}

function matchesRulesFilters(
  item: RulebookContentItem,
  filters: ContentRulesFilters,
  visibility: 'player' | 'gm',
  search?: string,
) {
  const filterVersion = item.activeVersion ?? item.legacyVersions[0];
  if (!filterVersion && visibility === 'player') return false;
  if (!filterVersion && !filters.includeNoActiveVersion) return false;

  const fields = filterVersion?.fields;
  const maybeTypedFields = fields as {
    content_type?: string;
    tags?: string[];
    system?: { id?: string };
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

  return !search || item.searchText.includes(search);
}

function buildRuleSearchText(
  content: Content,
  category: ContentCategory,
  activeVersion?: ContentVersion,
  legacyVersions: ContentVersion[] = [],
) {
  const collectFields = (version?: ContentVersion) => {
    const fields = version?.fields as {
      content_type?: string;
      tags?: string[];
      system?: { id?: string };
      render?: { short_text?: string; long_text?: string };
    } | undefined;

    return [
      fields?.content_type,
      fields?.system?.id,
      fields?.render?.short_text,
      fields?.render?.long_text,
      ...(fields?.tags ?? []),
    ];
  };

  return [
    content.name,
    content.summary,
    category.name,
    ...collectFields(activeVersion),
    ...legacyVersions.flatMap((version) => [`version ${version.version_num}`, `legacy v${version.version_num}`, ...collectFields(version)]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}
