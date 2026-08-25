/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_841376117")
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false, "id": "text_client_domicile", "max": 500, "min": 0, "name": "client_domicile",
    "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false, "id": "text_client_piece_num", "max": 100, "min": 0, "name": "client_piece_numero",
    "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false, "id": "date_client_piece", "max": "", "min": "", "name": "client_piece_date",
    "presentable": false, "required": false, "system": false, "type": "date"
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "help": "", "hidden": false, "id": "number_employe_age", "max": null, "min": 0, "name": "employe_age",
    "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number"
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "help": "", "hidden": false, "id": "select_employe_sexe", "maxSelect": 1, "name": "employe_sexe",
    "presentable": false, "required": false, "system": false, "type": "select", "values": ["Masculin", "Féminin"]
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false, "id": "text_employe_adr", "max": 500, "min": 0, "name": "employe_adresse_actuelle",
    "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false, "id": "text_employe_piece", "max": 100, "min": 0, "name": "employe_piece_reference",
    "pattern": "", "presentable": false, "primaryKey": false, "required": false, "system": false, "type": "text"
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "help": "", "hidden": false, "id": "number_retenue", "max": null, "min": 0, "name": "retenue_salaire_montant",
    "onlyInt": true, "presentable": false, "required": false, "system": false, "type": "number"
  }))
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false, "id": "date_signature", "max": "", "min": "", "name": "date_signature",
    "presentable": false, "required": false, "system": false, "type": "date"
  }))
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_841376117")
  try { collection.fields.removeById("date_signature") } catch(e) {}
  try { collection.fields.removeById("number_retenue") } catch(e) {}
  try { collection.fields.removeById("text_employe_piece") } catch(e) {}
  try { collection.fields.removeById("text_employe_adr") } catch(e) {}
  try { collection.fields.removeById("select_employe_sexe") } catch(e) {}
  try { collection.fields.removeById("number_employe_age") } catch(e) {}
  try { collection.fields.removeById("date_client_piece") } catch(e) {}
  try { collection.fields.removeById("text_client_piece_num") } catch(e) {}
  try { collection.fields.removeById("text_client_domicile") } catch(e) {}
  return app.save(collection)
})
