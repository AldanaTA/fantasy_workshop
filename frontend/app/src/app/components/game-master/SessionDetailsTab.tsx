import { Session } from '../../types/game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SessionDetailsTab component allows editing session information including
 * name, GM notes, and player invite link.
 * 
 * @param session - The session object being edited
 * @param onUpdateSession - Callback function to update session properties, receives partial session updates
 * @returns A card with session details editing form
 */
interface SessionDetailsTabProps {
  session: Session;
  onUpdateSession: (updates: Partial<Session>) => void;
}

export function SessionDetailsTab({ session, onUpdateSession }: SessionDetailsTabProps) {
  const copyInviteLink = () => {
    if (!session.inviteCode) return;

    const inviteLink = `${window.location.origin}?invite=${session.inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied to clipboard!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Session Name</label>
          <Input
            value={session.name}
            onChange={(e) => onUpdateSession({ name: e.target.value })}
            placeholder="Enter session name..."
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">GM Notes</label>
          <Textarea
            value={session.gmNotes}
            onChange={(e) => onUpdateSession({ gmNotes: e.target.value })}
            placeholder="Private notes for the GM..."
            rows={4}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Player Invite</label>
          <div className="flex gap-2">
            <Input
              value={`${window.location.origin}?invite=${session.inviteCode}`}
              readOnly
              className="font-mono text-xs"
            />
            <Button onClick={copyInviteLink} variant="outline">
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Share this link with players to invite them to your session
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
