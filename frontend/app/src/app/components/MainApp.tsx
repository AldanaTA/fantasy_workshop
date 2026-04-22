import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole} from '../types/game';
import { Button } from './ui/button';
import { Toaster } from './ui/sonner';
import { BookOpen, Scroll, User, LogOut, Compass } from 'lucide-react';
import { GameCreatorDashboard } from './game_creator/GameCreatorDashboard';
import { GameLibraryPage } from './games/GameLibraryPage';
import { CampaignSessionsPage } from './campaigns/CampaignSessionsPage';
import type { LibraryGame } from '../api/models';
import { TokenPair } from '../api/models';
import { authApi } from '../api/authApi';
import { get_display_name } from '../api/authStorage';
import { clearRequestCache } from '../api/requestCache';

/**
 * MainApp component is the root application component that manages the main
 * interface after login. It handles role switching between Game Creator, Game Master,
 * and Player modes, manages all application data, and provides navigation.
 * 
 * @param tokens - The currently user tokens
 * @param onLogout - Callback function to handle user logout
 * @returns The main application interface with role-based views
 */
interface MainAppProps {
  tokens: TokenPair;
  onLogout: () => void;
  initialSection?: UserRole;
}

const sectionLabel: Record<UserRole, string> = {
  library: 'GAME LIBRARY',
  creator: 'CREATOR',
  gm: 'GAME MASTER',
  player: 'PLAYER',
};

export function MainApp({ tokens, onLogout, initialSection = 'creator' }: MainAppProps) {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState<UserRole>(initialSection);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedCreatorGameId, setFocusedCreatorGameId] = useState<string | null>(null);

  const handleLogout = async () => {
    await authApi.logout({ refresh_token: tokens.refresh_token });
    clearRequestCache();
    onLogout();
    navigate('/');
  };

  const handleRoleChange = (section: UserRole) => {
    setCurrentSection(section);
    navigate(section === 'library' ? '/library' : '/app');
  };

  const handleManageGame = (game: LibraryGame) => {
    setCurrentSection('creator');
    setFocusedCreatorGameId(game.id);
    navigate('/app');
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
              <h1 className="text-2xl sm:text-3xl font-bold">Fantasy Workshop</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Welcome, {get_display_name()}! You are here: <span className="font-medium">{sectionLabel[currentSection]}</span>.
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:items-center">

              <Button
                variant={currentSection === 'creator' ? 'default' : 'outline'}
                onClick={() => handleRoleChange('creator')}
                className="flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4 min-h-[44px]"
              >
                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Game </span>Creator
              </Button>
              <Button
                variant={currentSection === 'gm' ? 'default' : 'outline'}
                onClick={() => handleRoleChange('gm')}
                className="flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4 min-h-[44px]"
              >
                <Scroll className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Game </span>Master
              </Button>
              <Button
                variant={currentSection === 'player' ? 'default' : 'outline'}
                onClick={() => handleRoleChange('player')}
                className="flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-4 min-h-[44px]"
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                Player
              </Button>
              <Button
                variant={currentSection === 'library' ? 'default' : 'outline'}
                onClick={() => handleRoleChange('library')}
                className="flex min-h-[44px] flex-1 items-center gap-1 px-2 text-xs sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Compass className="w-3 h-3 sm:w-4 sm:h-4" />
                Game Library
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
        {currentSection === 'creator' ? (
          <GameCreatorDashboard
            initialViewGameId={focusedCreatorGameId}
            onInitialViewHandled={() => setFocusedCreatorGameId(null)}
          />
        ) : currentSection === 'gm' ? (
          <CampaignSessionsPage role="gm" />
        ) : currentSection === 'player' ? (
          <CampaignSessionsPage role="player" />
        ) : currentSection === 'library' ? (
          <GameLibraryPage onManageGame={handleManageGame} />
        ) : (
          <GameLibraryPage />
        )}
      </main>
    </div>
  );
}
