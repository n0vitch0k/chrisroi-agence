// Logger de connexion temps réel pour debug du backend
// Utilisation : logBackend('étape', 'détail') → visible dans l'overlay debug

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface BackendLog {
  id: number;
  timestamp: string;
  level: LogLevel;
  step: string;
  detail: string;
}

let logs: BackendLog[] = [];
let listeners: Array<(logs: BackendLog[]) => void> = [];
let nextId = 0;

export const logBackend = (step: string, detail: string, level: LogLevel = 'info') => {
  const entry: BackendLog = {
    id: nextId++,
    timestamp: new Date().toLocaleTimeString('fr-FR'),
    level,
    step,
    detail,
  };
  logs = [...logs, entry];
  // Garder max 100 logs
  if (logs.length > 100) logs = logs.slice(-100);
  // Notifier les listeners React
  listeners.forEach((fn) => fn(logs));
  // Aussi dans la console pour debug natif
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : '🔵';
  console.log(`${prefix} [Backend] ${step}: ${detail}`);
};

export const getBackendLogs = (): BackendLog[] => logs;

export const subscribeToLogs = (fn: (logs: BackendLog[]) => void) => {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
};

export const clearBackendLogs = () => {
  logs = [];
  listeners.forEach((fn) => fn(logs));
};
