// Wrapper cross-platform pour l'impression de contrat.
// Sur Android/iOS : utilise expo-print (printToFileAsync) qui génère un PDF
// partageable/imprimable nativement.
// Sur le web : ouvre une nouvelle fenêtre avec le HTML et déclenche window.print().
//
// Pourquoi un seul fichier : éviter aux screens de devoir faire un Platform.select
// à chaque appel. Le contrat reste iso-fonctionnel (même API printAsync({ html })).

import { Platform } from 'react-native';

// Sur natif, expo-print n'est pas dispo sur web — Metro va shimer via les stubs web.
// On importe conditionnellement : si l'import échoue (web dev), on bascule sur webPrint.
let nativeImpl: ((opts: { html: string }) => Promise<void>) | null = null;
try {
  // L'import est résolu par Metro/webpack au build. Sur web, le stub no-op
  // (voir metro.config.js) fait que printToFileAsync n'existe pas → on tombe en erreur.
  // On force donc à require() au runtime.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expoPrint = require('expo-print');
  if (expoPrint && typeof expoPrint.printToFileAsync === 'function') {
    nativeImpl = async (opts) => {
      await expoPrint.printToFileAsync(opts);
    };
  }
} catch {
  nativeImpl = null;
}

const webImpl = async ({ html }: { html: string }): Promise<void> => {
  const win: any = (globalThis as any).window;
  if (!win) {
    // Pas de window → environnement natif pur, on dégrade en no-op
    return;
  }
  const w = win.open('', '_blank');
  if (!w) {
    // Bloqueur de popup → on affiche dans la même fenêtre
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // Laisse un tick pour que le navigateur charge le DOM
  await new Promise((r) => setTimeout(r, 100));
  try {
    w.print();
  } catch (e) {
    // Certains navigateurs refusent print() si la fenêtre n'est pas encore paint
    console.warn('[print] window.print() a échoué, l\'utilisateur peut lancer manuellement');
  }
};

export const printAsync = async (options: { html: string }): Promise<void> => {
  if (Platform.OS === 'web') {
    await webImpl(options);
    return;
  }
  if (nativeImpl) {
    await nativeImpl(options);
    return;
  }
  // Fallback de dernier recours
  await webImpl(options);
};

// Compatibilité ascendante : nom historique utilisé dans ContratDetailScreen
export const nativePrintAsync = printAsync;
