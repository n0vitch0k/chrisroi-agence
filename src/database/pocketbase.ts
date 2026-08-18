import PocketBase from 'pocketbase';
import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { logBackend } from '../utils/backendLogger';
import { getSetting, setSetting } from './localSettings';

// ─── URL PocketBase dynamique ─────────────────────────────
// Priorité de résolution (voir hydratePocketBaseUrl) :
//   0. Mode production (APK) → URL cloud fixe (pas de scan LAN)
//   1. Scan auto du sous-réseau (découverte du serveur sur le LAN)
//   2. IP fixe (réservation DHCP / IP statique configurée dans la box)
//   3. Dernière IP connue persistée (sqlite natif / localStorage web)
//   4. Constante DEVICE_LAN_IP codée en dur (fallback ultime)
// Objectif : zéro saisie manuelle même si le DHCP change l'IP du PC.

let _customUrl: string | null = null; // surcharge mémoire (Settings / scan)
let _pb: PocketBase | null = null;

// ─── URL PRODUCTION (APK) ──────────────────────────────────
// Quand l'app est compilée en production (APK/iOS), elle doit pointer
// vers le serveur cloud, pas vers le PC local du développeur.
const PRODUCTION_PB_URL = 'https://pb2.chrisroiagence.com';
const isProduction = process.env.NODE_ENV === 'production';

// ─── IP FIXE (réservation DHCP recommandée) ───────────────
// Configure une réservation DHCP dans ta box pour que le PC garde
// TOUJOURS cette IP. C'est le fallback fiable si le scan auto échoue
// (pare-feu qui bloque, ou démarrage avant que le réseau soit prêt).
// Le scan auto prime : cette constante ne sert QUE si le scan ne trouve rien.
const FIXED_LAN_IP = '192.168.1.6'; // ← À RÉSERVER dans la box (actuelle DHCP)

const PB_PORT = 8090;

// ─── Health check léger sur une IP candidate ──────────────
const pingHealth = async (ip: string, timeoutMs = 900): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`http://${ip}:${PB_PORT}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(t);
    return resp.ok;
  } catch {
    return false;
  }
};

// ─── Scan du sous-réseau /24 local ────────────────────────
// Lit l'IP du téléphone, déduit le range x.x.x.1→254, teste :8090 en
// parallèle (secteurs de 16, concurrency limitée pour ne pas saturer).
const discoverPocketBaseUrl = async (): Promise<string | null> => {
  try {
    const ip = await Network.getIpAddressAsync(); // ex: 192.168.1.23
    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return null;
    const base = ip.split('.').slice(0, 3).join('.'); // 192.168.1

    logBackend('Discovery', `Scan du sous-réseau ${base}.0/24 …`, 'info');
    const candidates: string[] = [];
    for (let h = 1; h <= 254; h++) candidates.push(`${base}.${h}`);

    const CONCURRENCY = 24;
    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
      const batch = candidates.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((ip) => pingHealth(ip)));
      const found = batch[results.findIndex((ok) => ok)];
      if (found) {
        const url = `http://${found}:${PB_PORT}`;
        logBackend('Discovery', `Serveur trouvé → ${url}`, 'success');
        return url;
      }
    }
    logBackend('Discovery', 'Aucun serveur trouvé sur le sous-réseau', 'warn');
    return null;
  } catch (err: any) {
    logBackend('Discovery', `Scan impossible : ${err?.message || err}`, 'warn');
    return null;
  }
};

