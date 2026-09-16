// ─── Contexte d'authentification ───────────────────────────
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UserInfo } from '../types/navigation';
import { initDatabase, logout as pbLogout } from '../database/service';
import { getPocketBase } from '../database/pocketbase';

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
  role: u.role || 'agent',
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
  // Sécurité : aucun utilisateur restauré avant vérification du token PB.
  // Sans token valide, l'app affiche Login (plus d'auto-connexion admin).
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        // Restaure la session locale UNIQUEMENT si le token PB est valide
        // et correspond au même utilisateur. Sinon → Login.
        try {
          const raw = localStorage.getItem(SESSION_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            const pb = getPocketBase();
            const valid = (pb.authStore as any)?.isValid;
            const model = pb.authStore.model as any;
            if (valid && model && model.id === parsed.id) {
              setUser({
                id: parsed.id,
                email: parsed.email || model.email || '',
                role: parsed.role || model.role || 'agent',
                nom: parsed.nom || model.nom || '',
                prenom: parsed.prenom || model.prenom || '',
              });
            } else {
              try { localStorage.removeItem(SESSION_KEY); } catch {}
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch { setUser(null); }
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
    // Vide aussi le token PocketBase, sinon les appels API resteraient authentifiés.
    try { void pbLogout(); } catch {}
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
