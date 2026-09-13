// Service de base de données ChrisRoi Agence — Backend PocketBase
// Remplace complètement l'ancienne couche SQLite/IndexedDB
// Toutes les fonctions exportées conservent la même signature pour ne pas casser les screens.

import { getPocketBase, getPocketBaseUrl, hydratePocketBaseUrl } from './pocketbase';
import { getSetting, setSetting } from './localSettings';
import { cacheDirectory, copyAsync, getInfoAsync, uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** Copie un fichier local vers un nom sûr du cache (sans %, espaces, accents).
 *  Le dossier cache d'Expo Go contient des segments doublement encodés (%25…)
 *  qui font échouer l'upload multipart RN (erreur réseau status 0).
 *  Retourne l'URI d'origine en cas d'échec (comportement inchangé). */
export const safeLocalUri = async (uri: string, fileName?: string): Promise<string> => {
  try {
    if (!/^file:\/\//i.test(uri)) return uri;
    if (!/[% ]/.test(uri)) return uri;
    console.log('[UPLOAD-DIAG] sanitize: cacheDirectory =', cacheDirectory);
    if (!cacheDirectory) {
      console.log('[UPLOAD-DIAG] sanitize IMPOSSIBLE: pas de cacheDirectory');
      return uri;
    }
    const rawExt = (fileName || uri).split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
    const cleanExt = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'jpg';
    const dest = `${cacheDirectory}upload_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${cleanExt}`;
    await copyAsync({ from: uri, to: dest });
    const info = await getInfoAsync(dest);
    if (!info?.exists) {
      console.log('[UPLOAD-DIAG] sanitize ÉCHEC: copie absente');
      return uri;
    }
    console.log('[UPLOAD-DIAG] uri assaini →', dest.slice(-60));
    return dest;
  } catch (e: any) {
    console.log('[UPLOAD-DIAG] sanitize EXCEPTION:', e?.message || e);
    return uri;
  }
};

/** Upload natif d'un fichier (multipart) via le module natif Expo.
 *  Contourne le fetch RN qui échoue en status 0 depuis Expo Go.
 *  Renvoie le record créé (parsé) ou null. */
async function nativeUploadRecord(
  collection: string,
  fileUri: string,
  fieldName: string,
  mimeType: string,
  params: Record<string, string>,
): Promise<any | null> {
  try {
    const pb = getPb();
    const token = (pb.authStore as any)?.token;
    if (!token) {
      console.log('[UPLOAD-DIAG] natif IMPOSSIBLE: pas de token');
      return null;
    }
    const url = `${getPocketBaseUrl()}/api/collections/${collection}/records`;
    console.log('[UPLOAD-DIAG] natif →', url, '| field =', fieldName, '| mime =', mimeType);
    const res = await uploadAsync(url, fileUri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName,
      mimeType,
      headers: { Authorization: token },
      parameters: params,
    });
    console.log('[UPLOAD-DIAG] natif status =', res.status);
    if (res.status < 200 || res.status >= 300) {
      console.log('[UPLOAD-DIAG] natif ÉCHEC body =', String(res.body).slice(0, 300));
      return null;
    }
    const parsed = JSON.parse(res.body);
    console.log('[UPLOAD-DIAG] natif SUCCÈS record.id =', parsed?.id);
    return parsed;
  } catch (e: any) {
    console.log('[UPLOAD-DIAG] natif EXCEPTION:', e?.message || e);
    return null;
  }
}

/** Upload natif d'un document (avec assainissement + mime), repli SDK ensuite.
 *  Renvoie l'id du record ou null si le natif échoue (le SDK tente après). */
async function nativeUploadDoc(
  fileUri: string,
  fileName: string | undefined,
  mimeType: string | undefined,
  docType: string,
  linkField: string,
  linkId: string,
): Promise<string | null> {
  const safe = await safeLocalUri(fileUri, fileName);
  const ext = (fileName || safe).split('.').pop()?.toLowerCase() || 'jpg';
  const fileType = resolveDocumentMime(ext, mimeType);
  const rec = await nativeUploadRecord('documents', safe, 'file', fileType, {
    [linkField]: linkId,
    type: docType,
  });
  return rec?.id || null;
}

// ─── Gestion d'erreurs centralisée ─────────────────────────
// Les erreurs PB sont nombreuses (400, 403, 404, 0=réseau). On les traduit
// en messages user-friendly que les screens peuvent afficher via Alert.
export class PbError extends Error {
  code: number;
  fieldErrors: Record<string, string>;
  constructor(message: string, code = 0, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'PbError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const translatePbError = (err: any): PbError => {
  const status = err?.status || err?.statusCode || 0;
  const msg = err?.message || String(err);

  // 0 = réseau / timeout / serveur injoignable
  if (status === 0 || msg.includes('Network') || msg.includes('aborted') || msg.includes('Failed to fetch')) {
    return new PbError(
      `Impossible de joindre PocketBase (${getPocketBaseUrl()}). Vérifiez que le serveur tourne.`,
      0
    );
  }
  // 401/403 = auth
  if (status === 401 || status === 403) {
    return new PbError('Accès refusé. Vérifiez que vous êtes bien connecté.', status);
  }
  // 404 = endpoint ou record introuvable
  if (status === 404) {
    return new PbError('Ressource introuvable.', status);
  }
  // 400 = validation, on essaie d'extraire les erreurs de champs
  if (status === 400 && err?.data?.data) {
    const fieldErrors: Record<string, string> = {};
    for (const [k, v] of Object.entries(err.data.data)) {
      fieldErrors[k] = (v as any)?.message || String(v);
    }
    return new PbError(
      'Données invalides. Vérifiez les champs en rouge.',
      400,
      fieldErrors
    );
  }
  // Autres
  return new PbError(msg, status);
};

// Helper exporté pour envelopper n'importe quel appel PB.
export const withPbErrorHandling = async <T,>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    const translated = translatePbError(err);
    console.error('[pb]', translated.code, translated.message);
    throw translated;
  }
};

// ============== INITIALISATION ET AUTH ==============

/**
 * Timeout helper — rejette après N ms si la promesse ne résout pas.
 * Utilisé pour éviter que initDatabase ne pende indéfiniment (ex: PB injoignable).
 */
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

export const initDatabase = async (): Promise<{
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
} | null> => {
  // PocketBase est un serveur distant — on vérifie la connexion et on seed l'admin
  try {
    // Charger l'URL persistée (sqlite natif sur APK / localStorage web) AVANT
    // le 1er getPocketBase, sinon l'app retombe sur l'IP codée en dur.
    await hydratePocketBaseUrl();
    const pb = getPocketBase();
    console.log('[chrisroi] Connexion à PocketBase:', getPocketBaseUrl());
    await withTimeout(pb.health.check(), 8000);
    console.log('[chrisroi] PocketBase connecté:', getPocketBaseUrl());

    // 1) Cas normal (pb2) : l'admin users existe déjà → auth directe,
    // sans passer par le superuser (qui a d'autres identifiants sur le VPS).
    try {
      const directAuth = await pb.collection('users').authWithPassword('admin@chrisroi.com', 'chrisroi2024');
      const d = directAuth.record;
      let dNom = d.nom || '';
      let dPrenom = d.prenom || '';
      if (!dNom && !dPrenom && d.name) {
        const parts = String(d.name).trim().split(' ');
        dPrenom = parts[0] || '';
        dNom = parts.slice(1).join(' ') || '';
      }
      console.log('[chrisroi] Admin user authentifié (direct), session active');
      return {
        id: d.id,
        email: d.email,
        nom: dNom || 'Admin',
        prenom: dPrenom || '',
        role: d.role || 'admin',
      };
    } catch {
      console.log('[chrisroi] info: auth directe users impossible, tentative seed via superuser…');
    }

    // 2) Seed (PB local / premier lancement) — superuser optionnel, non-bloquant.
    // Sur pb2 le superuser est admin@chrisroi.local (≠ identifiants users),
    // donc cet auth peut échouer : on continue quand même vers l'auth users.
    try {
      await pb.collection('_superusers').authWithPassword('admin@chrisroi.com', 'chrisroi2024');
    } catch {
      console.log('[chrisroi] info: auth superuser ignorée (attendue sur pb2)');
    }

    // Vérifier si l'admin par défaut existe déjà dans users
    const existing = await pb.collection('users').getList(1, 1, {
      filter: `email = "admin@chrisroi.com"`,
    });
    if (existing.totalItems === 0) {
      await pb.collection('users').create({
        email: 'admin@chrisroi.com',
        password: 'chrisroi2024',
        passwordConfirm: 'chrisroi2024',
        name: 'ChrisRoi Admin',   // champ standard PocketBase
        nom: 'Admin',
        prenom: 'ChrisRoi',
        role: 'admin',
        actif: true,
      });
      console.log('[chrisroi] admin seed créé dans PocketBase');
    } else {
      // S'assurer que le champ name est rempli pour l'affichage
      try {
        const existingUser = existing.items[0];
        if (!existingUser.name) {
          await pb.collection('users').update(existingUser.id, {
            name: 'ChrisRoi Admin'
          });
          console.log('[chrisroi] champ name rempli pour admin existant');
        }
      } catch (fillErr) {
        console.log('[chrisroi] info: impossible de remplir name (pas grave)');
      }
      console.log('[chrisroi] admin existe déjà');
    }

    // Authentifier l'admin user normal pour les appels API
    // (le token est stocké dans pb.authStore et utilisé pour toutes les requêtes)
    const userAuth = await pb.collection('users').authWithPassword('admin@chrisroi.com', 'chrisroi2024');
    console.log('[chrisroi] Admin user authentifié, session active');

    // Retourner l'utilisateur pour auto-login dans l'UI
    const u = userAuth.record;
    let nom = u.nom || '';
    let prenom = u.prenom || '';
    if (!nom && !prenom && u.name) {
      const parts = String(u.name).trim().split(' ');
      prenom = parts[0] || '';
      nom = parts.slice(1).join(' ') || '';
    }
    return {
      id: u.id,
      email: u.email,
      nom: nom || 'Admin',
      prenom: prenom || '',
      role: u.role || 'admin',
    };
  } catch (error: any) {
    console.error('[chrisroi] ❌ Erreur connexion PocketBase:', error?.message || error);
    return null;
  }
};

const getPb = () => {
  const pb = getPocketBase();
  if (!pb.authStore.isValid) {
    // Si pas de token valide, on ne jette pas d'erreur — le login fera l'auth
    console.log('[chrisroi] Pas de session active, utilisation en mode non-auth');
  }
  return pb;
};

// ============== JOURNAL D'ACTIONS ==============

