import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { MainApp } from './components/MainApp';
import { TokenPair } from './api/models';
import { authApi } from './api/authApi';

function App() {
  const [tokens, setTokens] = useState<TokenPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveTokens = (newTokens: TokenPair) => {
    localStorage.setItem('currentTokens', JSON.stringify(newTokens));
    setTokens(newTokens);
  };

  const clearTokens = () => {
    localStorage.removeItem('currentTokens');
    setTokens(null);
  };

  useEffect(() => {
    const checkSession = async () => {
      const stored = localStorage.getItem('currentTokens');
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as TokenPair;
        const refreshed = await authApi.refresh({ refresh_token: parsed.refresh_token });
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
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            tokens ? (
              <Navigate to="/app" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
