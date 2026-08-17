/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3909458153")

  // add field : sexe (select masculin / feminin)
  collection.fields.addAt(22, new Field({
    "hidden": false,
    "id": "select_sante_sexe_001",
    "maxSelect": 1,
    "name": "sexe",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "masculin",
      "feminin"
    ]
  }))

  // add field : allergie_sante (texte long)
  collection.fields.addAt(23, new Field({
    "autogeneratePattern": "",
    "help": "Allergie ou problèmes de santé de l'employé (pour la fiche papier)",
    "hidden": false,
    "id": "text_sante_allergie_001",
    "max": 2000,
    "min": 0,
    "name": "allergie_sante",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field : intervention_chirurgicale (texte long)
  collection.fields.addAt(24, new Field({
    "autogeneratePattern": "",
    "help": "Intervention(s) chirurgicale(s) déjà subie(s) (pour la fiche papier)",
    "hidden": false,
    "id": "text_sante_chirurgie_001",
    "max": 2000,
    "min": 0,
    "name": "intervention_chirurgicale",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3909458153")

  // remove field : sexe
  collection.fields.removeById("select_sante_sexe_001")

  // remove field : allergie_sante
  collection.fields.removeById("text_sante_allergie_001")

  // remove field : intervention_chirurgicale
  collection.fields.removeById("text_sante_chirurgie_001")

  return app.save(collection)
})
