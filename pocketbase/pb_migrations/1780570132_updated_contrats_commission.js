/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_841376117")

  // commission_fixe — 15 000 FCFA par défaut, négociable
  collection.fields.addAt(24, new Field({
    "help": "Commission fixe agence (défaut 15000 FCFA)",
    "hidden": false,
    "id": "number907142090",
    "max": null,
    "min": 0,
    "name": "commission_fixe",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // frais_transport — 5 000 FCFA par défaut, négociable
  collection.fields.addAt(25, new Field({
    "help": "Frais de transport personnel (défaut 5000 FCFA)",
    "hidden": false,
    "id": "number596923523",
    "max": null,
    "min": 0,
    "name": "frais_transport",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_841376117")

  collection.fields.removeById("number907142090")
  collection.fields.removeById("number596923523")

  return app.save(collection)
})