export const getCurrentUser = (): {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
} | null => {
  try {
    const pb = getPocketBase();
    const model = pb.authStore.model;
    if (!model) return null;
    return {
      id: (model as any).id,
      email: (model as any).email,
      nom: (model as any).nom || '',
      prenom: (model as any).prenom || '',
      role: (model as any).role || 'agent',
    };
  } catch {
    return null;
  }
};

export const logAction = async (params: {
  actionType: string;
  entiteType: string;
  entiteId?: string;
  description: string;
  details?: any;
}): Promise<string | null> => {
  try {
    const user = getCurrentUser();
    if (!user) return null;
    const pb = getPb();
    // user_display robuste : un superuser (admin) n'a pas toujours prenom/nom,
    // on utilise alors son email, sinon un libellé générique.
    const display =
      user.prenom || user.nom
        ? `${user.prenom || ''} ${user.nom || ''}`.trim()
        : (user.email || 'Utilisateur');
    const data = {
      user_id: user.id,
      user_display: display,
      action_type: params.actionType,
      entite_type: params.entiteType,
      entite_id: params.entiteId || '',
      description: params.description,
      details: params.details ? JSON.stringify(params.details) : '',
    };
    console.log('[journal] logAction:', JSON.stringify(data));
    const record = await pb.collection('journal_actions').create(data);
    console.log('[journal] logAction OK, id:', record.id);
    return record.id;
  } catch (err: any) {
    console.error('[journal] Erreur logAction:', err?.status, err?.message);
    if (err?.data) console.error('[journal] Data:', JSON.stringify(err.data));
    return null;
  }
};

export const getJournalActions = async (filters: {
  userId?: string;
  actionType?: string;
  dateDebut?: string;
  dateFin?: string;
} = {}): Promise<any[]> => {
  try {
    const pb = getPb();
    
    // Test d'accès à la collection
    try {
      console.log('[journal] Test accès collection...');
      await pb.collection('journal_actions').getList(1, 1);
      console.log('[journal] Collection accessible');
    } catch (e: any) {
      console.error('[journal] Test accès échoué:', e?.status, e?.message);
      if (e?.status === 404) {
        console.warn('[journal] Collection non trouvée');
        return [];
      }
      if (e?.status === 403) {
        console.warn('[journal] Accès refusé');
        return [];
      }
      if (e?.status === 400) {
        console.error('[journal] Erreur 400 - problème de schéma ou de requête');
        return [];
      }
    }
    
    // Récupérer les records via getList (compatible avec PB v0.39)
    // getFullList utilise un format incompatible (400) — on contourne
    // Filtre date poussé côté serveur (filtre seul, sans tri = 200 sur pb2) :
    // indispensable pour consulter une date ancienne au-delà des 500 derniers.
    console.log('[journal] Récupération des records...');
    const pbFilterParts: string[] = [];
    if (filters.dateDebut) pbFilterParts.push(`created >= "${filters.dateDebut}"`);
    if (filters.dateFin) pbFilterParts.push(`created <= "${filters.dateFin}"`);
    const result = pbFilterParts.length > 0
      ? await pb.collection('journal_actions').getList(1, 500, { filter: pbFilterParts.join(' && ') })
      : await pb.collection('journal_actions').getList(1, 500);
    let records = result.items;
    console.log(`[journal] ${records.length} records récupérés (total: ${result.totalItems})`);
    
    // Tri côté client (le sort côté serveur cause un 400 avec PB v0.39)
    records.sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime());

    
    // Filtrage côté client
    let filtered = records;
    if (filters.userId) {
      filtered = filtered.filter((r: any) => r.user_id === filters.userId);
    }
    if (filters.actionType) {
      filtered = filtered.filter((r: any) => r.action_type === filters.actionType);
    }
    if (filters.dateDebut) {
      filtered = filtered.filter((r: any) => r.created >= filters.dateDebut!);
    }
    if (filters.dateFin) {
      filtered = filtered.filter((r: any) => r.created <= filters.dateFin!);
    }
    
    return filtered.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      user_display: r.user_display,
      action_type: r.action_type,
      entite_type: r.entite_type,
      entite_id: r.entite_id,
      description: r.description,
      details: r.details,
      created: r.created,
    }));
  } catch (err: any) {
    console.error('[journal] Erreur getJournalActions:', err?.status, err?.message);
    if (err?.data) {
      console.error('[journal] Data:', JSON.stringify(err.data).substring(0, 200));
    }
    return [];
  }
};

export const getEntityHistory = async (entiteType: string, entiteId: string): Promise<any[]> => {
  try {
    const pb = getPb();
    try {
      await pb.collection('journal_actions').getList(1, 1);
    } catch (e: any) {
      if (e?.status === 404) {
        console.warn('[journal] Collection journal_actions non trouvée. Lancez PocketBase pour appliquer les migrations.');
        return [];
      }
      if (e?.status === 403) {
        console.warn('[journal] Accès refusé à journal_actions. Vérifiez les règles API.');
        return [];
      }
    }
    const result = await pb.collection('journal_actions').getList(1, 500);
    // Filtrage + tri côté client
    const filtered = result.items
      .filter((r: any) => r.entite_type === entiteType && r.entite_id === entiteId)
      .sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime());
    return filtered.map((r: any) => ({
      id: r.id,
      user_display: r.user_display,
      action_type: r.action_type,
      description: r.description,
      created: r.created,
    }));
  } catch {
    return [];
  }
};


// ============== GESTION DES UTILISATEURS ==============

export const authenticateUser = async (email: string, password: string): Promise<{
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
} | null> => {
  try {
    const pb = getPocketBase();
    const authData = await pb.collection('users').authWithPassword(email, password);

    const user = authData.record;

    // Si la collection n'a pas le champ 'actif', on considère l'utilisateur actif
    const isActive = user.actif === undefined || user.actif === true || user.actif === 1;
    if (!isActive) {
      pb.authStore.clear();
      return null;
    }

    // Extraire nom et prénom : supporte les champs personnalisés (nom/prenom)
    // et le champ standard PocketBase (name = "Prenom Nom" ou "Nom Prenom")
    let nom = user.nom as string || '';
    let prenom = user.prenom as string || '';

    // Fallback : utiliser le champ 'name' standard de PocketBase
    if (!nom && !prenom && user.name) {
      const parts = (user.name as string).trim().split(' ');
      if (parts.length >= 2) {
        prenom = parts[0];
        nom = parts.slice(1).join(' ');
      } else {
        nom = parts[0] || '';
      }
    }

    const userInfo = {
      id: user.id,
      nom: nom || 'Admin',
      prenom: prenom || '',
      email: user.email as string,
      role: (user.role as string) || 'admin',
    };
    // Log action (journal des connexions — logAction ne throw jamais)
    await logAction({
      actionType: 'connexion',
      entiteType: 'user',
      entiteId: userInfo.id,
      description: `${userInfo.prenom} ${userInfo.nom} s'est connecté(e)`,
    });
    return userInfo;
  } catch (error: any) {
    console.error('[auth] Erreur authentification:', error?.message || error);
    return null;
  }
};

export const logout = async (): Promise<void> => {
  const pb = getPocketBase();
  pb.authStore.clear();
};

export const getAllUsers = async (): Promise<any[]> => {
  const pb = getPb();
  try {
    const records = await pb.collection('users').getFullList({
      sort: '-created',
    });
    return records.map((r: any) => ({
      id: r.id,
      nom: r.nom,
      prenom: r.prenom,
      email: r.email,
      role: r.role,
      actif: r.actif ? 1 : 0,
      created_at: r.created,
    }));
  } catch (e: any) {
    // Lister tous les users exige des droits superuser (403 en user normal).
    // On dégrade proprement plutôt que de casser l'écran Paramètres.
    if (e?.status === 403) return [];
    throw e;
  }
};

export const createUser = async (user: {
  nom: string;
  prenom: string;
  email: string;
  mot_de_passe: string;
  role: string;
}): Promise<string> => {
  const pb = getPb();
  const record = await pb.collection('users').create({
    email: user.email,
    password: user.mot_de_passe,
    passwordConfirm: user.mot_de_passe,
    nom: user.nom,
    prenom: user.prenom,
    role: user.role,
    actif: true,
  });
  
  // Log action
  const currentUser = getCurrentUser();
  if (currentUser) {
    await logAction({
      actionType: 'creation_utilisateur',
      entiteType: 'user',
      entiteId: record.id,
      description: `${currentUser.prenom} ${currentUser.nom} a créé l'utilisateur ${user.prenom} ${user.nom}`,
    });
  }
  
  return record.id;
};

export const deleteUser = async (id: string): Promise<void> => {
  const pb = getPb();
  const currentUser = getCurrentUser();
  // On ne supprime jamais son propre compte.
  if (currentUser && (currentUser as any).id === id) {
    throw new Error('Vous ne pouvez pas supprimer votre propre compte.');
  }
  // Garde-fou : ne jamais supprimer le dernier administrateur.
  const target = await pb.collection('users').getOne(id).catch(() => null);
  if (target && (target as any).role === 'admin') {
    const admins = await pb.collection('users').getFullList({
      filter: 'role = "admin"',
    }).catch(() => []);
    if (admins.length <= 1) {
      throw new Error("Suppression impossible : c'est le dernier administrateur.");
    }
  }
  try {
    await pb.collection('users').delete(id);
  } catch (e: any) {
    // Supprimer un user exige des droits élevés (403 sinon).
    if (e?.status === 403) {
      throw new Error("Droits insuffisants : la suppression d'utilisateur requiert les droits PocketBase.");
    }
    throw e;
  }

  // Log action
  if (currentUser) {
    await logAction({
      actionType: 'suppression_utilisateur',
      entiteType: 'user',
      entiteId: id,
      description: `${currentUser.prenom} ${currentUser.nom} a supprimé l'utilisateur ${((target as any)?.prenom || '').trim()} ${((target as any)?.nom || '').trim()}`.trim(),
    });
  }
};

// ============== GESTION DES EMPLOYÉS ==============

