/// <reference path="../pb_data/types.d.ts" />
// Fix 2026-08-20 : documents.file mimes explicites (PB 0.39 n'accepte pas image/* seul)
// + restaure le champ `type` si absent (cassé par migration 1787151963) + règles auth.
migrate((app) => {
  const col = app.findCollectionByNameOrId("pbc_3332084752") || app.findCollectionByNameOrId("documents");
  if (!col) return;
  // type (select) requis — si supprimé, on le recrée
  let typeField = col.fields.getByName("type");
  if (!typeField) {
    col.fields.addAt(3, new Field({
      hidden: false, id: "sel_5bdc8648", maxSelect: 1, name: "type", presentable: false,
      required: true, system: false, type: "select",
      values: ["carte_identite","carte_identite_parent","extrait_naissance","permis_conduire","passeport","cv","registre_commerce","licence_commerciale","autre"]
    }));
  } else {
    // s'assurer que les valeurs employeur sont présentes
    const need = ["registre_commerce","licence_commerciale","autre"];
    for (const v of need) if (typeField.values.indexOf(v) === -1) typeField.values.push(v);
  }
  // file : mimes explicites (image/* seul est rejeté par PB 0.39 pour image/jpeg)
  let fileField = col.fields.getByName("file");
  if (!fileField) {
    col.fields.add(new Field({
      hidden: false, id: "file2359244304", maxSelect: 1, maxSize: 10485760,
      mimeTypes: ["image/jpeg","image/png","image/webp","image/jpg","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      name: "file", presentable: false, protected: false, required: false, system: false, thumbs: null, type: "file"
    }));
  } else {
    fileField.mimeTypes = ["image/jpeg","image/png","image/webp","image/jpg","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    fileField.maxSize = 10485760;
  }
  // employeur_id + employe_id optionnels (un doc = employé OU employeur)
  const empIdField = col.fields.getByName("employe_id");
  if (empIdField) empIdField.required = false;
  // règles
  col.listRule = '@request.auth.id != ""';
  col.viewRule = '@request.auth.id != ""';
  col.createRule = '@request.auth.id != ""';
  col.updateRule = '@request.auth.id != ""';
  col.deleteRule = '@request.auth.id != ""';
  return app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("pbc_3332084752") || app.findCollectionByNameOrId("documents");
  if (!col) return;
  return app.save(col);
});
