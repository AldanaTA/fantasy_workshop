import { useState, useMemo } from 'react';
import { Content, ContentCategoryDefinition } from '../types/game';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';

interface ContentPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableContent: Content[];
  contentCategories: ContentCategoryDefinition[];
  allowedCategoryId?: string;
  onSelect: (contentId: string) => void;
  title?: string;
}

export function ContentPickerModal({
  open,
  onOpenChange,
  availableContent,
  contentCategories,
  allowedCategoryId,
  onSelect,
  title = 'Add Content',
}: ContentPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Helper: Get all descendant category IDs (including the parent itself)
  const getAllDescendantCategoryIds = (categoryId: string): string[] => {
    const descendants = [categoryId];
    const subcategories = contentCategories.filter((c) => c.parentId === categoryId);
    
    subcategories.forEach((subcat) => {
      descendants.push(...getAllDescendantCategoryIds(subcat.id));
    });
    
    return descendants;
  };

  // Filter content based on allowed category (includes subcategories)
  const filteredByCategory = useMemo(() => {
    if (allowedCategoryId) {
      const allowedCategoryIds = getAllDescendantCategoryIds(allowedCategoryId);
      return availableContent.filter((c) => allowedCategoryIds.includes(c.category));
    }
    return availableContent;
  }, [availableContent, allowedCategoryId, contentCategories]);

  // Filter content based on search query
  const searchedContent = useMemo(() => {
    if (!searchQuery.trim()) return filteredByCategory;
    
    const query = searchQuery.toLowerCase();
    return filteredByCategory.filter((c) =>
      c.name.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query)
    );
  }, [filteredByCategory, searchQuery]);

  // Get category path helper
  const getCategoryPath = (categoryId: string): string => {
    const category = contentCategories.find((c) => c.id === categoryId);
    if (!category) return 'Unknown';

    if (category.parentId) {
      const parent = contentCategories.find((c) => c.id === category.parentId);
      if (parent) {
        return `${getCategoryPath(parent.id)} > ${category.name}`;
      }
    }

    return category.name;
  };

  // Get top-level categories (only those that are relevant)
  const relevantCategories = useMemo(() => {
    if (allowedCategoryId) {
      const category = contentCategories.find((c) => c.id === allowedCategoryId);
      if (category) {
        // If it's a parent category, return it
        if (!category.parentId) return [category];
        
        // If it's a subcategory, return its parent
        const parent = contentCategories.find((c) => c.id === category.parentId);
        return parent ? [parent] : [category];
      }
      return [];
    }

    // Get all top-level categories that have content
    const categoriesWithContent = new Set(searchedContent.map((c) => {
      const cat = contentCategories.find((cat) => cat.id === c.category);
      if (!cat) return null;
      
      // Get root category
      let rootCat = cat;
      while (rootCat.parentId) {
        const parent = contentCategories.find((p) => p.id === rootCat.parentId);
        if (parent) rootCat = parent;
        else break;
      }
      return rootCat.id;
    }).filter(Boolean) as string[]);

    return contentCategories.filter(
      (c) => !c.parentId && categoriesWithContent.has(c.id)
    );
  }, [allowedCategoryId, contentCategories, searchedContent]);

  // Get subcategories for a parent
  const getSubcategories = (parentId: string) => {
    return contentCategories.filter((c) => c.parentId === parentId);
  };

  // Get content for a category
  const getContentForCategory = (categoryId: string) => {
    return searchedContent.filter((c) => c.category === categoryId);
  };

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle content selection
  const handleSelect = (contentId: string) => {
    onSelect(contentId);
    onOpenChange(false);
    setSearchQuery('');
  };

  // Render category recursively
  const renderCategory = (category: ContentCategoryDefinition, depth: number = 0) => {
    const subcategories = getSubcategories(category.id);
    const categoryContent = getContentForCategory(category.id);
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = subcategories.length > 0 || categoryContent.length > 0;

    // If searching and this category has no content, don't render it
    if (searchQuery && categoryContent.length === 0 && subcategories.length === 0) {
      return null;
    }

    return (
      <div key={category.id}>
        {/* Category Header */}
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 cursor-pointer rounded"
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
          onClick={() => hasChildren && toggleCategory(category.id)}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
          {!hasChildren && <div className="w-4" />}
          <span className="font-medium text-sm">{category.name}</span>
          <span className="text-xs text-muted-foreground">
            ({categoryContent.length})
          </span>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div>
            {/* Subcategories */}
            {subcategories.map((subcat) => renderCategory(subcat, depth + 1))}

            {/* Content items */}
            {categoryContent.map((content) => (
              <div
                key={content.id}
                className="flex items-start justify-between gap-2 py-2 px-3 hover:bg-muted/50 cursor-pointer rounded border-l-2 border-transparent hover:border-primary/50"
                style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}
                onClick={() => handleSelect(content.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{content.name}</div>
                  {content.description && (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {content.description.replace(/[#*_`]/g, '').substring(0, 100)}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(content.id);
                  }}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Select content to add to your game.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto border rounded-md">
          {searchedContent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No content found matching your search.' : 'No content available to add.'}
            </div>
          ) : (
            <div className="p-2">
              {relevantCategories.map((category) => renderCategory(category))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {searchedContent.length} item{searchedContent.length !== 1 ? 's' : ''} available
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}