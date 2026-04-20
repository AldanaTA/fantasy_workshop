import { BookOpen, Edit3, Eye, Link2, PackageOpen, Trash2 } from 'lucide-react';

import type { LibraryGame } from '../../api/models';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';

export type ViewGamesProps = {
  games: LibraryGame[];
  isLoading?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onOpen?: (game: LibraryGame) => void;
  onPreview?: (game: LibraryGame) => void;
  onManagePacks?: (game: LibraryGame) => void;
  onShare?: (game: LibraryGame) => void;
  onEdit?: (game: LibraryGame) => void;
  onDelete?: (game: LibraryGame) => void;
};

const canEditGame = (game: LibraryGame) => game.role === 'owner' || game.role === 'editor';
const canDeleteGame = (game: LibraryGame) => game.role === 'owner';

const labelForRole = (role?: string) => {
  if (!role) return 'Library';
  return role.charAt(0).toUpperCase() + role.slice(1);
};

export function ViewGames({
  games,
  isLoading = false,
  error = null,
  title = 'Game Library',
  description = 'Games you own or have added to your library.',
  emptyTitle = 'No games found',
  emptyDescription = 'Games you create or accept from share links will appear here.',
  onOpen,
  onPreview,
  onManagePacks,
  onShare,
  onEdit,
  onDelete,
}: ViewGamesProps) {
  return (
    <div className="grid min-w-0 gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="min-w-0">
        <h2 className="break-words text-xl font-semibold">{title}</h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p>
      </div>

      <Separator />

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
          Loading games...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center">
          <h3 className="break-words text-base font-semibold">{emptyTitle}</h3>
          <p className="mt-2 break-words text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => {
            const showEditorActions = canEditGame(game);
            const showDelete = canDeleteGame(game);

            return (
              <Card key={game.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="break-words text-base font-semibold leading-6">
                        {game.game_name}
                      </CardTitle>
                      <CardDescription className="mt-1 break-words leading-6">
                        {game.game_summary || 'No summary available.'}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge variant="outline" className="max-w-full whitespace-normal break-words">
                        {labelForRole(game.role)}
                      </Badge>
                      <Badge variant="secondary" className="max-w-full whitespace-normal break-words">
                        {game.visibility}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {onOpen ? (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => onOpen(game)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Open
                      </Button>
                    ) : null}
                    {onPreview ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => onPreview(game)}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Preview
                      </Button>
                    ) : null}
                    {showEditorActions && onManagePacks ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => onManagePacks(game)}
                      >
                        <PackageOpen className="h-3.5 w-3.5" />
                        Packs
                      </Button>
                    ) : null}
                    {showEditorActions && onShare ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => onShare(game)}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Share
                      </Button>
                    ) : null}
                    {showEditorActions && onEdit ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => onEdit(game)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : null}
                    {showDelete && onDelete ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => onDelete(game)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