// Filtre sécurisé pour PocketBase (échappe les guillemets et backslashes)
// sans dépendance externe. À utiliser pour toute valeur interpolée dans un filter.
const escapeFilterValue = (v: string): string =>
  v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const createEmploye = async (employe: any): Promise<string> => {
  const pb = getPb();
  const now = new Date().toISOString();

  const data: any = {
    date_inscription: employe.date_inscription || now,
    nom: employe.nom,
    prenom: employe.prenom,
    date_naissance: employe.date_naissance || '',
    lieu_naissance: employe.lieu_naissance || '',
    telephone: employe.telephone || '',
    lieu_residence: employe.lieu_residence || '',
    nationalite: employe.nationalite || '',
    situation_matrimoniale: employe.situation_matrimoniale || 'celibataire',
    religion: employe.religion || '',
    niveau_etude: employe.niveau_etude || '',
    a_deja_travaille: !!employe.a_deja_travaille,
    experience_details: employe.experience_details || '',
    stages_effectues: employe.stages_effectues || '',
    formations: employe.formations || '',
    motivation: employe.motivation || '',
    categorie_emploi: employe.categorie_emploi,
    photo_uri: employe.photo_uri || '',
    statut: 'disponible',
  };

  // Création de l'employé + relations en parallèle.
  // Si une relation plante, on supprime l'employé pour éviter les fantômes.
  let record;
  try {
    record = await pb.collection('employes').create(data);
  } catch (err) {
    throw err; // échec création employé = pas de cleanup à faire
  }

  const createdEmployeId = record.id;
  
  // Log action
  const user = getCurrentUser();
  if (user) {
    await logAction({
      actionType: 'creation_fiche',
      entiteType: 'employe',
      entiteId: createdEmployeId,
      description: `${user.prenom} ${user.nom} a inscrit ${data.prenom} ${data.nom}`,
    });
  }
  const relationsToCreate: Promise<any>[] = [];

  if (employe.parents?.length) {
    relationsToCreate.push(
      ...employe.parents.map((p: any) => addParent(createdEmployeId, p)),
    );
  }
  if (employe.personnes_urgence?.length) {
    relationsToCreate.push(
      ...employe.personnes_urgence.map((p: any) => addPersonneUrgence(createdEmployeId, p)),
    );
  }
  if (employe.experiences?.length) {
    relationsToCreate.push(
      ...employe.experiences.map((e: any) => addExperience(createdEmployeId, e)),
    );
  }

  if (relationsToCreate.length === 0) return createdEmployeId;

  try {
    await Promise.all(relationsToCreate);
  } catch (err) {
    // Cleanup : supprimer d'abord les éventuelles relations déjà créées,
    // puis l'employé lui-même (suppression réelle par id, pas par filtre).
    const cleanupSteps: Promise<any>[] = [
      deleteRelationsByEmploye('parents', createdEmployeId),
      deleteRelationsByEmploye('personnes_urgence', createdEmployeId),
      deleteRelationsByEmploye('experiences_pro', createdEmployeId),
    ];
    await Promise.all(cleanupSteps);
    try {
      await pb.collection('employes').delete(createdEmployeId);
    } catch (delErr) {
      console.error('[cleanup] impossible de supprimer employe', createdEmployeId, delErr);
    }
    throw err;
  }

  return createdEmployeId;
};

export const getEmployeById = async (id: string): Promise<any | null> => {
  const pb = getPb();
  try {
    // Chargement en parallèle de l'employé et de ses 3 collections liées
    // au lieu de 4 requêtes séquentielles.
    const [employe, parents, personnes_urgence, experiences] = await Promise.all([
      pb.collection('employes').getOne(id),
      pb.collection('parents').getFullList({ filter: `employe_id = "${id}"` }),
      pb.collection('personnes_urgence').getFullList({
        filter: `employe_id = "${id}"`,
        sort: '+ordre',
      }),
      pb.collection('experiences_pro').getFullList({
        filter: `employe_id = "${id}"`,
        sort: '+ordre',
      }),
    ]);

    if (!employe) return null;

    return {
      ...employe,
      parents,
      personnes_urgence,
      experiences,
    };
  } catch (error: any) {
    console.error('[db] getEmployeById error:', error?.message || error);
    return null;
  }
};

export const getAllEmployes = async (): Promise<any[]> => {
  const pb = getPb();
  return await pb.collection('employes').getFullList({
    sort: '-created',
  });
};

export const searchEmployes = async (query: string, categorie?: string, statut?: string): Promise<any[]> => {
  const pb = getPb();
  const conditions: string[] = [];
  const searchTerm = query?.trim();

  if (searchTerm) {
    conditions.push(`(nom ~ "${searchTerm}" || prenom ~ "${searchTerm}" || telephone ~ "${searchTerm}")`);
  }
  if (categorie) {
    conditions.push(`categorie_emploi = "${categorie}"`);
  }
  if (statut) {
    conditions.push(`statut = "${statut}"`);
  }

  const filter = conditions.length > 0 ? conditions.join(' && ') : undefined;

  // Tri serveur '-created' + filtre = 400 sur pb2 → tri client (plus récent d'abord)
  const found = await pb.collection('employes').getFullList({ filter });
  return found.sort((a: any, b: any) => +new Date(b.created) - +new Date(a.created));
};

/** Compare ancien record vs données d'update → [{field, oldValue, newValue}].
 * Best effort pour le journal : ne throw jamais, valeurs JSON-clonables. */
const diffRecordChanges = (
  existing: any,
  updateData: any,
): Array<{ field: string; oldValue: any; newValue: any }> => {
  const out: Array<{ field: string; oldValue: any; newValue: any }> = [];
  try {
    for (const key of Object.keys(updateData || {})) {
      const oldV = existing?.[key];
      const newV = (updateData as any)[key];
      const same = JSON.stringify(oldV ?? null) === JSON.stringify(newV ?? null);
      if (!same) out.push({ field: key, oldValue: oldV ?? null, newValue: newV ?? null });
    }
  } catch { /* best effort */ }
  return out;
};

export const updateEmploye = async (id: string, data: any): Promise<void> => {
  const pb = getPb();
  const updateData: any = { ...data };
  // Ne pas envoyer les relations dans l'update
  delete updateData.parents;
  delete updateData.personnes_urgence;
  delete updateData.experiences;
  delete updateData.photo_uri;

  // Avant → après (best effort, le log ne doit jamais bloquer l'update)
  let changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
  try {
    const existing = await pb.collection('employes').getOne(id);
    changes = diffRecordChanges(existing, updateData).slice(0, 10);
  } catch { /* best effort */ }

  await pb.collection('employes').update(id, updateData);
  await logAction({
    actionType: 'modification_fiche',
    entiteType: 'employe',
    entiteId: id,
    description: `Fiche employé modifiée`,
    details: changes.length ? { changes } : undefined,
  });
};

/** Sauvegarde partielle d'UN SEUL champ (verrouillage C1). */
export const patchEmployeField = async (
  id: string,
  field: string,
  value: any,
): Promise<void> => {
  const pb = getPb();
  // Ancienne valeur avant l'update (best effort pour l'avant → après du journal)
  let oldValue: any = null;
  try {
    const existing = await pb.collection('employes').getOne(id);
    oldValue = (existing as any)?.[field] ?? null;
  } catch { /* best effort */ }
  await pb.collection('employes').update(id, { [field]: value });
  await logAction({
    actionType: 'modification_champ',
    entiteType: 'employe',
    entiteId: id,
    description: `Champ « ${field} » modifié`,
    details: { field, oldValue, newValue: value ?? null },
  });
};

export const patchContratField = async (
  id: string,
  field: string,
  value: any,
): Promise<void> => {
  const pb = getPb();
  let oldValue: any = null;
  try {
    const existing = await pb.collection('contrats').getOne(id);
    oldValue = (existing as any)?.[field] ?? null;
  } catch { /* best effort */ }
  await pb.collection('contrats').update(id, { [field]: value });
  await logAction({
    actionType: 'modification_champ',
    entiteType: 'contrat',
    entiteId: id,
    description: `Champ contrat « ${field} » modifié`,
    details: { field, oldValue, newValue: value ?? null },
  });
};

export const deleteEmploye = async (id: string): Promise<void> => {
  const pb = getPb();
  // Les contrats liés ne sont jamais supprimés en cascade : on bloque avec un message clair.
  const contrats = await pb.collection('contrats').getFullList({
    filter: `employe_id = "${id}"`,
  }).catch(() => []);
  if (contrats.length > 0) {
    throw new Error(`Suppression impossible : cet employé est lié à ${contrats.length} contrat(s). Terminez ou supprimez d'abord le(s) contrat(s).`);
  }
  // Les relations requises (parents, urgences, expériences) bloqueraient le delete (400)
  // car sans cascadeDelete côté PB : on les supprime d'abord. Les documents suivent
  // en cascade côté PB (cascadeDelete), on les nettoie aussi par sécurité.
  await deleteRelationsByEmploye('parents', id);
  await deleteRelationsByEmploye('personnes_urgence', id);
  await deleteRelationsByEmploye('experiences_pro', id);
  await deleteRelationsByEmploye('documents', id);
  await pb.collection('employes').delete(id);
  
  // Log action
  const user = getCurrentUser();
  if (user) {
    await logAction({
      actionType: 'suppression_fiche',
      entiteType: 'employe',
      entiteId: id,
      description: `${user.prenom} ${user.nom} a supprimé la fiche`,
    });
  }
};

export const getContratsByEmploye = async (employeId: string): Promise<any[]> => {
  const pb = getPb();
  const contrats = await pb.collection('contrats').getFullList({
    filter: `employe_id = "${employeId}"`,
    sort: '-date_debut',
    expand: 'employeur_id',
  });
  return contrats.map((c: any) => ({
    ...c,
    nom_complet: c.expand?.employeur_id?.nom_complet || '',
  }));
};

export const getContratsByEmployeur = async (employeurId: string): Promise<any[]> => {
  const pb = getPb();
  // Tri serveur '-created' + filtre = 400 sur pb2 → tri client (plus récent d'abord)
  const records = (await pb.collection('contrats').getFullList({
    filter: `employeur_id = "${employeurId}"`,
  })).sort((a: any, b: any) => +new Date(b.created) - +new Date(a.created));
  return records.map((r: any) => ({
    id: r.id,
    numero_dossier: r.numero_dossier,
    employe_id: r.employe_id,
    employeur_id: r.employeur_id,
    date_contrat: r.date_contrat,
    date_debut: r.date_debut,
    date_fin: r.date_fin,
    poste: r.poste,
    type_contrat: r.type_contrat,
    salaire: r.salaire,
    commission_agence: r.commission_agence,
    statut: r.statut,
  }));
};

export const getEmployesByStatut = async (statut: string): Promise<any[]> => {
  const pb = getPb();
  // Tri serveur '-created' + filtre = 400 sur pb2 → tri client (plus récent d'abord)
  return (await pb.collection('employes').getFullList({
    filter: `statut = "${statut}"`,
  })).sort((a: any, b: any) => +new Date(b.created) - +new Date(a.created));
};

// Parents
export const addParent = async (employeId: string, parent: any): Promise<string> => {
  const pb = getPb();
  const record = await pb.collection('parents').create({
    employe_id: employeId,
    type: parent.type,
    nom: parent.nom || '',
    prenom: parent.prenom || '',
    telephone: parent.telephone || '',
    domicile: parent.domicile || '',
  });
  return record.id;
};

