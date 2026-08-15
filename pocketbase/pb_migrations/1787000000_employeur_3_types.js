/// <reference path="../pb_data/types.d.ts" />
// Refonte des types d'employeur : 3 types (particulier, entreprise, commerce).
// - retire "organisation" des valeurs de type_besoin
// - ajoute fonction_contact (optionnel, pour entreprise)
// Idempotent : on cherche les champs par nom, pas par id hardcodé.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("employeurs");
  if (!collection) return;

  // type_besoin : ne garder que les 3 types
  const typeField = collection.fields.getByName("type_besoin");
  if (typeField && Array.isArray(typeField.values)) {
    typeField.values = ["particulier", "entreprise", "commerce"];
  }

  // fonction_contact (optionnel)
  if (!collection.fields.getByName("fonction_contact")) {
    collection.fields.add(new Field({
      name: "fonction_contact",
      type: "text",
      required: false,
      max: 100,
    }));
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("employeurs");
  if (!collection) return;

  // rollback : restaurer organisation + retirer fonction_contact
  const typeField = collection.fields.getByName("type_besoin");
  if (typeField && Array.isArray(typeField.values)) {
    typeField.values = ["particulier", "entreprise", "commerce", "organisation"];
  }

  const fc = collection.fields.getByName("fonction_contact");
  if (fc) {
    collection.fields.removeById(fc.id);
  }

  return app.save(collection);
});
