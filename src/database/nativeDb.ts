// Fichier de base pour TypeScript — le bundler (Metro) utilise
// nativeDb.native.ts sur Android/iOS et nativeDb.web.ts sur le web.
// Ne pas appeler directement — importez depuis ./nativeDb (sans extension)
// et Metro choisira la bonne variante.
import { Platform } from 'react-native';

export async function openNativeDb(): Promise<any> {
  if (Platform.OS === 'web') {
    throw new Error('openNativeDb ne doit pas être appelé sur le web.');
  }
  // Fallback for native — sera override par nativeDb.native.ts dans Metro
  const SQLite = require('expo-sqlite');
  return await SQLite.openDatabaseAsync('chrisroi_agence.db');
}