// Personnes urgence
export const addPersonneUrgence = async (employeId: string, personne: any): Promise<string> => {
  const pb = getPb();
  const record = await pb.collection('personnes_urgence').create({
    employe_id: employeId,
    nom: personne.nom || '',
    prenom: personne.prenom || '',
    telephone: personne.telephone || '',
    lieu: personne.lieu || '',
    ordre: personne.ordre || 1,
  });
  return record.id;
};

/** Supprime TOUS les records d'une collection liés à un employé.
 * (PB n'a pas de delete par filtre : on liste puis on supprime par id.
 * L'ancien pattern `delete(undefined, {filter})` renvoyait 404 avalé et
 * n'effaçait jamais rien → doublons à chaque sauvegarde.) */
export const deleteRelationsByEmploye = async (collection: string, employeId: string): Promise<void> => {
  const pb = getPb();
  try {
    const existing = await pb.collection(collection).getFullList({
      filter: `employe_id = "${employeId}"`,
    });
    await Promise.all(existing.map((r: any) => pb.collection(collection).delete(r.id).catch(() => null)));
  } catch { /* best effort */ }
};

/** Resynchronise les contacts d'urgence (mode édition) : remplace la liste. Ne fait rien si la nouvelle liste est entièrement vide alors qu'il en existe déjà (garde-fou contre l'écrasement sur chargement raté). */
export const syncEmployeUrgence = async (employeId: string, personnes: any[]): Promise<void> => {
  const pb = getPb();
  const existing = await pb.collection('personnes_urgence').getFullList({
    filter: `employe_id = "${employeId}"`,
  }).catch(() => []);
  const entries = (personnes || []).filter((p: any) => p && (p.nom || p.prenom || p.telephone || p.lieu));
  if (entries.length === 0 && existing.length > 0) return;
  await deleteRelationsByEmploye('personnes_urgence', employeId);
  await Promise.all(entries.map((p: any, i: number) => addPersonneUrgence(employeId, { ...p, ordre: i + 1 })));
};

// Expériences
export const addExperience = async (employeId: string, experience: any): Promise<string> => {
  const pb = getPb();
  const record = await pb.collection('experiences_pro').create({
    employe_id: employeId,
    entreprise: experience.entreprise || '',
    lieu: experience.lieu || '',
    contact: experience.contact || '',
    ordre: experience.ordre || 1,
  });
  return record.id;
};

// ============== GESTION DES EMPLOYEURS ==============

export const createEmployeur = async (employeur: any): Promise<string> => {
  const pb = getPb();
  const now = new Date().toISOString();

  // Trim + skip des champs vides côté service : la collection `employeurs`
  // a une validation `validation_is_email` sur le champ email. Si on envoie
  // `""`, PB rejette en 400. En omettant la clé du payload, la validation
  // passe (champ null côté PB = pas de validation format).
  const payload: Record<string, any> = {
    date_enregistrement: employeur.date_enregistrement || now,
    nom_complet: (employeur.nom_complet || '').trim(),
    type_besoin: employeur.type_besoin || 'particulier',
    adresse: (employeur.adresse || '').trim(),
    telephone: (employeur.telephone || '').trim(),
    nom_contact: (employeur.nom_contact || '').trim(),
    prenom_contact: (employeur.prenom_contact || '').trim(),
    salaire_propose: employeur.salaire_propose ? Math.round(Number(employeur.salaire_propose)) : 0,
    notes: (employeur.notes || '').trim(),
  };
  const email = (employeur.email || '').trim();
  if (email) payload.email = email;

  const record = await pb.collection('employeurs').create(payload);

  // Log action (historique employeur + journal)
  const currentUser = getCurrentUser();
  if (currentUser) {
    await logAction({
      actionType: 'creation_employeur',
      entiteType: 'employeur',
      entiteId: record.id,
      description: `${currentUser.prenom} ${currentUser.nom} a enregistré l'employeur ${payload.nom_complet}`,
    });
  }
  return record.id;
};

export const getEmployeurById = async (id: string): Promise<any | null> => {
  const pb = getPb();
  try {
    return await pb.collection('employeurs').getOne(id);
  } catch {
    return null;
  }
};

export const getAllEmployeurs = async (): Promise<any[]> => {
  const pb = getPb();
  return await pb.collection('employeurs').getFullList({
    sort: '-created',
  });
};

export const updateEmployeur = async (id: string, data: any): Promise<void> => {
  const pb = getPb();
  let changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
  try {
    const existing = await pb.collection('employeurs').getOne(id);
    changes = diffRecordChanges(existing, data).slice(0, 10);
  } catch { /* best effort */ }
  await pb.collection('employeurs').update(id, data);
  await logAction({
    actionType: 'modification_employeur',
    entiteType: 'employeur',
    entiteId: id,
    description: `Fiche employeur modifiée`,
    details: changes.length ? { changes } : undefined,
  });
};

export const deleteEmployeur = async (id: string): Promise<void> => {
  const pb = getPb();
  let nomComplet = '';
  try {
    const existing = await pb.collection('employeurs').getOne(id);
    nomComplet = (existing as any)?.nom_complet || '';
  } catch { /* best effort */ }
  await pb.collection('employeurs').delete(id);

  // Log action (historique + journal)
  const user = getCurrentUser();
  if (user) {
    await logAction({
      actionType: 'suppression_employeur',
      entiteType: 'employeur',
      entiteId: id,
      description: `${user.prenom} ${user.nom} a supprimé l'employeur${nomComplet ? ` ${nomComplet}` : ''}`,
    });
  }
};

/**
 * Patch un seul champ d'un employeur (utilisé par le verrouillage C1 de
 * l'écran d'édition — chaque champ déverrouillé peut être modifié
 * individuellement sans repasser par le formulaire complet).
 */
export const patchEmployeurField = async (
  employeurId: string,
  key: string,
  value: any,
): Promise<void> => {
  const pb = getPb();
  const trimmedValue = typeof value === 'string' ? value.trim() : value;
  const newStored = key === 'email' && !trimmedValue ? null : trimmedValue;
  let oldValue: any = null;
  try {
    const existing = await pb.collection('employeurs').getOne(employeurId);
    oldValue = (existing as any)?.[key] ?? null;
  } catch { /* best effort */ }
  // Cohérent avec createEmployeur : on omet la clé email si vide après trim,
  // pour éviter le 400 validation_is_email côté PocketBase.
  if (key === 'email' && !trimmedValue) {
    await pb.collection('employeurs').update(employeurId, { email: null });
  } else {
    await pb.collection('employeurs').update(employeurId, { [key]: trimmedValue });
  }
  await logAction({
    actionType: 'modification_champ',
    entiteType: 'employeur',
    entiteId: employeurId,
    description: `Champ employeur « ${key} » modifié`,
    details: { field: key, oldValue, newValue: newStored ?? null },
  });
};
// ============== GESTION DES CONTRATS ==============

export const createContrat = async (contrat: any): Promise<string> => {
  const pb = getPb();
  const now = new Date().toISOString();
  const year = new Date().getFullYear();

  // Numéro de dossier robuste aux courses :
  // on utilise un fragment d'ID PB (15 chars, base62) + année. C'est garanti unique
  // même en cas de création concurrente (le champ numero_dossier est UNIQUE côté PB).
  const uniqueSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const numeroDossier = `CHR-${year}-${uniqueSuffix}`;

  const commission = contrat.salaire ? Math.round(contrat.salaire / 3) : 0;

  let record;
  try {
    record = await pb.collection('contrats').create({
      numero_dossier: numeroDossier,
      employe_id: contrat.employe_id,
      employeur_id: contrat.employeur_id,
      demande_id: contrat.demande_id || '',
      date_contrat: contrat.date_contrat || now,
      poste: contrat.poste,
      type_contrat: contrat.type_contrat || 'heberge',
      format_document: contrat.format_document || 'prestation',
      date_debut: contrat.date_debut,
      date_fin: contrat.date_fin || '',
      duree: contrat.duree || '',
      salaire: contrat.salaire,
      commission_agence: commission,
      commission_payee: false,
      commission_fixe: contrat.commission_fixe ?? 15000,
      frais_transport: contrat.frais_transport ?? 5000,
      frais_dossier: contrat.frais_dossier || 0,
      frais_payes: !!contrat.frais_payes,
      statut: 'en_cours',
      domicile_employe: contrat.domicile_employe || contrat.employe_adresse_actuelle || '',
      // Prestation snapshot (complétant, non supprimé)
      client_domicile: contrat.client_domicile || '',
      client_piece_numero: contrat.client_piece_numero || '',
      client_piece_date: contrat.client_piece_date || '',
      employe_age: contrat.employe_age ?? null,
      employe_sexe: contrat.employe_sexe || '',
      employe_adresse_actuelle: contrat.employe_adresse_actuelle || '',
      employe_piece_reference: contrat.employe_piece_reference || '',
      retenue_salaire_montant: contrat.retenue_salaire_montant ?? null,
      date_signature: contrat.date_signature || contrat.date_contrat || '',
      signature_employe: contrat.signature_employe || '',
      signature_agence: contrat.signature_agence || '',
      signature_employeur: contrat.signature_employeur || '',
      notes: contrat.notes || '',
    });
  } catch (err) {
    // Échec de création du contrat (ex: numero_dossier en conflit malgré tout)
    throw err;
  }

  const createdContratId = record.id;

  // Étapes post-création : statut employé + alerte commission
  // Si l'une échoue, on supprime le contrat (rollback).
  const postSteps: Promise<any>[] = [
    pb.collection('employes').update(contrat.employe_id, { statut: 'en_poste' }),
  ];
  if (commission > 0) {
    postSteps.push(
      createAlerte({
        type: 'commission',
        titre: 'Commission à percevoir',
        message: `Commission de ${commission} FCFA à percevoir pour le contrat ${numeroDossier}`,
        contrat_id: createdContratId,
      }),
    );
  }

  try {
    await Promise.all(postSteps);
  } catch (err) {
    // Rollback : supprimer le contrat pour éviter un état incohérent
    try {
      await pb.collection('contrats').delete(createdContratId);
    } catch (delErr) {
      console.error('[cleanup] impossible de supprimer contrat', createdContratId, delErr);
    }
    // Remettre l'employé en disponible si on a réussi à le passer en_poste avant l'échec
    try {
      await pb.collection('employes').update(contrat.employe_id, { statut: 'disponible' });
    } catch { /* best effort */ }
    throw err;
  }

  // Log action (historique contrat + journal)
  const contratUser = getCurrentUser();
  if (contratUser) {
    await logAction({
      actionType: 'creation_contrat',
      entiteType: 'contrat',
      entiteId: createdContratId,
      description: `${contratUser.prenom} ${contratUser.nom} a créé le contrat ${numeroDossier}`,
    });
  }

  return createdContratId;
};

