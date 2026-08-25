/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3909458153")
  collection.fields.addAt(collection.fields.length, new Field({
    "help": "", "hidden": false, "id": "select_sexe_emp", "maxSelect": 1, "name": "sexe",
    "presentable": false, "required": false, "system": false, "type": "select", "values": ["Masculin", "Féminin"]
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false, "id": "text_piece_ref_emp", "max": 100, "min": 0, "name": "piece_reference",
    "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
  }))
  const collection2 = app.findCollectionByNameOrId("pbc_3761893225")
  collection2.fields.addAt(collection2.fields.length, new Field({
    "hidden": false, "id": "text_piece_num_er", "max": 100, "min": 0, "name": "piece_numero",
    "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
  }))
  collection2.fields.addAt(collection2.fields.length, new Field({
    "hidden": false, "id": "date_piece_er", "max": "", "min": "", "name": "piece_date",
    "presentable": false, "required": false, "system": false, "type": "date"
  }))
  app.save(collection2)
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3909458153")
  try { collection.fields.removeById("text_piece_ref_emp") } catch(e) {}
  try { collection.fields.removeById("select_sexe_emp") } catch(e) {}
  app.save(collection)
  const collection2 = app.findCollectionByNameOrId("pbc_3761893225")
  try { collection2.fields.removeById("date_piece_er") } catch(e) {}
  try { collection2.fields.removeById("text_piece_num_er") } catch(e) {}
  return app.save(collection2)
})
