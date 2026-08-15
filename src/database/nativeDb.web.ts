// Ce fichier est chargé UNIQUEMENT sur le web (extension .web.ts)
// Ne devrait jamais être appelé — le code web utilise browserDb
export async function openNativeDb(): Promise<any> {
  throw new Error('openNativeDb ne doit pas être appelé sur le web. Utilisez browserDb.');
}
