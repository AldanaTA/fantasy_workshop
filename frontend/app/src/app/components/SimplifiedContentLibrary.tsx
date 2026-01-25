import { useState } from 'react';
import { Content, ContentCategoryDefinition } from '../types/game';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { ContentEditor } from './ContentEditor';

interface SimplifiedContentLibraryProps {
  gameId: string;
  content: Content[];
  mechanics: never[]; // Deprecated, kept for backward compatibility
  contentCategories: ContentCategoryDefinition[];
  onSaveContent: (content: Content) => void;
  onDeleteContent: (id: string) => void;
  onSaveMechanic?: (mechanic: never) => void; // Deprecated
  onDeleteMechanic?: (id: string) => void; // Deprecated
  onSaveCategory: (category: ContentCategoryDefinition) => void;
  onDeleteCategory: (id: string) => void;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

export function SimplifiedContentLibrary({
  gameId,
  content,
  contentCategories,
  onSaveContent,
  onDeleteContent,
  onSaveCategory,
  onDeleteCategory,
}: SimplifiedContentLibraryProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<ContentCategoryDefinition | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showContentEditor, setShowContentEditor] = useState(false);

  const toggleCategory = (categoryId: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryId)) {
      newCollapsed.delete(categoryId);
    } else {
      newCollapsed.add(categoryId);
    }
    setCollapsedCategories(newCollapsed);
  };

  // Create new category
  const createCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    const newCategory: ContentCategoryDefinition = {
      id: Date.now().toString(),
      name: newCategoryName,
      parentId: newCategoryParentId || undefined,
      createdAt: new Date().toISOString(),
      appearOnCharacterSheet: false,
    };

    onSaveCategory(newCategory);
    setNewCategoryName('');
    setNewCategoryParentId('');
    toast.success('Category created');
  };

  // Save category edits
  const saveCategory = () => {
    if (!editingCategory) return;

    if (!editingCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    onSaveCategory(editingCategory);
    setEditingCategory(null);
    toast.success('Category updated');
  };

  // Create new content
  const createContent = () => {
    if (!selectedCategoryId) {
      toast.error('Please select a category first');
      return;
    }

    const newContent: Content = {
      id: Date.now().toString(),
      gameId,
      name: '',
      description: '',
      category: selectedCategoryId,
      fields: [],
      createdAt: new Date().toISOString(),
    };

    setEditingContent(newContent);
    setShowContentEditor(true);
  };

  const handleSaveContent = (content: Content) => {
    onSaveContent(content);
    setEditingContent(null);
    setShowContentEditor(false);
    toast.success('Content saved');
  };

  const handleEditContent = (content: Content) => {
    setEditingContent(content);
    setShowContentEditor(true);
  };

  // Get content for selected category
  const categoryContent = selectedCategoryId
    ? content.filter((c) => c.category === selectedCategoryId)
    : [];

  // Get root categories (no parent)
  const rootCategories = contentCategories.filter((c) => !c.parentId);

  // Get subcategories for a parent
  const getSubcategories = (parentId: string) => {
    return contentCategories.filter((c) => c.parentId === parentId);
  };

  // Recursive category tree renderer
  const renderCategoryTree = (parentCategories: ContentCategoryDefinition[], depth: number = 0) => {
    return parentCategories.map((category) => {
      const isCollapsed = collapsedCategories.has(category.id);
      const isSelected = selectedCategoryId === category.id;
      const subcategories = getSubcategories(category.id);
      const hasSubcategories = subcategories.length > 0;
      const contentCount = content.filter((c) => c.category === category.id).length;

      return (
        <div key={category.id}>
          <div
            className={`
              flex items-center gap-1 sm:gap-2 p-2 rounded-md cursor-pointer transition-colors
              ${isSelected ? 'bg-purple-100 dark:bg-purple-900/30 font-medium' : 'hover:bg-accent/50'}
            `}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {/* Collapse/Expand Icon */}
            {hasSubcategories ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategory(category.id);
                }}
                className="p-0.5 shrink-0"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : (
                  <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
              </button>
            ) : (
              <div className="w-3 sm:w-4" />
            )}

            {/* Category Name */}
            <div
              className="flex-1 min-w-0 flex items-center gap-2"
              onClick={() => setSelectedCategoryId(category.id)}
            >
              <span className="truncate text-sm">{category.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">({contentCount})</span>
            </div>

            {/* Edit/Delete Buttons */}
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCategory(category);
                }}
                className="h-6 w-6 sm:h-7 sm:w-7 p-0"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${category.name}"? This will also delete all content in this category.`)) {
                    onDeleteCategory(category.id);
                    if (selectedCategoryId === category.id) {
                      setSelectedCategoryId(null);
                    }
                  }
                }}
                className="h-6 w-6 sm:h-7 sm:w-7 p-0"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          </div>

          {/* Render subcategories */}
          {!isCollapsed && hasSubcategories && renderCategoryTree(subcategories, depth + 1)}
        </div>
      );
    });
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Categories Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Category Tree */}
            <div className="border rounded-md max-h-64 sm:max-h-96 overflow-y-auto">
              {rootCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No categories yet
                </p>
              ) : (
                <div className="p-2">{renderCategoryTree(rootCategories)}</div>
              )}
            </div>

            {/* Add New Category */}
            <div className="space-y-2 pt-3 border-t">
              <label className="text-xs font-medium">Add New Category</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createCategory()}
                  className="text-sm"
                />
                <Button onClick={createCategory} size="sm" className="shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <select
                value={newCategoryParentId}
                onChange={(e) => setNewCategoryParentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              >
                <option value="">Top level category</option>
                {contentCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Content List Panel */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">
                {selectedCategoryId
                  ? contentCategories.find((c) => c.id === selectedCategoryId)?.name || 'Content'
                  : 'Content'}
              </CardTitle>
              {selectedCategoryId && (
                <Button onClick={createContent} size="sm" className="shrink-0">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedCategoryId ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Select a category to view content
              </p>
            ) : categoryContent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No content in this category yet
              </p>
            ) : (
              <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                {categoryContent.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleEditContent(item)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <h3 className="font-medium text-sm truncate">{item.name}</h3>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.description.substring(0, 80)}
                            {item.description.length > 80 && '...'}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.fields.length} field{item.fields.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Delete "${item.name}"?`)) {
                            onDeleteContent(item.id);
                          }
                        }}
                        className="shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Editor */}
      {editingCategory && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base sm:text-lg">Edit Category</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingCategory(null)} size="sm">
                  Cancel
                </Button>
                <Button onClick={saveCategory} size="sm">
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">Category Name</label>
              <Input
                value={editingCategory.name}
                onChange={(e) =>
                  setEditingCategory({ ...editingCategory, name: e.target.value })
                }
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Parent Category</label>
              <select
                value={editingCategory.parentId || ''}
                onChange={(e) =>
                  setEditingCategory({
                    ...editingCategory,
                    parentId: e.target.value || undefined,
                  })
                }
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              >
                <option value="">Top level category</option>
                {contentCategories
                  .filter((cat) => cat.id !== editingCategory.id)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="appearOnSheet"
                checked={editingCategory.appearOnCharacterSheet ?? false}
                onChange={(e) =>
                  setEditingCategory({
                    ...editingCategory,
                    appearOnCharacterSheet: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="appearOnSheet" className="text-xs cursor-pointer">
                Show content from this category on character sheets
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Editor Modal */}
      {showContentEditor && editingContent && (
        <ContentEditor
          content={editingContent}
          gameId={gameId}
          contentCategories={contentCategories}
          allContent={content}
          onSave={handleSaveContent}
          onClose={() => {
            setShowContentEditor(false);
            setEditingContent(null);
          }}
        />
      )}
    </>
  );
}