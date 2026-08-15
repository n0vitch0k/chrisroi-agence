/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Rendre toutes les collections accessibles aux utilisateurs authentifiés
  // @request.auth.id != ""  =>  tout utilisateur connecté peut lire/écrire
  const rule = "@request.auth.id != ''";
  const collections = [
    "employes",
    "employeurs",
    "parents",
    "personnes_urgence",
    "experiences_pro",
    "demandes_recrutement",
    "contrats",
    "alertes"
  ];

  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) {
      console.warn(`[migration] Collection "${name}" introuvable, ignorée`);
      continue;
    }
    col.listRule = rule;
    col.viewRule = rule;
    col.createRule = rule;
    col.updateRule = rule;
    col.deleteRule = rule;
    app.save(col);
  }

  console.log("[migration] ✅ Règles API appliquées sur " + collections.length + " collections");
}, (app) => {
  // Rollback : remettre les règles à null
  const collections = [
    "employes",
    "employeurs",
    "parents",
    "personnes_urgence",
    "experiences_pro",
    "demandes_recrutement",
    "contrats",
    "alertes"
  ];

  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) continue;
    col.listRule = null;
    col.viewRule = null;
    col.createRule = null;
    col.updateRule = null;
    col.deleteRule = null;
    app.save(col);
  }
});
