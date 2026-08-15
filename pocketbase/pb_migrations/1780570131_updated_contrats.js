/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_841376117")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "autodate2990389176",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": true,
    "type": "autodate"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "autodate3332085495",
    "name": "updated",
    "onCreate": true,
    "onUpdate": true,
    "presentable": false,
    "system": true,
    "type": "autodate"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4212981398",
    "max": 50,
    "min": 0,
    "name": "numero_dossier",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3909458153",
    "help": "",
    "hidden": false,
    "id": "relation28725906",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "employe_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3761893225",
    "help": "",
    "hidden": false,
    "id": "relation1568429036",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "employeur_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2162777624",
    "max": 100,
    "min": 0,
    "name": "demande_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "date1507040878",
    "max": "",
    "min": "",
    "name": "date_contrat",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2089357227",
    "max": 255,
    "min": 0,
    "name": "poste",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "select1209398886",
    "maxSelect": 1,
    "name": "type_contrat",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "heberge",
      "externe",
      "temps_partiel"
    ]
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "date1391193845",
    "max": "",
    "min": "",
    "name": "date_debut",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "date472036676",
    "max": "",
    "min": "",
    "name": "date_fin",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2220277813",
    "max": 50,
    "min": 0,
    "name": "duree",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "number1003207953",
    "max": null,
    "min": null,
    "name": "salaire",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "help": "",
    "hidden": false,
    "id": "number227088709",
    "max": null,
    "min": null,
    "name": "commission_agence",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "bool2354695373",
    "name": "commission_payee",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "number817306395",
    "max": null,
    "min": null,
    "name": "frais_dossier",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "help": "",
    "hidden": false,
    "id": "bool1968208579",
    "name": "frais_payes",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(18, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3848597695",
    "max": 50,
    "min": 0,
    "name": "statut",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(19, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3844667410",
    "max": 500,
    "min": 0,
    "name": "domicile_employe",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(20, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4076358721",
    "max": 500,
    "min": 0,
    "name": "signature_employe",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(21, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2565883175",
    "max": 500,
    "min": 0,
    "name": "signature_agence",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(22, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text999427675",
    "max": 500,
    "min": 0,
    "name": "signature_employeur",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(23, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text18589324",
    "max": 2000,
    "min": 0,
    "name": "notes",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_841376117")

  // remove field
  collection.fields.removeById("autodate2990389176")

  // remove field
  collection.fields.removeById("autodate3332085495")

  // remove field
  collection.fields.removeById("text4212981398")

  // remove field
  collection.fields.removeById("relation28725906")

  // remove field
  collection.fields.removeById("relation1568429036")

  // remove field
  collection.fields.removeById("text2162777624")

  // remove field
  collection.fields.removeById("date1507040878")

  // remove field
  collection.fields.removeById("text2089357227")

  // remove field
  collection.fields.removeById("select1209398886")

  // remove field
  collection.fields.removeById("date1391193845")

  // remove field
  collection.fields.removeById("date472036676")

  // remove field
  collection.fields.removeById("text2220277813")

  // remove field
  collection.fields.removeById("number1003207953")

  // remove field
  collection.fields.removeById("number227088709")

  // remove field
  collection.fields.removeById("bool2354695373")

  // remove field
  collection.fields.removeById("number817306395")

  // remove field
  collection.fields.removeById("bool1968208579")

  // remove field
  collection.fields.removeById("text3848597695")

  // remove field
  collection.fields.removeById("text3844667410")

  // remove field
  collection.fields.removeById("text4076358721")

  // remove field
  collection.fields.removeById("text2565883175")

  // remove field
  collection.fields.removeById("text999427675")

  // remove field
  collection.fields.removeById("text18589324")

  return app.save(collection)
})
