// ─── Retour déterministe des écrans détail ───
// Contrat : sans origin → pile locale (goBack, ex: Dossiers → détail).
// Avec origin → on nettoie la pile Dossiers (le détail externe n'en fait pas
// partie) puis on retourne à l'origine (onglet ou modale Root à rouvrir).
import type { DetailOrigin } from '../types/navigation';

export function backFromDetail(navigation: any, origin?: DetailOrigin): void {
  if (!origin || (!origin.tab && !origin.modal)) {
    navigation.goBack();
    return;
  }
  try {
    navigation.popToTop?.();
  } catch { /* best effort */ }
  if (origin.modal) {
    navigation.getParent?.()?.getParent?.()?.navigate(origin.modal);
  } else if (origin.tab) {
    navigation.navigate(origin.tab);
  } else {
    navigation.goBack();
  }
}
