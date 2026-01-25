import { Session, Content, ContentCategoryDefinition } from '../../types/game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';

/**
 * SharedContentManager component allows GMs to control which content items
 * are visible to players in the reference library.
 * 
 * @param session - The current session with shared content IDs
 * @param gameContent - Array of all content items for the game
 * @param contentCategories - Array of content category definitions
 * @param onUpdateSession - Callback to update the session's shared content IDs
 * @returns A card with checkboxes for each content item
 */
interface SharedContentManagerProps {
  session: Session;
  gameContent: Content[];
  contentCategories: ContentCategoryDefinition[];
  onUpdateSession: (updates: Partial<Session>) => void;
}

export function SharedContentManager({
  session,
  gameContent,
  contentCategories,
  onUpdateSession,
}: SharedContentManagerProps) {
  const toggleContentShare = (contentId: string) => {
    const shared = session.sharedContentIds || [];
    const isShared = shared.includes(contentId);

    onUpdateSession({
      sharedContentIds: isShared
        ? shared.filter((id) => id !== contentId)
        : [...shared, contentId],
    });

    toast.success(isShared ? 'Content hidden from players' : 'Content shared with players');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shared Content</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Select which content players can view in the reference library
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {gameContent.map((c) => {
            const category = contentCategories.find((cat) => cat.id === c.category);
            const isShared = session.sharedContentIds?.includes(c.id);

            return (
              <label
                key={c.id}
                className="flex items-start gap-3 p-2 border rounded cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={() => toggleContentShare(c.id)}
                  className="mt-1 w-4 h-4 rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {category && (
                      <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                        {category.name}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {c.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