export const getContratById = async (id: string): Promise<any | null> => {
  const pb = getPb();
  try {
    const contrat = await pb.collection('contrats').getOne(id, {
      expand: 'employe_id,employeur_id',
    });
    return {
      ...contrat,
      employe_nom: contrat.expand?.employe_id?.nom || '',
      employe_prenom: contrat.expand?.employe_id?.prenom || '',
      employe_telephone: contrat.expand?.employe_id?.telephone || '',
      nom_complet: contrat.expand?.employeur_id?.nom_complet || '',
      employeur_adresse: contrat.expand?.employeur_id?.adresse || '',
      employeur_telephone: contrat.expand?.employeur_id?.telephone || '',
    };
  } catch {
    return null;
  }
};

export const getAllContrats = async (): Promise<any[]> => {
  const pb = getPb();
  const contrats = await pb.collection('contrats').getFullList({
    sort: '-date_contrat',
    expand: 'employe_id,employeur_id',
  });
  return contrats.map((c: any) => ({
    ...c,
    employe_nom: c.expand?.employe_id?.nom || '',
    employe_prenom: c.expand?.employe_id?.prenom || '',
    nom_complet: c.expand?.employeur_id?.nom_complet || '',
  }));
};

export const getContratsFinProche = async (): Promise<any[]> => {
  const pb = getPb();
  // PocketBase ne supporte pas les fonctions SQL date(), on filtre en mémoire
  const contrats = await pb.collection('contrats').getFullList({
    filter: 'statut = "en_cours"',
    expand: 'employe_id,employeur_id',
  });

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return contrats
    .filter((c: any) => {
      if (!c.date_fin) return false;
      const fin = new Date(c.date_fin);
      return fin >= now && fin <= in7Days;
    })
    .map((c: any) => ({
      ...c,
      employe_nom: c.expand?.employe_id?.nom || '',
      employe_prenom: c.expand?.employe_id?.prenom || '',
      nom_complet: c.expand?.employeur_id?.nom_complet || '',
    }));
};

export const getCommissionsAPercevoir = async (): Promise<any[]> => {
  const pb = getPb();
  const contrats = await pb.collection('contrats').getFullList({
    filter: 'commission_payee = false && commission_agence > 0',
    sort: '-date_contrat',
    expand: 'employe_id,employeur_id',
  });
  return contrats.map((c: any) => ({
    ...c,
    employe_nom: c.expand?.employe_id?.nom || '',
    employe_prenom: c.expand?.employe_id?.prenom || '',
    nom_complet: c.expand?.employeur_id?.nom_complet || '',
  }));
};

export const getContratsEnCours = async (): Promise<any[]> => {
  const pb = getPb();
  const contrats = await pb.collection('contrats').getFullList({
    filter: 'statut = "en_cours"',
    sort: '-date_debut',
    expand: 'employe_id,employeur_id',
  });
  return contrats.map((c: any) => ({
    ...c,
    employe_nom: c.expand?.employe_id?.nom || '',
    employe_prenom: c.expand?.employe_id?.prenom || '',
    nom_complet: c.expand?.employeur_id?.nom_complet || '',
  }));
};

export const updateContrat = async (id: string, data: any): Promise<void> => {
  const pb = getPb();
  const updateData: any = { ...data };
  delete updateData.employe_nom;
  delete updateData.employe_prenom;
  delete updateData.nom_complet;
  delete updateData.expand;
  // format_document figé à la création : jamais modifiable après
  delete updateData.format_document;

  // La commission (tiers du salaire) est calculée à la création : si le
  // salaire est renseigné/modifié après, on la recalcule (sinon elle reste
  // à 0 et le Suivi/alertes/calendrier ignorent le contrat).
  if (updateData.salaire !== undefined && updateData.salaire !== null && updateData.salaire !== '') {
    const sal = Number(updateData.salaire);
    if (!isNaN(sal) && sal > 0) updateData.commission_agence = Math.round(sal / 3);
  }

  let changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
  try {
    const existing = await pb.collection('contrats').getOne(id);
    changes = diffRecordChanges(existing, updateData).slice(0, 10);
  } catch { /* best effort */ }

  await pb.collection('contrats').update(id, updateData);
  await logAction({
    actionType: 'modification_contrat',
    entiteType: 'contrat',
    entiteId: id,
    description: `Contrat modifié`,
    details: changes.length ? { changes } : undefined,
  });
};

export const terminerContrat = async (id: string): Promise<void> => {
  const pb = getPb();
  const contrat = await getContratById(id);
  if (!contrat) return;

  await pb.collection('contrats').update(id, { statut: 'termine' });
  await pb.collection('employes').update(contrat.employe_id, { statut: 'disponible' });
  await logAction({
    actionType: 'contrat_termine',
    entiteType: 'contrat',
    entiteId: id,
    description: `Contrat ${contrat.numero_dossier || ''} terminé`,
  });
};

export const deleteContrat = async (id: string): Promise<void> => {
  const pb = getPb();
  const contrat = await getContratById(id).catch(() => null);
  const numero = (contrat as any)?.numero_dossier || '';
  const employeId = (contrat as any)?.employe_id || '';
  // Pièces liées : documents (contrat_id), scans signés, alertes — best effort,
  // car sans cascadeDelete côté PB elles bloqueraient le delete.
  try {
    const docs = await getDocumentsByContrat(id).catch(() => []);
    await Promise.all((docs || []).map((d: any) => pb.collection('documents').delete(d.id).catch(() => null)));
  } catch { /* best effort */ }
  try {
    const pages = await getScans('contrat', id).catch(() => []);
    await Promise.all((pages || []).map((p: any) => pb.collection('scans').delete(p.id).catch(() => null)));
  } catch { /* best effort */ }
  try {
    const alertes = await pb.collection('alertes').getFullList({ filter: `contrat_id = "${id}"` }).catch(() => []);
    await Promise.all((alertes || []).map((a: any) => pb.collection('alertes').delete(a.id).catch(() => null)));
  } catch { /* best effort */ }
  await pb.collection('contrats').delete(id);
  // L'employé redevient disponible, comme à la fin d'un contrat.
  if (employeId) {
    try { await pb.collection('employes').update(employeId, { statut: 'disponible' }); } catch { /* best effort */ }
  }

  // Log action (historique + journal)
  const user = getCurrentUser();
  if (user) {
    await logAction({
      actionType: 'suppression_contrat',
      entiteType: 'contrat',
      entiteId: id,
      description: `${user.prenom} ${user.nom} a supprimé le contrat${numero ? ` ${numero}` : ''}`,
    });
  }
};

export const marquerCommissionPayee = async (id: string, datePrelevement?: string): Promise<void> => {
  const pb = getPb();
  const updateData: any = { commission_payee: true };
  if (datePrelevement) {
    updateData.date_prelevement = datePrelevement;
  } else {
    updateData.date_prelevement = new Date().toISOString().substring(0, 10);
  }

  const [, alertes] = await Promise.all([
    pb.collection('contrats').update(id, updateData),
    pb.collection('alertes').getFullList({
      filter: `contrat_id = "${id}" && type = "commission"`,
    }),
  ]);
  if (alertes.length > 0) {
    await Promise.all(
      alertes.map((a: any) => pb.collection('alertes').update(a.id, { lu: true })),
    );
  }
  await logAction({
    actionType: 'commission_payee',
    entiteType: 'contrat',
    entiteId: id,
    description: `Commission encaissée pour le contrat`,
  });
};

// ============== GESTION DES ALERTES ==============

export const createAlerte = async (alerte: any): Promise<string> => {
  const pb = getPb();
  const record = await pb.collection('alertes').create({
    type: alerte.type,
    titre: alerte.titre,
    message: alerte.message,
    contrat_id: alerte.contrat_id || '',
    employe_id: alerte.employe_id || '',
    employeur_id: alerte.employeur_id || '',
    lu: false,
    date_alerte: new Date().toISOString(),
  });
  return record.id;
};

export const getAlertesNonLues = async (): Promise<any[]> => {
  const pb = getPb();
  // Tri serveur '-created' + filtre = 400 sur pb2 → tri client (plus récent d'abord)
  return (await pb.collection('alertes').getFullList({
    filter: 'lu = false',
  })).sort((a: any, b: any) => +new Date(b.created) - +new Date(a.created));
};

export const getAllAlertes = async (): Promise<any[]> => {
  const pb = getPb();
  return await pb.collection('alertes').getFullList({
    sort: '-created',
  });
};

export const marquerAlerteLue = async (id: string): Promise<void> => {
  const pb = getPb();
  await pb.collection('alertes').update(id, { lu: true });
};

export const marquerToutesAlertesLues = async (): Promise<void> => {
  const pb = getPb();
  const alertes = await pb.collection('alertes').getFullList({
    filter: 'lu = false',
  });
  if (alertes.length === 0) return;
  await Promise.all(
    alertes.map((a: any) => pb.collection('alertes').update(a.id, { lu: true })),
  );
};

// ─── Créer alertes fin de contrat (J-7 et J-3) ──────────────────
// À appeler périodiquement (ex: au chargement Dashboard, ou via cron)
export const createFinContratAlertes = async (): Promise<number> => {
  const pb = getPb();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Dates cibles : J+7 et J+3
  const targetDates = [7, 3].map((days) => {
    const d = new Date(today);
    d.setDate(today.getDate() + days);
    return d.toISOString().substring(0, 10);
  });

  // Récupérer les contrats en cours dont la date_fin correspond à J+7 ou J+3
  // et qui n'ont pas déjà une alerte pour cette date
  const contrats = await pb.collection('contrats').getFullList({
    filter: `statut = "en_cours" && date_fin != "" && (${targetDates.map(d => `date_fin = "${d}"`).join(' || ')})`,
    expand: 'employe_id,employeur_id',
  });

  let created = 0;
  for (const contrat of contrats) {
    const daysUntil = Math.ceil((new Date(contrat.date_fin).getTime() - today.getTime()) / 86400000);
    const alerteType = daysUntil === 7 ? 'fin_contrat_j7' : 'fin_contrat_j3';
    const titre = daysUntil === 7 ? 'Fin de contrat dans 7 jours' : 'Fin de contrat dans 3 jours';
    
    // Vérifier si alerte existe déjà pour ce contrat et ce type
    const existing = await pb.collection('alertes').getFullList({
      filter: `contrat_id = "${contrat.id}" && type = "${alerteType}"`,
    });
    
    if (existing.length === 0) {
      await createAlerte({
        type: alerteType,
        titre,
        message: `${contrat.expand?.employe_id?.prenom || ''} ${contrat.expand?.employe_id?.nom || ''} (${contrat.poste}) chez ${contrat.expand?.employeur_id?.nom_complet || ''} — Fin le ${new Date(contrat.date_fin).toLocaleDateString('fr-FR')}`,
        contrat_id: contrat.id,
        employe_id: contrat.employe_id,
        employeur_id: contrat.employeur_id,
      });
      created++;
    }
  }
  return created;
};

