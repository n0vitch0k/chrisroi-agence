/// <reference path="../pb_data/types.d.ts" />
// Documents : permettre de lier un document à un employeur (en plus des employés).
// - ajoute le champ employeur_id (relation optionnelle vers employeurs)
// - ajoute les types métier employeur au select `type`
// Idempotent : on cherche les champs par nom.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("documents");
  if (!collection) return;

  // employeur_id (relation optionnelle)
  if (!collection.fields.getByName("employeur_id")) {
    collection.fields.add(new Field({
      name: "employeur_id",
      type: "relation",
      required: false,
      maxSelect: 1,
      collectionId: "pbc_3761893225", // collection employeurs
      cascadeDelete: true,
    }));
  }

  // employe_id doit devenir optionnel (un document est lié à un employé OU un employeur)
  const empField = collection.fields.getByName("employe_id");
  if (empField && empField.required) {
    empField.required = false;
  }

  // types : ajouter les types employeur si absents
  const typeField = collection.fields.getByName("type");
  if (typeField && Array.isArray(typeField.values)) {
    const addTypes = ["registre_commerce", "licence_commerciale", "autre"];
    const merged = Array.from(new Set(typeField.values.concat(addTypes)));
    typeField.values = merged;
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("documents");
  if (!collection) return;

  // rollback : retirer employeur_id + les types employeur (employe_id reste optionnel, c'est OK)
  const empField = collection.fields.getByName("employeur_id");
  if (empField) {
    collection.fields.removeById(empField.id);
  }

  const typeField = collection.fields.getByName("type");
  if (typeField && Array.isArray(typeField.values)) {
    const removeTypes = ["registre_commerce", "licence_commerciale", "autre"];
    typeField.values = typeField.values.filter(function (v) { return removeTypes.indexOf(v) === -1; });
  }

  return app.save(collection);
});
