/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3761893225")
  collection.fields.addAt(collection.fields.length, new Field({
    "help": "Salaire mensuel proposé par l'employeur (pré-remplit le contrat).",
    "hidden": false, "id": "number_salaire_propose", "max": null, "min": 0, "name": "salaire_propose",
    "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number"
  }))
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3761893225")
  try { collection.fields.removeById("number_salaire_propose") } catch(e) {}
  return app.save(collection)
})