// ─── Créer alertes commission à prélever (échéance 1 mois atteinte) ───
// À appeler au chargement Dashboard (comme createFinContratAlertes).
// Une seule alerte par contrat (jamais de doublon), best effort : un échec
// ne doit jamais bloquer l'app.
export const createCommissionDueAlertes = async (): Promise<number> => {
  const pb = getPb();
  const contrats = await pb.collection('contrats').getFullList({
    filter: 'commission_agence > 0 && commission_payee = false',
    expand: 'employe_id,employeur_id',
  });
  let created = 0;
  for (const contrat of contrats) {
    const dueStr = getCommissionDueDate(contrat);
    if (!dueStr) continue;
    // Échéance atteinte (même règle que le Suivi : relance dès le lendemain)
    if (Date.now() < new Date(dueStr + 'T23:59:59').getTime()) continue;
    const existing = await pb.collection('alertes').getFullList({
      filter: `contrat_id = "${contrat.id}" && type = "commission_due"`,
    });
    if (existing.length > 0) continue;
    const employe = `${contrat.expand?.employe_id?.prenom || ''} ${contrat.expand?.employe_id?.nom || ''}`.trim() || 'Employé';
    const employeur = contrat.expand?.employeur_id?.nom_complet || '';
    const montant = `${Number(contrat.commission_agence || 0).toLocaleString('fr-FR')} FCFA`;
    const dueFr = new Date(dueStr + 'T12:00:00').toLocaleDateString('fr-FR');
    await createAlerte({
      type: 'commission_due',
      titre: 'Commission à prélever',
      message: `${employe}${contrat.poste ? ` (${contrat.poste})` : ''}${employeur ? ` chez ${employeur}` : ''} — échéance atteinte le ${dueFr} — ${montant}`,
      contrat_id: contrat.id,
      employe_id: contrat.employe_id,
      employeur_id: contrat.employeur_id,
    });
    created++;
  }
  return created;
};

// ============== STATISTIQUES ==============

export const getDashboardStats = async (): Promise<any> => {
  const pb = getPb();

  // On évite getFullList() qui chargerait TOUTES les lignes en mémoire.
  // Pour les counts purs, getList(1, 1) renvoie totalItems sans payload.
  // Pour le calcul des commissions, on charge uniquement le champ commission_agence
  // des contrats en cours non payés (limité à 500 pour éviter OOM sur mobile).
  const [
    employesTotal,
    employesDisponibles,
    employesEnPoste,
    employeursTotal,
    contratsEnCours,
    contratsTermines,
    commissionsRaw,
    alertesNonLues,
  ] = await Promise.all([
    pb.collection('employes').getList(1, 1, { fields: 'id' }),
    pb.collection('employes').getList(1, 1, { filter: 'statut = "disponible"', fields: 'id' }),
    pb.collection('employes').getList(1, 1, { filter: 'statut = "en_poste"', fields: 'id' }),
    pb.collection('employeurs').getList(1, 1, { fields: 'id' }),
    pb.collection('contrats').getList(1, 1, { filter: 'statut = "en_cours"', fields: 'id' }),
    pb.collection('contrats').getList(1, 1, { filter: 'statut = "termine"', fields: 'id' }),
    pb.collection('contrats').getList(1, 500, {
      filter: 'statut = "en_cours" && commission_payee = false',
      fields: 'commission_agence',
    }),
    pb.collection('alertes').getList(1, 1, { filter: 'lu = false', fields: 'id' }),
  ]);

  return {
    total_employes: employesTotal.totalItems,
    employes_disponibles: employesDisponibles.totalItems,
    employes_en_poste: employesEnPoste.totalItems,
    total_employeurs: employeursTotal.totalItems,
    contrats_en_cours: contratsEnCours.totalItems,
    contrats_termines: contratsTermines.totalItems,
    commissions_a_percervoir: commissionsRaw.items.reduce(
      (sum: number, c: any) => sum + (c.commission_agence || 0),
      0,
    ),
    alertes_actives: alertesNonLues.totalItems,
  };
};

export const getEmployesParCategorie = async (): Promise<any[]> => {
  const pb = getPb();
  const employes = await pb.collection('employes').getFullList();
  const grouped: Record<string, number> = {};
  for (const emp of employes) {
    const cat = emp.categorie_emploi || 'autre';
    grouped[cat] = (grouped[cat] || 0) + 1;
  }
  return Object.entries(grouped).map(([categorie_emploi, count]) => ({ categorie_emploi, count }));
};

export const getContratsParStatut = async (): Promise<any[]> => {
  const pb = getPb();
  const contrats = await pb.collection('contrats').getFullList();
  const grouped: Record<string, number> = {};
  for (const c of contrats) {
    grouped[c.statut] = (grouped[c.statut] || 0) + 1;
  }
  return Object.entries(grouped).map(([statut, count]) => ({ statut, count }));
};

/** Export alias pour l'URL PocketBase (utile depuis les screens) */
export const getServerUrlAlias = (): string => getPocketBaseUrl();

// ============== DONNÉES CALENDRIER ==============

/**
 * Récupérer tous les événements pour un mois donné (pour le calendrier)
 */
/**
 * Calculer la date d'échéance de la commission (date_debut + 1 mois)
 */
/**
 * Date d'échéance de la commission = 1 mois calendaire après date_debut
 * (ou date_contrat en repli). Règle UNIQUE (décision Phase 4, point 10) :
 * le calendrier et le Suivi des commissions utilisent la même fonction.
 */
export function getCommissionDueDate(contrat: any): string | null {
  if (contrat.date_debut) {
    const d = new Date(contrat.date_debut);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 10);
  }
  // fallback : date_contrat + 1 mois
  const d = new Date(contrat.date_contrat);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().substring(0, 10);
}

/**
 * Vérifier si une date (YYYY-MM-DD) tombe dans un mois donné
 */
function isDateInMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.getFullYear() === year && d.getMonth() === month;
}

/**
 * Récupérer tous les événements pour un mois donné (calendrier)
 *
 * ATTENTION — La commission est due à date_debut+1mois, PAS le jour de la
 * signature du contrat. Comme le contrat a été signé le mois précédent, la
 * requête PB filtrant sur date_contrat ne le trouverait PAS quand on regarde
 * le mois de la commission.
 *
 * Solution : on charge séparément les contrats avec commission impayée, puis
 * on filtre en JS ceux dont l'échéance tombe dans le mois demandé.
 */
export const getCalendarEvents = async (year: number, month: number): Promise<any[]> => {
  const pb = getPb();

  // Début et fin du mois
  const debut = new Date(year, month, 1);
  const fin = new Date(year, month + 1, 0, 23, 59, 59);
  const debutStr = debut.toISOString();
  const finStr = fin.toISOString();

  // 1. Inscriptions du mois
  const employes = await pb.collection('employes').getFullList({
    filter: `date_inscription >= "${debutStr}" && date_inscription <= "${finStr}"`,
    sort: 'date_inscription',
  });

  // 2. Contrats signés dans le mois (pastille VERTE)
  const contratsDuMois = await pb.collection('contrats').getFullList({
    filter: `date_contrat >= "${debutStr}" && date_contrat <= "${finStr}"`,
    sort: 'date_contrat',
    expand: 'employe_id,employeur_id',
  });

  // 3. Contrats avec commission impayée — pour la pastille ORANGE
  //    On les charge TOUS (peu nombreux en pratique) puis on filtre en JS
  //    ceux dont l'échéance tombe dans le mois demandé.
  let contratsCommission: any[] = [];
  try {
    contratsCommission = await pb.collection('contrats').getFullList({
      filter: 'commission_agence > 0 && commission_payee = false',
      expand: 'employe_id,employeur_id',
      // Note : pas de limite de date — on charge tous les impayés et on
      // filtre en mémoire. À la taille actuelle (<500 contrats) c'est
      // négligeable ; si ça devient lent, ajouter un cache.
    });
  } catch (err) {
    console.warn('[calendar] Impossible de charger les commissions impayées', err);
  }

  // --- Construction des événements ---

  const events: any[] = [];

  // Inscriptions
  for (const emp of employes) {
    events.push({
      id: `inscription_${emp.id}`,
      date: emp.date_inscription,
      type: 'inscription',
      titre: `${emp.nom || ''} ${emp.prenom || ''}`.trim() || 'Nouvel employé',
      sousTitre: emp.categorie_emploi || '',
      contrat_id: undefined,
      employe_id: emp.id,
    });
  }

  // Contrats signés dans le mois (pastille VERTE)
  const idsDuMois = new Set(contratsDuMois.map(c => c.id));

  for (const c of contratsDuMois) {
    const employe = c.expand?.employe_id;
    const employeur = c.expand?.employeur_id;

    events.push({
      id: `contrat_${c.id}`,
      date: c.date_contrat,
      type: 'contrat',
      titre: `${employe?.nom || ''} ${employe?.prenom || ''}`.trim() || 'Contrat',
      sousTitre: employeur?.nom_complet || '',
      ref: c.numero_dossier,
      contrat_id: c.id,
      employe_id: c.employe_id,
    });

    // Commission si échéance dans le même mois que la signature
    if (c.commission_agence > 0 && !c.commission_payee) {
      const dueDate = getCommissionDueDate(c);
      if (dueDate && isDateInMonth(dueDate, year, month)) {
        events.push({
          id: `commission_${c.id}`,
          date: dueDate,
          type: 'commission',
          titre: `${employe?.nom || ''} ${employe?.prenom || ''}`.trim() || 'Commission',
          sousTitre: c.numero_dossier,
          montant: c.commission_agence,
          ref: c.numero_dossier,
          contrat_id: c.id,
          employe_id: c.employe_id,
        });
      }
    }
  }

  // Commissions des contrats PLUS ANCIENS (pastille ORANGE)
  // dont l'échéance (date_debut+1mois) tombe dans le mois demandé
  for (const c of contratsCommission) {
    // Éviter les doublons : déjà traité dans contratsDuMois
    if (idsDuMois.has(c.id)) continue;

    const employe = c.expand?.employe_id;
    const dueDate = getCommissionDueDate(c);

    if (dueDate && isDateInMonth(dueDate, year, month)) {
      events.push({
        id: `commission_${c.id}`,
        date: dueDate,
        type: 'commission',
        titre: `${employe?.nom || ''} ${employe?.prenom || ''}`.trim() || 'Commission',
        sousTitre: c.numero_dossier,
        montant: c.commission_agence,
        ref: c.numero_dossier,
        contrat_id: c.id,
        employe_id: c.employe_id,
      });
    }
  }

  return events;
};

