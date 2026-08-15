/// <reference path="../pb_data/types.d.ts" />
// Verrouille les règles d'accès des collections métier.
// Avant: listRule='' (string vide) = accès public total (CVE-2026-XXXX).
// Après: requiert une authentification valide (user) pour lire/écrire,
//        et admin (superuser) pour supprimer.
migrate((app) => {
  // Toutes les collections métier (sauf users qui a déjà ses propres règles)
  const collections = [
    'employes',
    'employeurs',
    'contrats',
    'alertes',
    'demandes_recrutement',
    'parents',
    'personnes_urgence',
    'experiences_pro',
  ];

  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) {
      console.warn(`[lock_collections] collection "${name}" introuvable, skip`);
      continue;
    }
    // Lecture / création / modification : requiert un user authentifié
    col.listRule   = "@request.auth.id != ''";
    col.viewRule   = "@request.auth.id != ''";
    col.createRule = "@request.auth.id != ''";
    col.updateRule = "@request.auth.id != ''";
    // Suppression : admin only (plus restrictif)
    col.deleteRule = null;
    app.save(col);
    console.log(`[lock_collections] ${name} verrouillé`);
  }
}, (app) => {
  // Rollback : remet les règles vides (état précédent, public)
  const collections = [
    'employes', 'employeurs', 'contrats', 'alertes',
    'demandes_recrutement', 'parents', 'personnes_urgence', 'experiences_pro',
  ];
  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) continue;
    col.listRule   = '';
    col.viewRule   = '';
    col.createRule = '';
    col.updateRule = '';
    col.deleteRule = '';
    app.save(col);
  }
});
