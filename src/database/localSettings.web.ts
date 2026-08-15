// Stockage clé/valeur local WEB — localStorage.
// Chargé uniquement sur le web (résolution .web.ts par Metro).
export async function getSetting(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage plein/désactivé — on ignore.
  }
}
