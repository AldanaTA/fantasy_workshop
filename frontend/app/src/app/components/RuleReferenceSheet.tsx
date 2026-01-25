import { Content, ContentCategoryDefinition } from '../types/game';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { RuleViewer } from './RuleViewer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';
import { Search, BookOpen, ChevronRight } from 'lucide-react';
import { Badge } from './ui/badge';

/**
 * RuleReferenceSheet displays a searchable library of game content organized by categories.
 * Shows content in a hierarchical category structure and allows viewing detailed content.
 * 
 * @param open - Whether the sheet is open
 * @param onOpenChange - Callback when sheet open state changes
 * @param content - All game content
 * @param contentCategories - All content categories
 * @param gameId - Current game ID to filter content
 */
interface RuleReferenceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: Content[];
  contentCategories: ContentCategoryDefinition[];
  gameId: string;
}

export function RuleReferenceSheet({
  open,
  onOpenChange,
  content,
  contentCategories,
  gameId,
}: RuleReferenceSheetProps) {
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get all content for this game
  const gameContent = content.filter((c) => c.gameId === gameId);

  // Filter by search query - show all content, not just those with descriptions
  const filteredContent = gameContent.filter((c) => {
    if (!searchQuery) return true;
    
    return c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Helper to get category path (e.g., "Item > Weapon")
  const getCategoryPath = (categoryId: string): string => {
    const category = contentCategories.find((c) => c.id === categoryId);
    if (!category) return 'Unknown';
    if (!category.parentId) return category.name;
    
    const parent = contentCategories.find((c) => c.id === category.parentId);
    return parent ? `${getCategoryPath(parent.id)} > ${category.name}` : category.name;
  };

  // Build hierarchical category structure
  const buildCategoryHierarchy = () => {
    // Get top-level categories (those without parents)
    const topLevelCategories = contentCategories.filter((cat) => !cat.parentId);
    
    const buildTree = (parentCat: ContentCategoryDefinition): any => {
      const children = contentCategories.filter((cat) => cat.parentId === parentCat.id);
      const items = filteredContent.filter((c) => c.category === parentCat.id);
      
      return {
        category: parentCat,
        items,
        children: children.map((child) => buildTree(child)),
      };
    };
    
    return topLevelCategories.map((cat) => buildTree(cat));
  };

  const categoryTree = buildCategoryHierarchy();

  // Render a category and its children recursively
  const renderCategory = (node: any, depth: number = 0) => {
    // Skip categories with no content (no items and no children with items)
    if (node.items.length === 0 && node.children.every((child: any) => child.items.length === 0 && child.children.length === 0)) {
      return null;
    }
    
    return (
      <div key={node.category.id} className={depth > 0 ? 'ml-4' : ''}>
        {/* Category Header */}
        <h3 className={`font-semibold text-sm ${depth === 0 ? 'text-muted-foreground uppercase tracking-wide' : 'text-muted-foreground'} mb-2`}>
          {depth > 0 && <ChevronRight className="w-3 h-3 inline mr-1" />}
          {node.category.name}
        </h3>
        
        {/* Content Items */}
        {node.items.length > 0 && (
          <div className="space-y-1 mb-3">
            {node.items.map((item: Content) => (
              <Button
                key={item.id}
                variant="ghost"
                className="w-full justify-start h-auto py-2"
                onClick={() => setSelectedContent(item)}
              >
                <span className="font-medium">{item.name}</span>
              </Button>
            ))}
          </div>
        )}
        
        {/* Child Categories */}
        {node.children.map((child: any) => renderCategory(child, depth + 1))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Reference Library
          </SheetTitle>
          <SheetDescription>
            Browse and search game rules and content
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-8rem)] mt-4">
          {selectedContent ? (
            // Show selected content
            <div className="flex flex-col h-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedContent(null)}
                className="mb-4 w-fit"
              >
                ← Back to List
              </Button>
              
              <ScrollArea className="flex-1 pr-4">
                <RuleViewer content={selectedContent} compact />
              </ScrollArea>
            </div>
          ) : (
            // Show content list
            <div className="flex flex-col h-full gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search content..."
                  className="pl-9"
                />
              </div>

              {/* Content List */}
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  {categoryTree.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No content found</p>
                    </div>
                  ) : (
                    categoryTree.map((node) => renderCategory(node))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}