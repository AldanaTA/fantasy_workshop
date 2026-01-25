import { Session } from '../../types/game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Trash2 } from 'lucide-react';

/**
 * SessionList component displays all sessions for a selected game and allows
 * creating, selecting, and deleting sessions.
 * 
 * @param sessions - Array of all sessions (will be filtered by gameId)
 * @param gameId - ID of the currently selected game to filter sessions
 * @param selectedSessionId - Currently selected session ID (if any)
 * @param onCreateSession - Callback function when creating a new session
 * @param onSelectSession - Callback function when selecting a session, receives the session object
 * @param onDeleteSession - Callback function when deleting a session, receives the session ID
 * @returns A card containing session management UI
 */
interface SessionListProps {
  sessions: Session[];
  gameId: string;
  selectedSessionId: string | null;
  onCreateSession: () => void;
  onSelectSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionList({
  sessions,
  gameId,
  selectedSessionId,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
}: SessionListProps) {
  const gameSessions = sessions.filter((s) => s.gameId === gameId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>My Sessions</CardTitle>
          <Button onClick={onCreateSession}>
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {gameSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No sessions yet. Create your first session!
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {gameSessions.map((session) => (
              <div
                key={session.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedSessionId === session.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => onSelectSession(session)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{session.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {session.npcs.length} NPCs • {session.encounters.length} Encounters
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
