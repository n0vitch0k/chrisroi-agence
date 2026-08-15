// ─── Contexte d'authentification ───────────────────────────
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UserInfo } from '../types/navigation';
import { initDatabase } from '../database/service';

const SESSION_KEY = 'chrisroi_user_v1';

// Ne stocker en localStorage que les champs non-sensibles.
// Evite d'exposer nom/prénom à un script tiers si XSS sur la version web.
interface MinimalSession {
  id: string;
  email: string;
  role: string;
}

const toMinimal = (u: any): MinimalSession => ({
  id: u.id,
  email: u.email,
  role: u.role || 'admin',
});

interface AuthContextType {
  user: UserInfo | null;
  isLoading: boolean;
  onLogin: (user: UserInfo) => void;
  onLogout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  onLogin: () => {},
  onLogout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Accepte l'ancien format (nom/prenom) ET le nouveau minimal — fallback sécurisé.
      return {
        id: parsed.id,
        email: parsed.email || '',
        role: parsed.role || 'admin',
        nom: parsed.nom || '',
        prenom: parsed.prenom || '',
      };
    } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const seededUser = await initDatabase();
        if (seededUser) {
          setUser(seededUser);
          try { localStorage.setItem(SESSION_KEY, JSON.stringify({
            id: seededUser.id,
            email: seededUser.email,
            role: seededUser.role,
          })); } catch {}
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const onLogin = useCallback((loggedUser: UserInfo) => {
    setUser(loggedUser);
    // Stocke uniquement {id, email, role} en localStorage. Les champs nom/prénom
    // restent en mémoire (state) mais pas exposés à un éventuel XSS.
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(toMinimal(loggedUser))); } catch {}
  }, []);

  const onLogout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, onLogin, onLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
