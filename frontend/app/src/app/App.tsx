import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Login } from './components/Login';
import { MainApp } from './components/MainApp';
import { GameInvitePage } from './components/GameInvitePage';
import { TokenPair } from './api/models';
import { authApi } from './api/authApi';
import { setCurrent,clearCurrent, get_refresh_token } from './api/authStorage';
import { ToastProvider } from './components/ui/toastProvider';

interface LoginRouteProps {
  tokens: TokenPair | null;
  onLogin: (tokens: TokenPair) => void;
}

function getSafeRedirect(redirect: string | null) {
  if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return '/app';
}

function LoginRoute({ tokens, onLogin }: LoginRouteProps) {
  const [searchParams] = useSearchParams();
  const redirect = getSafeRedirect(searchParams.get('redirect'));

  return tokens ? (
    <Navigate to={redirect} replace />
  ) : (
    <Login onLogin={onLogin} />
  );
}

function App() {
  const [tokens, setTokens] = useState<TokenPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveTokens = (newTokens: TokenPair) => {
    setCurrent(newTokens);
    setTokens(newTokens);
  };

  const clearTokens = () => {
    clearCurrent();
    setTokens(null);
  };

  useEffect(() => {
    const checkSession = async () => {
      const rt = get_refresh_token();
      if (!rt) {
        setIsLoading(false);
        return;
      }

      try {
        const refreshed = await authApi.refresh({ refresh_token: rt });
        saveTokens(refreshed);
      } catch (error) {
        console.error('Failed to refresh session:', error);
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = (newTokens: TokenPair) => {
    saveTokens(newTokens);
  };

  const handleLogout = () => {
    clearTokens();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<LoginRoute tokens={tokens} onLogin={handleLogin} />}
        />
        <Route
          path="/game-invite/:token"
          element={<GameInvitePage tokens={tokens} />}
        />
        <Route
          path="/app"
          element={
            tokens ? (
              <MainApp tokens={tokens} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/library"
          element={
            tokens ? (
              <MainApp tokens={tokens} onLogout={handleLogout} initialRole="player" />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
