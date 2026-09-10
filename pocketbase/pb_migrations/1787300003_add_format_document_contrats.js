/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_841376117")
  collection.fields.addAt(collection.fields.length, new Field({
    "help": "Format du document : prestation (10 articles) ou agence (recto-verso). Définitif à la création.",
    "hidden": false, "id": "select_format_document", "maxSelect": 1, "name": "format_document",
    "presentable": false, "required": false, "system": false, "type": "select",
    "values": ["prestation", "agence"]
  }))
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_841376117")
  try { collection.fields.removeById("select_format_document") } catch(e) {}
  return app.save(collection)
})