// ============== GESTION DES SCANS ==============

/**
 * Crée (ou remplace) un scan pour un document (fiche d'inscription ou contrat).
 * documentType: 'fiche_inscription' | 'contrat'
 * documentId: l'id PocketBase de l'employé ou du contrat
 * imageUri: URI locale de l'image (du picker/photo) ou File (web)
 */
export const uploadScan = async (
  documentType: 'fiche_inscription' | 'contrat',
  documentId: string,
  imageUri: string | File,
  replace = true,
): Promise<string> => {
  const pb = getPb();

  // Supprimer l'ancien scan s'il existe (on remplace), sauf en mode ajout (multi-pages)
  if (replace) {
    const existing = await getScan(documentType, documentId);
    if (existing) {
      try { await pb.collection('scans').delete(existing.id); } catch {}
    }
  }

  let imageField: any;
  if (typeof imageUri === 'string') {
    // React Native — URI locale (ex: expo-image-picker), assainie (% → copie cache)
    imageUri = await safeLocalUri(imageUri);
    // Tentative native (multipart natif, contourne le fetch RN défaillant)
    const safeNative = await nativeUploadRecord('scans', imageUri, 'image', 'image/jpeg', {
      document_type: documentType,
      document_id: documentId,
    });
    if (safeNative?.id) return safeNative.id;
    imageField = {
      uri: imageUri,
      type: 'image/jpeg',
      name: `scan_${documentType}_${documentId}.jpg`,
    };
  } else {
    // Web — File object
    imageField = imageUri;
  }

  const record = await pb.collection('scans').create({
    image: imageField,
    document_type: documentType,
    document_id: documentId,
  });
  return record.id;
};

/** Récupère le scan d'un document (ou null) */
export const getScan = async (
  documentType: 'fiche_inscription' | 'contrat',
  documentId: string,
): Promise<any | null> => {
  const pb = getPb();
  const pbUrl = getPocketBaseUrl();
  try {
    const records = await pb.collection('scans').getList(1, 1, {
      // Pas de tri serveur : '-created' + filtre = 400 sur pb2 (un seul item de toute façon)
      filter: `document_type="${documentType}" && document_id="${documentId}"`,
    });
    if (records.items.length === 0) return null;
    const item = records.items[0];
    // Construire l'URL complète de l'image
    const imageUrl = item.image
      ? `${pbUrl}/api/files/scans/${item.id}/${item.image}`
      : null;
    return { ...item, imageUrl };
  } catch {
    return null;
  }
};

/** Stocke les N pages d'un scan multi-pages (ex: contrat 3 pages).
 *  Remplace les anciens scans du document, puis crée un record `scans`
 *  par page, dans l'ordre (page 1 = la plus ancienne = premier item de getScans). */
export const uploadScanPages = async (
  documentType: 'fiche_inscription' | 'contrat',
  documentId: string,
  imageUris: (string | File)[],
): Promise<string[]> => {
  const pb = getPb();
  try {
    const existing = await pb.collection('scans').getFullList({
      filter: `document_type="${documentType}" && document_id="${documentId}"`,
    });
    await Promise.all(existing.map((s: any) => pb.collection('scans').delete(s.id).catch(() => null)));
  } catch { /* best effort */ }
  const ids: string[] = [];
  for (const uri of imageUris) {
    ids.push(await uploadScan(documentType, documentId, uri, false));
  }
  return ids;
};

/** Récupère TOUTES les pages scannées d'un document, dans l'ordre (page 1 d'abord). */
export const getScans = async (
  documentType: 'fiche_inscription' | 'contrat',
  documentId: string,
): Promise<any[]> => {
  const pb = getPb();
  const pbUrl = getPocketBaseUrl();
  try {
    const records = await pb.collection('scans').getFullList({
      // Pas de tri serveur : filtre + tri = 400 sur pb2 → tri client ci-dessous
      filter: `document_type="${documentType}" && document_id="${documentId}"`,
    });
    const ordered = [...records].sort((a: any, b: any) => +new Date(a.created) - +new Date(b.created));
    return ordered.map((item: any) => ({
      ...item,
      imageUrl: item.image ? `${pbUrl}/api/files/scans/${item.id}/${item.image}` : null,
    }));
  } catch {
    return [];
  }
};

// ============== DOCUMENTS ASSOCIÉS À UNE FICHE ==============
// Nouvelle collection `documents` (créée 01/08/2026) : employe_id (relation), type (select), image (file).
// Un employé peut avoir zéro, un ou plusieurs documents (CNI, CNI parent, extrait naissance, permis, passeport, CV).

export const DOCUMENT_TYPES = [
  { value: 'carte_identite', label: 'Carte d\u2019identité', icon: '🪪' },
  { value: 'carte_identite_parent', label: 'Carte d\u2019identité d\u2019un parent', icon: '👪' },
  { value: 'extrait_naissance', label: 'Extrait de naissance', icon: '👶' },
  { value: 'permis_conduire', label: 'Permis de conduire', icon: '🚗' },
  { value: 'passeport', label: 'Passeport', icon: '🛂' },
  { value: 'cv', label: 'CV', icon: '📄' },
  { value: 'registre_commerce', label: 'Registre de commerce (RCCM)', icon: '🏢' },
  { value: 'licence_commerciale', label: 'Licence commerciale', icon: '📜' },
  { value: 'autre', label: 'Autre document', icon: '📎' },
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number]['value'];

export const getDocumentTypeLabel = (value: string): string =>
  DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value;

export const getDocumentTypeIcon = (value: string): string =>
  DOCUMENT_TYPES.find((t) => t.value === value)?.icon ?? '📎';

/** Construit l'URL publique de l'image d'un document associé. */
export const getDocumentImageUrl = (docId: string, filename: string | null | undefined): string | null => {
  if (!docId || !filename) return null;
  const pbUrl = getPocketBaseUrl();
  return `${pbUrl}/api/files/documents/${docId}/${filename}`;
};

/** Liste les documents associés à un employé (tri : plus récent d'abord). */
export const getDocumentsByEmploye = async (employeId: string): Promise<any[]> => {
  const pb = getPb();
  try {
    const records = await pb.collection('documents').getList(1, 50, {
      filter: `employe_id="${employeId}"`,
    });
    console.log('[UPLOAD-DIAG] getDocumentsByEmploye OK, items =', records.items.length);
    const pbUrl = getPocketBaseUrl();
    return records.items.map((item: any) => {
      const fname = item.file || item.image || null;
      return {
        ...item,
        imageUrl: fname ? `${pbUrl}/api/files/documents/${item.id}/${fname}` : null,
        nomFichier: fname,
      };
    });
  } catch (e: any) {
    console.error('[UPLOAD-DIAG] getDocumentsByEmploye ÉCHEC status=', e?.status, '| msg=', e?.message);
    return [];
  }
};

/**
 * Ajoute un document associé à une fiche d'employé.
 * type: une des valeurs DOCUMENT_TYPES ; imageUri: URI locale (RN) ou File (web).
 */
/** Normalise un mime pour le file field `documents.file` (PB 0.39 exige des mimes explicites). */
function resolveDocumentMime(ext: string, mimeIn?: string): string {
  if (mimeIn) {
    const m = mimeIn.toLowerCase();
    if (m === 'image/jpg') return 'image/jpeg';
    // Word .docx a un mime distinct de .doc — ne pas l'écraser en msword
    if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return m;
    if (m === 'application/msword' || m === 'application/pdf' || m.startsWith('image/')) return m;
  }
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  return 'image/jpeg';
}

export const uploadDocument = async (
  employeId: string,
  type: string,
  imageUri: string | File,
  fileName?: string,
  mimeType?: string,
): Promise<string | null> => {
  const pb = getPb();
  // ── DIAGNOSTIC TEMPORAIRE (à retirer après debug upload) ──
  console.log('[UPLOAD-DIAG] authStore.isValid =', pb.authStore.isValid);
  console.log('[UPLOAD-DIAG] baseUrl =', (pb as any).baseUrl);
  console.log('[UPLOAD-DIAG] employeId =', employeId, '| type =', type);
  try {
    let imageField: any;
    if (typeof imageUri === 'string') {
      imageUri = await safeLocalUri(imageUri, fileName);
      const ext = (fileName || imageUri).split('.').pop()?.toLowerCase() || 'jpg';
      const fileType = resolveDocumentMime(ext, mimeType);
      imageField = {
        uri: imageUri,
        type: fileType,
        name: fileName || `doc_${type}_${Date.now()}.${ext}`,
      };
    } else {
      imageField = imageUri;
    }
    console.log('[UPLOAD-DIAG] imageField =', JSON.stringify(imageField).slice(0, 160));
    if (typeof imageUri === 'string') {
      const nativeId = await nativeUploadDoc(imageUri, fileName, mimeType, type, 'employe_id', employeId);
      if (nativeId) return nativeId;
      console.log('[UPLOAD-DIAG] natif indisponible, repli SDK…');
    }
    const record = await pb.collection('documents').create({
      // Compat VPS (champ `image`) + local (champ `file`) — on envoie les deux pour éviter le 400
      file: imageField,
      image: imageField,
      employe_id: employeId,
      type,
    } as any);
    console.log('[UPLOAD-DIAG] SUCCÈS record.id =', record.id);
    return record.id;
  } catch (e: any) {
    console.error('[UPLOAD-DIAG] ÉCHEC status=', e?.status, '| msg=', e?.message, '| data=', JSON.stringify(e?.data));
    return null;
  }
};

/** Supprime un document associé. */
export const deleteDocument = async (docId: string): Promise<boolean> => {
  const pb = getPb();
  try {
    await pb.collection('documents').delete(docId);
    return true;
  } catch (e) {
    console.error('deleteDocument error:', e);
    return false;
  }
};

/** Supprime une page de scan (collection `scans`). */
export const deleteScan = async (scanId: string): Promise<boolean> => {
  const pb = getPb();
  try {
    await pb.collection('scans').delete(scanId);
    return true;
  } catch (e) {
    console.error('deleteScan error:', e);
    return false;
  }
};

