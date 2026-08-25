/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3332084752")
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false, "id": "relation_contrat_doc", "name": "contrat_id",
    "presentable": false, "required": false, "system": false, "type": "relation",
    "collectionId": "pbc_841376117", "cascadeDelete": false, "maxSelect": 1, "minSelect": 0
  }))
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3332084752")
  try { collection.fields.removeById("relation_contrat_doc") } catch(e) {}
  return app.save(collection)
})
