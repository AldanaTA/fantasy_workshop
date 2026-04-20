import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Link2 } from 'lucide-react';

import { gamesApi } from '../api/gamesApi';
import type { GameSharePreview, TokenPair } from '../api/models';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useToast } from './ui/toastProvider';

interface GameInvitePageProps {
  tokens: TokenPair | null;
}

export function GameInvitePage({ tokens }: GameInvitePageProps) {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toastPromise } = useToast();
  const [preview, setPreview] = useState<GameSharePreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const shouldAcceptAfterAuth = searchParams.get('acceptAfterAuth') === '1';

  useEffect(() => {
    const loadPreview = async () => {
      if (!token) {
        setError('Missing share token.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await gamesApi.getShareLinkPreview(token);
        setPreview(data);
      } catch (err) {
        setError((err as Error)?.message || 'Unable to load this share link.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [token]);

  const handleAccept = async () => {
    if (!token) {
      return;
    }
    if (isAccepting || accepted) {
      return;
    }

    setIsAccepting(true);
    setError(null);
    try {
      await toastPromise(gamesApi.acceptShareLink(token), {
        loading: 'Accepting game invite...',
        success: 'Game added to your library.',
        error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          'Unable to accept this invite.',
      });
      setAccepted(true);
      if (shouldAcceptAfterAuth) {
        navigate(`/game-invite/${token}`, { replace: true });
      }
    } catch (err) {
      setError((err as Error)?.message || 'Unable to accept this invite.');
    } finally {
      setIsAccepting(false);
    }
  };

  useEffect(() => {
    if (!tokens || !preview?.is_usable || !shouldAcceptAfterAuth || accepted || isAccepting) {
      return;
    }

    handleAccept();
  }, [tokens, token, preview, shouldAcceptAfterAuth, accepted, isAccepting]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              {accepted ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Link2 className="h-5 w-5 text-primary" />}
            </div>
            <CardTitle>Game Invite</CardTitle>
            <CardDescription>
              Accept this invite to add the game to your library.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading invite...</p>
            ) : error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : preview ? (
              <>
                <div className="rounded-md border border-border bg-background p-4">
                  <h1 className="text-xl font-semibold">{preview.game_name}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {preview.game_summary || 'No summary available.'}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Access: {preview.role} · expires {new Date(preview.expires_at).toLocaleDateString()}
                  </p>
                </div>

                {!preview.is_usable ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                    This invite is no longer available.
                  </div>
                ) : accepted ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-border bg-background p-3 text-sm">
                      {preview.game_name} is now in your library.
                    </div>
                    <Button type="button" onClick={() => navigate('/library')}>
                      Go to Library
                    </Button>
                  </div>
                ) : tokens ? (
                  <Button type="button" onClick={handleAccept} disabled={isAccepting}>
                    {isAccepting ? 'Accepting...' : 'Accept Invite'}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                      Log in or sign up, then accept this invite.
                    </div>
                    <Button asChild>
                      <Link
                        to={`/?redirect=${encodeURIComponent(`/game-invite/${token}?acceptAfterAuth=1`)}`}
                      >
                        Log In or Sign Up
                      </Link>
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
