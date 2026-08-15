/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3909458153")

  // --- Nouveau champ ethnie ---
  collection.fields.addAt(22, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3491602130",
    "max": 100,
    "min": 0,
    "name": "ethnie",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // --- Modification situation_matrimoniale : ajouter concubinage ---
  // On supprime l'ancien champ et on le recrée avec la nouvelle valeur
  collection.fields.removeById("select3885405013")
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "select3885405013",
    "maxSelect": 1,
    "name": "situation_matrimoniale",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "celibataire",
      "marie",
      "concubinage",
      "divorce",
      "veuf"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3909458153")

  // Remove ethnie
  collection.fields.removeById("text3491602130")

  // Restore old situation_matrimoniale (sans concubinage)
  collection.fields.removeById("select3885405013")
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "select3885405013",
    "maxSelect": 1,
    "name": "situation_matrimoniale",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "celibataire",
      "marie",
      "divorce",
      "veuf"
    ]
  }))

  return app.save(collection)
})
