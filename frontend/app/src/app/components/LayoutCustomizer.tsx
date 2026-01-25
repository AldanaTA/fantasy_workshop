import { useState } from 'react';
import { CharacterSheetTab, ContentCategoryDefinition, Content } from '../types/game';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';

interface LayoutCustomizerProps {
  tabs: CharacterSheetTab[];
  categories: ContentCategoryDefinition[];
  content: Content[];
  onSave: (tabs: CharacterSheetTab[]) => void;
  onClose: () => void;
}

export function LayoutCustomizer({ tabs, categories, content, onSave, onClose }: LayoutCustomizerProps) {
  const [editingTabs, setEditingTabs] = useState<CharacterSheetTab[]>(tabs);

  const addTab = () => {
    const newTab: CharacterSheetTab = {
      id: Date.now().toString(),
      name: 'New Tab',
      contentIds: [],
    };
    setEditingTabs([...editingTabs, newTab]);
  };

  const deleteTab = (tabId: string) => {
    if (editingTabs.length <= 1) {
      toast.error('Must have at least one tab');
      return;
    }
    setEditingTabs(editingTabs.filter((t) => t.id !== tabId));
  };

  const updateTab = (tabId: string, updates: Partial<CharacterSheetTab>) => {
    setEditingTabs(
      editingTabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t))
    );
  };

  const moveTab = (tabId: string, direction: 'up' | 'down') => {
    const index = editingTabs.findIndex((t) => t.id === tabId);
    if (index < 0) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editingTabs.length) return;

    const newTabs = [...editingTabs];
    [newTabs[index], newTabs[newIndex]] = [newTabs[newIndex], newTabs[index]];
    setEditingTabs(newTabs);
  };

  const toggleContent = (tabId: string, contentId: string) => {
    const tab = editingTabs.find((t) => t.id === tabId);
    if (!tab) return;

    const contentIds = tab.contentIds.includes(contentId)
      ? tab.contentIds.filter((id) => id !== contentId)
      : [...tab.contentIds, contentId];

    updateTab(tabId, { contentIds });
  };

  const handleSave = () => {
    // Validate
    for (const tab of editingTabs) {
      if (!tab.name.trim()) {
        toast.error('All tabs must have a name');
        return;
      }
    }

    onSave(editingTabs);
    toast.success('Layout saved!');
  };

  const getContentName = (contentId: string): string => {
    const contentItem = content.find((c) => c.id === contentId);
    if (!contentItem) return 'Unknown';
    
    const category = categories.find((c) => c.id === contentItem.category);
    return category ? `${category.name} > ${contentItem.name}` : contentItem.name;
  };

  // Get content from categories that appear on character sheet
  const availableContent = content.filter((c) => {
    const category = categories.find((cat) => cat.id === c.category);
    return category?.appearOnCharacterSheet;
  });

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 sticky top-0 bg-background py-4 border-b z-10">
            <h2 className="text-xl sm:text-2xl font-bold">Customize Layout</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button onClick={handleSave}>
                <span>Save Layout</span>
              </Button>
            </div>
          </div>

          {/* Info */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Organize your character sheet by creating custom tabs and grouping content types together.
                For example, create a "Combat" tab with Attributes and Weapons, or an "Inventory" tab with Equipment and Items.
              </p>
            </CardContent>
          </Card>

          {/* Add Tab Button */}
          <div className="flex justify-end">
            <Button onClick={addTab}>
              <Plus className="w-4 h-4 mr-2" />
              Add Tab
            </Button>
          </div>

          {/* Tabs */}
          <div className="space-y-4">
            {editingTabs.map((tab, index) => (
              <Card key={tab.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveTab(tab.id, 'up')}
                        disabled={index === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveTab(tab.id, 'down')}
                        disabled={index === editingTabs.length - 1}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <Input
                      value={tab.name}
                      onChange={(e) => updateTab(tab.id, { name: e.target.value })}
                      placeholder="Tab name..."
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTab(tab.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Content types in this tab:</label>
                    {availableContent.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No content types available. Make sure categories are marked to appear on character sheet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availableContent.map((contentItem) => (
                          <label
                            key={contentItem.id}
                            className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={tab.contentIds.includes(contentItem.id)}
                              onChange={() => toggleContent(tab.id, contentItem.id)}
                              className="rounded"
                            />
                            <span className="text-sm">{getContentName(contentItem.id)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {tab.contentIds.length === 0 && availableContent.length > 0 && (
                      <p className="text-xs text-muted-foreground italic mt-2">
                        Select at least one content type for this tab
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
