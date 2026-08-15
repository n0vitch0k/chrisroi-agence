// Résolveur par défaut (utilisé par TypeScript et comme fallback).
// À l'exécution, Metro charge localSettings.web.ts (web) ou
// localSettings.native.ts (Android/iOS) selon la plateforme.
export async function getSetting(_key: string): Promise<string | null> {
  return null;
}

export async function setSetting(_key: string, _value: string): Promise<void> {
  // no-op — surchargé par la variante plateforme.
}
