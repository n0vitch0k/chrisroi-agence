// Stockage clé/valeur local NATIF (Android/iOS) — expo-sqlite.
// Chargé uniquement sur natif (résolution .native.ts par Metro).
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('chrisroi_settings.db');
    await _db.execAsync(
      'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT);'
    );
  }
  return _db;
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await (await db()).getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await (await db()).runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  } catch {
    // échec silencieux — le stockage local ne doit jamais casser l'app.
  }
}
