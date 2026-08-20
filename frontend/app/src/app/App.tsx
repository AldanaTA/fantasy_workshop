import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
} from 'react-router-dom';

import { Login } from './components/Login';
import { MainApp } from './components/MainApp';
import { GameInvitePage } from './components/GameInvitePage';
import type { TokenPair } from './api/models';
import { authApi } from './api/authApi';
import { authStore } from './api/authStorage';
import { ToastProvider } from './components/ui/toastProvider';


interface LoginRouteProps {
  tokens: TokenPair | null;
  onLogin: (tokens: TokenPair) => void;
}


function getSafeRedirect(redirect: string | null): string {
  if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }

  return '/app';
}


function LoginRoute({ tokens, onLogin }: LoginRouteProps) {
  const [searchParams] = useSearchParams();

  const redirect = getSafeRedirect(
    searchParams.get('redirect')
  );

  return tokens ? (
    <Navigate to={redirect} replace />
  ) : (
    <Login onLogin={onLogin} />
  );
}


function App() {
  const [tokens, setTokens] = useState<TokenPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tokens) {
      authStore.setCurrent(tokens);
      return;
    }

    authStore.clearCurrent();
  }, [tokens]);


  const saveTokens = (newTokens: TokenPair) => {
    authStore.setCurrent(newTokens);
    setTokens(newTokens);
  };


  const clearTokens = () => {
    authStore.clearCurrent();
    setTokens(null);
  };


  useEffect(() => {
    const checkSession = async () => {
      try {
        /*
         * The refresh token is stored in an HttpOnly cookie.
         *
         *
         * The browser sends the refresh cookie automatically.
         */
        const refreshed = await authApi.refresh();

        saveTokens(refreshed);
      } catch (error) {
        /*
         * A 401 here is normal when:
         *
         * - the user has never logged in
         * - the refresh token expired
         * - the refresh token was revoked
         * - the cookie does not exist
         */
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


  const handleLogout = async () => {
    try {
      /*
       * Tell the server to revoke the refresh token
       * and delete the HttpOnly cookie.
       */
      await authApi.logout();
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      /*
       * Always clear the access token from frontend memory.
       */
      clearTokens();
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />

          <p className="mt-4 text-muted-foreground">
            Loading...
          </p>
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
            element={
              <LoginRoute
                tokens={tokens}
                onLogin={handleLogin}
              />
            }
          />

          <Route
            path="/game-invite/:token"
            element={
              <GameInvitePage tokens={tokens} />
            }
          />

          <Route
            path="/app"
            element={
              tokens ? (
                <MainApp
                  tokens={tokens}
                  onLogout={handleLogout}
                  initialSection="creator"
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/library"
            element={
              tokens ? (
                <MainApp
                  tokens={tokens}
                  onLogout={handleLogout}
                  initialSection="library"
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}


export default App;
