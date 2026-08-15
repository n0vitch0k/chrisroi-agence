// Ce fichier est chargé UNIQUEMENT sur Android/iOS (extension .native.ts)
import * as SQLite from 'expo-sqlite';

export async function openNativeDb(): Promise<any> {
  return await SQLite.openDatabaseAsync('chrisroi_agence.db');
}
