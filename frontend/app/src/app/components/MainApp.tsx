import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole, Game, Character, Session, Campaign, Content, GameMechanic } from '../types/game';
import { GameCreator } from './GameCreator';
import { GameMaster } from './GameMaster';
import { GamePlayer } from './GamePlayer';
import { Button } from './ui/button';
import { Toaster } from './ui/sonner';
import { BookOpen, Scroll, User, LogOut } from 'lucide-react';
import { gamesApi } from '../api/gamesApi';
import { sessionsApi } from '../api/sessionsApi';
import { contentApi } from '../api/contentApi';
import { userApi } from '../api/userApi';
import type { User as UserType } from '../api/userApi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

/**
 * MainApp component is the root application component that manages the main
 * interface after login. It handles role switching between Game Creator, Game Master,
 * and Player modes, manages all application data, and provides navigation.
 * 
 * @param user - The currently logged-in user object
 * @param onLogout - Callback function to handle user logout
 * @returns The main application interface with role-based views
 */
interface MainAppProps {
  user: UserType;
  onLogout: () => void;
}

export function MainApp({ user, onLogout }: MainAppProps) {
  const navigate = useNavigate();
  const [currentRole, setCurrentRole] = useState<UserRole>('creator');
  const [games, setGames] = useState<Game[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Check for invite code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setInviteCode(invite);
      setCurrentRole('player'); // Auto-switch to player mode
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load data from API on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [loadedGames, loadedContent, loadedSessions, loadedCampaigns, loadedCharacters] = await Promise.all([
          gamesApi.getAll(user.id),
          contentApi.getAll(user.id),
          sessionsApi.getAll(user.id),
          sessionsApi.getAllCampaigns(user.id),
          sessionsApi.getAllCharacters(user.id),
        ]);

        // Migrate old games to include contentCategories if missing
        const migratedGames = loadedGames.map((game) => ({
          ...game,
          contentCategories: game.contentCategories || [],
        }));
        setGames(migratedGames);

        // Migrate old content to include mechanics and references if missing
        const migratedContent = loadedContent.map((contentItem) => ({
          ...contentItem,
          mechanics: contentItem.mechanics || [],
          references: contentItem.references || [],
        }));
        setContent(migratedContent);

        // Migrate old characters to new content-based structure
        const migratedCharacters = loadedCharacters.map((char: any) => {
          // If character already has contentInstances, it's already migrated
          if (char.contentInstances && !char.name && !char.attributes) {
            return char;
          }
          
          // Otherwise, convert old format to new format
          return {
            id: char.id,
            gameId: char.gameId,
            contentInstances: char.contentInstances || [],
          };
        });

        setSessions(loadedSessions);
        setCampaigns(loadedCampaigns);
        setCharacters(migratedCharacters);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user.id]);

  // Save games using API
  const saveGame = async (game: Game) => {
    const existingIndex = games.findIndex((g) => g.id === game.id);
    let updatedGames: Game[];

    try {
      if (existingIndex >= 0) {
        await gamesApi.update(user.id, game.id, game);
        updatedGames = games.map((g) => (g.id === game.id ? game : g));
      } else {
        await gamesApi.create(user.id, game);
        updatedGames = [...games, game];
      }
      setGames(updatedGames);
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  };

  const deleteGame = async (id: string) => {
    try {
      await gamesApi.delete(user.id, id);
      const updatedGames = games.filter((g) => g.id !== id);
      setGames(updatedGames);
    } catch (error) {
      console.error('Failed to delete game:', error);
    }
  };

  // Save characters using API
  const saveCharacter = async (character: Character) => {
    const existingIndex = characters.findIndex((c) => c.id === character.id);
    let updatedCharacters: Character[];

    try {
      if (existingIndex >= 0) {
        await sessionsApi.updateCharacter(user.id, character.id, character);
        updatedCharacters = characters.map((c) => (c.id === character.id ? character : c));
      } else {
        await sessionsApi.createCharacter(user.id, character);
        updatedCharacters = [...characters, character];
      }
      setCharacters(updatedCharacters);
    } catch (error) {
      console.error('Failed to save character:', error);
    }
  };

  const deleteCharacter = async (id: string) => {
    try {
      await sessionsApi.deleteCharacter(user.id, id);
      const updatedCharacters = characters.filter((c) => c.id !== id);
      setCharacters(updatedCharacters);
    } catch (error) {
      console.error('Failed to delete character:', error);
    }
  };

  // Save sessions using API
  const saveSession = async (session: Session) => {
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    let updatedSessions: Session[];

    try {
      if (existingIndex >= 0) {
        await sessionsApi.update(user.id, session.id, session);
        updatedSessions = sessions.map((s) => (s.id === session.id ? session : s));
      } else {
        await sessionsApi.create(user.id, session);
        updatedSessions = [...sessions, session];
      }
      setSessions(updatedSessions);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await sessionsApi.delete(user.id, id);
      const updatedSessions = sessions.filter((s) => s.id !== id);
      setSessions(updatedSessions);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  // Save campaigns using API
  const saveCampaign = async (campaign: Campaign) => {
    const existingIndex = campaigns.findIndex((c) => c.id === campaign.id);
    let updatedCampaigns: Campaign[];

    try {
      if (existingIndex >= 0) {
        await sessionsApi.updateCampaign(user.id, campaign.id, campaign);
        updatedCampaigns = campaigns.map((c) => (c.id === campaign.id ? campaign : c));
      } else {
        await sessionsApi.createCampaign(user.id, campaign);
        updatedCampaigns = [...campaigns, campaign];
      }
      setCampaigns(updatedCampaigns);
    } catch (error) {
      console.error('Failed to save campaign:', error);
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await sessionsApi.deleteCampaign(user.id, id);
      const updatedCampaigns = campaigns.filter((c) => c.id !== id);
      setCampaigns(updatedCampaigns);
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  // Save content using API
  const saveContent = async (contentItem: Content) => {
    const existingIndex = content.findIndex((c) => c.id === contentItem.id);
    let updatedContent: Content[];

    try {
      if (existingIndex >= 0) {
        await contentApi.update(user.id, contentItem.id, contentItem);
        updatedContent = content.map((c) => (c.id === contentItem.id ? contentItem : c));
      } else {
        await contentApi.create(user.id, contentItem);
        updatedContent = [...content, contentItem];
      }
      setContent(updatedContent);
    } catch (error) {
      console.error('Failed to save content:', error);
    }
  };

  const deleteContent = async (id: string) => {
    try {
      await contentApi.delete(user.id, id);
      const updatedContent = content.filter((c) => c.id !== id);
      setContent(updatedContent);
    } catch (error) {
      console.error('Failed to delete content:', error);
    }
  };

  const handleLogout = async () => {
    await userApi.logout();
    onLogout();
    navigate('/');
  };

  const handleRoleChange = (role: UserRole) => {
    if (hasUnsavedChanges) {
      setPendingRole(role);
      setShowUnsavedDialog(true);
    } else {
      setCurrentRole(role);
    }
  };

  const confirmRoleChange = () => {
    if (pendingRole) {
      setCurrentRole(pendingRole);
      setPendingRole(null);
      setShowUnsavedDialog(false);
      setHasUnsavedChanges(false); // Reset unsaved changes when switching roles
    }
  };

  const cancelRoleChange = () => {
    setPendingRole(null);
    setShowUnsavedDialog(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      {/* Header with Role Switcher */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">TTRPG Companion</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Welcome, {user.name}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto items-center">
              <Button
                variant={currentRole === 'creator' ? 'default' : 'outline'}
                onClick={() => handleRoleChange('creator')}
                className="flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4 min-h-[44px]"
              >
                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Game </span>Creator
              </Button>
              <Button
                variant={currentRole === 'gm' ? 'default' : 'outline'}
                onClick={() => handleRoleChange('gm')}
                className="flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4 min-h-[44px]"
              >
                <Scroll className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Game </span>Master
              </Button>
              <Button
                variant={currentRole === 'player' ? 'default' : 'outline'}
                onClick={() => handleRoleChange('player')}
                className="flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4 min-h-[44px]"
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                Player
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="min-h-[44px] min-w-[44px] px-2 sm:px-4"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20 sm:pb-8">
        {currentRole === 'creator' && (
          <GameCreator
            games={games}
            content={content}
            onSaveGame={saveGame}
            onDeleteGame={deleteGame}
            onSaveContent={saveContent}
            onDeleteContent={deleteContent}
            onUnsavedChangesChange={setHasUnsavedChanges}
          />
        )}
        {currentRole === 'gm' && (
          <GameMaster
            games={games}
            sessions={sessions}
            campaigns={campaigns}
            content={content}
            onSaveSession={saveSession}
            onDeleteSession={deleteSession}
            onSaveCampaign={saveCampaign}
            onDeleteCampaign={deleteCampaign}
            onSaveContent={saveContent}
          />
        )}
        {currentRole === 'player' && (
          <GamePlayer
            games={games}
            characters={characters}
            content={content}
            sessions={sessions}
            inviteCode={inviteCode}
            onSaveCharacter={saveCharacter}
            onDeleteCharacter={deleteCharacter}
          />
        )}
      </main>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to switch roles?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRoleChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>Switch Role</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}