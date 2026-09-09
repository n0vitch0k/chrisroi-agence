import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Partage un fichier LOCAL de façon fiable sur Android (Expo Go).
 * Corrige « Not allowed to read file under given URL » :
 *  - refuse les URL distantes (http) avec un message clair ;
 *  - normalise le schéma file:// ;
 *  - recopie dans cacheDirectory (zone toujours lisible par le FileProvider) ;
 *  - vérifie l'existence avant de partager.
 */
export async function shareLocalFile(
  uri: string,
  dialogTitle: string,
  fileName?: string,
  mimeType?: string,
): Promise<void> {
  const FS = FileSystem as any;
  if (!uri) throw new Error('Fichier introuvable (URI vide).');
  if (/^https?:\/\//i.test(uri)) {
    throw new Error('URL distante : téléchargez le fichier avant de le partager.');
  }
  let localUri = /^file:\/\//i.test(uri) ? uri : `file://${String(uri).replace(/^\/*/, '/')}`;
  const safe = (fileName || `doc_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const target = (FS.cacheDirectory || '') + safe;
  if (!FS.cacheDirectory) throw new Error('Cache inaccessible.');
  if (target !== localUri) {
    const info = await FS.getInfoAsync(localUri).catch(() => null);
    if (!info?.exists) throw new Error(`Fichier source illisible : ${localUri}`);
    await FS.copyAsync({ from: localUri, to: target });
    localUri = target;
  }
  const can = await Sharing.isAvailableAsync();
  if (!can) {
    Alert.alert('Partage indisponible', localUri);
    return;
  }
  await Sharing.shareAsync(localUri, { dialogTitle, mimeType });
}

/**
 * Écrit un contenu base64 (ex: PDF d'expo-print) dans NOTRE cache puis partage.
 * À préférer quand le fichier source (ex: cache/Print d'expo-print) n'est pas
 * lisible par les autres modules (copyAsync « isn't readable »).
 */
export async function shareBase64File(
  base64: string,
  fileName: string,
  dialogTitle: string,
  mimeType?: string,
): Promise<void> {
  const FS = FileSystem as any;
  if (!base64) throw new Error('Contenu PDF vide.');
  if (!FS.cacheDirectory) throw new Error('Cache inaccessible.');
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const target = FS.cacheDirectory + safe;
  await FS.writeAsStringAsync(target, base64, { encoding: 'base64' });
  const can = await Sharing.isAvailableAsync();
  if (!can) {
    Alert.alert('Partage indisponible', target);
    return;
  }
  await Sharing.shareAsync(target, { dialogTitle, mimeType });
}