// ─── Résolution finale (appelée au démarrage) ──────────────
export const hydratePocketBaseUrl = async (): Promise<void> => {
  // 0) Mode production (APK compilée) → URL cloud, pas de scan LAN
  if (isProduction) {
    _customUrl = PRODUCTION_PB_URL;
    logBackend('URL', `Mode production → ${PRODUCTION_PB_URL}`, 'info');
    return;
  }
  // 0bis) URL forcée par variable d'environnement (mode tunnel ngrok)
  //    Skip complètement le scan auto — priorité absolue.
  //    Usage : EXPO_PUBLIC_TUNNEL_PB_URL=https://xxx.ngrok.io npx expo start
  //    Retour à la normale : lancer sans la variable (scan auto réactivé)
  const tunnelUrl = process.env.EXPO_PUBLIC_TUNNEL_PB_URL;
  if (tunnelUrl) {
    const cleanUrl = tunnelUrl.replace(/\/+$/, '');
    _customUrl = cleanUrl;
    logBackend('URL', `Mode tunnel → ${cleanUrl}`, 'info');
    try { await setSetting('pocketbase_url', cleanUrl); } catch {}
    return;
  }
  // 1) Scan auto (priorité absolue en mode normal)
  const discovered = await discoverPocketBaseUrl();
  if (discovered) {
    _customUrl = discovered;
    try { await setSetting('pocketbase_url', discovered); } catch {}
    return;
  }
  // 2) IP fixe (réservation DHCP)
  if (FIXED_LAN_IP) {
    const fixed = `http://${FIXED_LAN_IP}:${PB_PORT}`;
    if (await pingHealth(FIXED_LAN_IP)) {
      _customUrl = fixed;
      logBackend('URL', `Fallback IP fixe → ${fixed}`, 'info');
      try { await setSetting('pocketbase_url', fixed); } catch {}
      return;
    }
  }
  // 3) Dernière IP persistée (sqlite natif / localStorage web)
  try {
    const stored = await getSetting('pocketbase_url');
    if (stored) {
      _customUrl = stored.replace(/\/+$/, '');
      logBackend('URL', `URL persistée chargée → ${_customUrl}`, 'info');
      return;
    }
  } catch {}
  // 4) Constante codée (fallback ultime)
  logBackend('URL', 'Aucune IP résolue — fallback constante', 'warn');
};

function resolveUrl(): string {
  if (_customUrl) return _customUrl;
  if (isProduction) return PRODUCTION_PB_URL;
  return Platform.select({
    android: `http://${FIXED_LAN_IP}:${PB_PORT}`,
    ios: `http://${FIXED_LAN_IP}:${PB_PORT}`,
    default: 'http://127.0.0.1:8090',
  });
}

export const getPocketBase = (): PocketBase => {
  const url = resolveUrl();
  // Recréer le client si l'URL a changé depuis sa création
  // (ex: hydratePocketBaseUrl résout l'IP APRÈS le 1er getPocketBase).
  if (!_pb) {
    logBackend('Connexion', `Initialisation PocketBase → ${url}`, 'info');
    _pb = new PocketBase(url);
    _pb.autoCancellation(false);
  } else if ((_pb as unknown as Record<string, unknown>).baseUrl !== url) {
    logBackend('Connexion', `URL changée → recréation PocketBase (${url})`, 'info');
    _pb = new PocketBase(url);
    _pb.autoCancellation(false);
  }
  return _pb;
};

export const getPocketBaseUrl = (): string => resolveUrl();

/** Surcharge l'URL et reconnecte le client PocketBase */
export const setPocketBaseUrl = async (url: string): Promise<void> => {
  const cleanUrl = url.replace(/\/+$/, '');
  _customUrl = cleanUrl;
  if (_pb) {
    (_pb as unknown as Record<string, unknown>).baseUrl = cleanUrl;
  }
  // Persister via le stockage local (sqlite natif / localStorage web).
  // localStorage direct NE FONCTIONNE PAS sur l'APK → on passe par localSettings.
  try { await setSetting('pocketbase_url', cleanUrl); } catch {}
  logBackend('URL', `URL PocketBase changée → ${cleanUrl}`, 'info');
};

/** Réinitialise le client (force recréation au prochain getPocketBase) */
export const resetPocketBase = (): void => {
  _pb = null;
};

export const checkHealth = async (timeoutMs = 8000): Promise<boolean> => {
  const url = resolveUrl();
  logBackend('Health', `Test de connexion → ${url}/api/health`, 'info');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (resp.ok) {
      logBackend('Health', `Serveur OK (${resp.status})`, 'success');
      return true;
    }
    logBackend('Health', `Réponse inattendue : ${resp.status}`, 'warn');
    return false;
  } catch (err: any) {
    logBackend('Health', `Serveur injoignable : ${err?.message || err}`, 'error');
    return false;
  }
};

export default getPocketBase;