// ============== DOCUMENTS ASSOCIÉS À UN EMPLOYEUR ==============
// Même collection `documents` que les employés, mais liés via employeur_id.

/** Liste les documents associés à un employeur (tri : plus récent d'abord). */
export const getDocumentsByEmployeur = async (employeurId: string): Promise<any[]> => {
  const pb = getPb();
  try {
    const records = await pb.collection('documents').getList(1, 50, {
      // Pas de tri serveur : '-created' + filtre = 400 sur pb2 (tri client ci-dessous)
      filter: `employeur_id="${employeurId}"`,
    });
    console.log('[UPLOAD-DIAG] getDocumentsByEmployeur OK, items =', records.items.length);
    const pbUrl = getPocketBaseUrl();
    // Tri serveur '-created' + filtre = 400 sur pb2 → tri client (plus récent d'abord)
    const ordered = [...records.items].sort((a: any, b: any) => +new Date(b.created) - +new Date(a.created));
    return ordered.map((item: any) => {
      const fname = item.file || item.image || null;
      return {
        ...item,
        imageUrl: fname ? `${pbUrl}/api/files/documents/${item.id}/${fname}` : null,
        nomFichier: fname,
      };
    });
  } catch (e: any) {
    console.error('[UPLOAD-DIAG] getDocumentsByEmployeur ÉCHEC status=', e?.status, '| msg=', e?.message);
    return [];
  }
};

/**
 * Ajoute un document associé à un employeur.
 * type: une des valeurs DOCUMENT_TYPES ; imageUri: URI locale (RN) ou File (web).
 */
export const uploadEmployeurDocument = async (
  employeurId: string,
  type: string,
  imageUri: string | File,
  fileName?: string,
  mimeType?: string,
): Promise<string | null> => {
  const pb = getPb();
  // ── DIAGNOSTIC TEMPORAIRE (à retirer après debug upload) ──
  console.log('[UPLOAD-DIAG] employeur upload | authValid =', pb.authStore.isValid);
  console.log('[UPLOAD-DIAG] employeur upload | baseUrl =', (pb as any).baseUrl);
  console.log('[UPLOAD-DIAG] employeur upload | employeurId =', employeurId, '| type =', type);
  try {
    let imageField: any;
    if (typeof imageUri === 'string') {
      imageUri = await safeLocalUri(imageUri, fileName);
      const ext = (fileName || imageUri).split('.').pop()?.toLowerCase() || 'jpg';
      const fileType = resolveDocumentMime(ext, mimeType);
      imageField = {
        uri: imageUri,
        type: fileType,
        name: fileName || `doc_${type}_${Date.now()}.${ext}`,
      };
    } else {
      imageField = imageUri;
    }
    console.log('[UPLOAD-DIAG] employeur upload | imageField =', JSON.stringify(imageField).slice(0, 200));
    if (typeof imageUri === 'string') {
      const nativeId = await nativeUploadDoc(imageUri, fileName, mimeType, type, 'employeur_id', employeurId);
      if (nativeId) return nativeId;
      console.log('[UPLOAD-DIAG] natif indisponible, repli SDK…');
    }
    const record = await pb.collection('documents').create({
      // Compat VPS `image` + local `file`
      file: imageField,
      image: imageField,
      employeur_id: employeurId,
      type,
    } as any);
    console.log('[UPLOAD-DIAG] employeur upload SUCCÈS record.id =', record.id);
    return record.id;
  } catch (e: any) {
    console.error('[UPLOAD-DIAG] employeur upload ÉCHEC status=', e?.status, '| msg=', e?.message, '| data=', JSON.stringify(e?.data));
    return null;
  }
};

// ============== DOCUMENTS ASSOCIÉS À UN CONTRAT ==============
// Même collection `documents` mais liés via contrat_id (ajout migration 1787300000).

/** Liste les documents annexes liés à un contrat (tri : plus récent d'abord). */
export const getDocumentsByContrat = async (contratId: string): Promise<any[]> => {
  const pb = getPb();
  try {
    const records = await pb.collection('documents').getList(1, 50, {
      // Pas de tri serveur : '-created' + filtre = 400 sur pb2 → tri client ci-dessous
      filter: `contrat_id="${contratId}"`,
    });
    const pbUrl = getPocketBaseUrl();
    // Tri client (plus récent d'abord)
    const orderedContrat = [...records.items].sort((a: any, b: any) => +new Date(b.created) - +new Date(a.created));
    return orderedContrat.map((item: any) => {
      const fname = item.file || item.image || null;
      return {
        ...item,
        imageUrl: fname ? `${pbUrl}/api/files/documents/${item.id}/${fname}` : null,
        nomFichier: fname,
      };
    });
  } catch {
    return [];
  }
};

/**
 * Ajoute un document annexe à un contrat.
 */
export const uploadContratDocument = async (
  contratId: string,
  type: string,
  imageUri: string | File,
  fileName?: string,
  mimeType?: string,
): Promise<string | null> => {
  const pb = getPb();
  try {
    let imageField: any;
    if (typeof imageUri === 'string') {
      imageUri = await safeLocalUri(imageUri, fileName);
      const ext = (fileName || imageUri).split('.').pop()?.toLowerCase() || 'jpg';
      const fileType = resolveDocumentMime(ext, mimeType);
      imageField = {
        uri: imageUri,
        type: fileType,
        name: fileName || `doc_${type}_${Date.now()}.${ext}`,
      };
    } else {
      imageField = imageUri;
    }
    if (typeof imageUri === 'string') {
      const nativeId = await nativeUploadDoc(imageUri, fileName, mimeType, type, 'contrat_id', contratId);
      if (nativeId) return nativeId;
      console.log('[UPLOAD-DIAG] uploadContratDocument: natif indisponible, repli SDK…');
    }
    const record = await pb.collection('documents').create({
      // Compat VPS `image` + local `file`, + contrat_id (absent sur VPS mais ignoré si strict false)
      file: imageField,
      image: imageField,
      contrat_id: contratId,
      type,
    } as any);
    return record.id;
  } catch (e: any) {
    console.error('[UPLOAD-DIAG] uploadContratDocument ÉCHEC', e?.status, e?.message, e?.data);
    return null;
  }
};


// ============== PHOTO D'IDENTITÉ EMPLOYÉ ==============

/** Construit l'URL publique d'une photo d'employé stockée dans le file field `photo`. */
export const getEmployePhotoUrl = (employeId: string, filename: string | null | undefined): string | null => {
  if (!employeId || !filename) return null;
  const pbUrl = getPocketBaseUrl();
  return `${pbUrl}/api/files/employes/${employeId}/${filename}`;
};

/**
 * Upload (ou remplace) la photo d'identité d'un employé.
 * imageUri : URI locale react-native (file:///...) ou File web.
 * Renvoie le nom de fichier généré par PocketBase (ex: "abc123.jpg").
 */
export const uploadEmployePhoto = async (
  employeId: string,
  imageUri: string | File,
): Promise<string | null> => {
  const pb = getPb();
  if (typeof imageUri !== 'string') {
    const record = await pb.collection('employes').update(employeId, { photo: imageUri });
    return (record as any).photo || null;
  }
  // 1. Réduire : l'appareil/galerie en qualité max produit des originaux de
  // plusieurs Mo, rejetés par PB (photo limitée à 5 Mo) avec une 400.
  // Sans éditeur dans ce flux, on envoie l'original tel quel → échec.
  let uri = await safeLocalUri(imageUri, `photo_${employeId}.jpg`);
  try {
    const small = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
      compress: 0.8,
      format: SaveFormat.JPEG,
    });
    if (small?.uri) uri = small.uri;
  } catch { /* on envoie l'URI assainie telle quelle */ }
  const photoField = {
    uri,
    type: 'image/jpeg',
    name: `photo_${employeId}.jpg`,
  };
  // 2. Chemin natif (PATCH) comme les 4 autres uploads : le multipart via
  // fetch échoue en status 0 depuis Expo Go. Repli SDK ensuite.
  try {
    const token = (pb.authStore as any)?.token;
    if (token) {
      const res = await uploadAsync(
        `${getPocketBaseUrl()}/api/collections/employes/records/${employeId}`,
        uri,
        {
          httpMethod: 'PATCH',
          uploadType: FileSystemUploadType.MULTIPART,
          fieldName: 'photo',
          mimeType: 'image/jpeg',
          headers: { Authorization: token },
        },
      );
      if (res.status >= 200 && res.status < 300) {
        const parsed = JSON.parse(res.body);
        if ((parsed as any)?.photo) return (parsed as any).photo;
      }
    }
  } catch { /* repli SDK ci-dessous */ }
  const record = await pb.collection('employes').update(employeId, { photo: photoField });
  return (record as any).photo || null;
};

/** True si l'URI est une source locale (à uploader) et non une URL déjà sur le serveur. */
export const isLocalPhotoUri = (uri: string | null | undefined): boolean => {
  if (!uri) return false;
  return uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('cache:') || uri.startsWith('/');
};

// ============== PARAMÈTRES APPLI (CLÉ API GEMINI) ==============
// La clé Gemini est une config LOCALE par appareil (pas une donnée métier).
// Stockée en local (localStorage web / SQLite natif) — pas sur _superusers,
// car l'app tourne en user normal et n'a pas les droits superuser (403).

const GEMINI_KEY_STORAGE = 'gemini_api_key';

/** Récupère la clé API Gemini depuis le stockage local de l'appareil. */
export const getGeminiApiKey = async (): Promise<string | null> => {
  return getSetting(GEMINI_KEY_STORAGE);
};

/** Sauvegarde la clé API Gemini dans le stockage local de l'appareil. */
export const saveGeminiApiKey = async (key: string): Promise<void> => {
  await setSetting(GEMINI_KEY_STORAGE, key);
};

// ============== PARAMÈTRES APPLI (CLÉ API KILOCODE — RELAIS STEPFUN) ==============
// Route B : l'app appelle la passerelle KiloCode avec la clé KiloCode de l'appareil.
// Même mécanisme de stockage local que la clé Gemini.

const KILOCODE_KEY_STORAGE = 'kilocode_api_key';

/** Récupère la clé API KiloCode depuis le stockage local de l'appareil. */
export const getKilocodeApiKey = async (): Promise<string | null> => {
  return getSetting(KILOCODE_KEY_STORAGE);
};

/** Sauvegarde la clé API KiloCode dans le stockage local de l'appareil. */
export const saveKilocodeApiKey = async (key: string): Promise<void> => {
  await setSetting(KILOCODE_KEY_STORAGE, key);
};

// ============== URL SERVEUR ==============

export const getPocketBaseUrlFromService = getPocketBaseUrl;
