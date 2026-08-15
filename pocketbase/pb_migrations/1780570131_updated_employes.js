/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3909458153")

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
    "id": "text1819170229",
    "max": 255,
    "min": 0,
    "name": "nom",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2787480667",
    "max": 255,
    "min": 0,
    "name": "prenom",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "help": "",
    "hidden": false,
    "id": "date1642709770",
    "max": "",
    "min": "",
    "name": "date_inscription",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3467569840",
    "max": 100,
    "min": 0,
    "name": "date_naissance",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2663334579",
    "max": 255,
    "min": 0,
    "name": "lieu_naissance",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1158672400",
    "max": 50,
    "min": 0,
    "name": "telephone",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1816183700",
    "max": 255,
    "min": 0,
    "name": "lieu_residence",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2663700287",
    "max": 100,
    "min": 0,
    "name": "nationalite",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
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

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text274068729",
    "max": 100,
    "min": 0,
    "name": "religion",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4172897090",
    "max": 100,
    "min": 0,
    "name": "niveau_etude",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "help": "",
    "hidden": false,
    "id": "bool3635396914",
    "name": "a_deja_travaille",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text923656216",
    "max": 2000,
    "min": 0,
    "name": "experience_details",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1645549167",
    "max": 1000,
    "min": 0,
    "name": "stages_effectues",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1083187511",
    "max": 1000,
    "min": 0,
    "name": "formations",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(18, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3764417517",
    "max": 2000,
    "min": 0,
    "name": "motivation",
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
    "id": "text4068874947",
    "max": 100,
    "min": 0,
    "name": "categorie_emploi",
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
    "id": "text196643061",
    "max": 500,
    "min": 0,
    "name": "photo_uri",
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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3909458153")

  // remove field
  collection.fields.removeById("autodate2990389176")

  // remove field
  collection.fields.removeById("autodate3332085495")

  // remove field
  collection.fields.removeById("text1819170229")

  // remove field
  collection.fields.removeById("text2787480667")

  // remove field
  collection.fields.removeById("date1642709770")

  // remove field
  collection.fields.removeById("text3467569840")

  // remove field
  collection.fields.removeById("text2663334579")

  // remove field
  collection.fields.removeById("text1158672400")

  // remove field
  collection.fields.removeById("text1816183700")

  // remove field
  collection.fields.removeById("text2663700287")

  // remove field
  collection.fields.removeById("select3885405013")

  // remove field
  collection.fields.removeById("text274068729")

  // remove field
  collection.fields.removeById("text4172897090")

  // remove field
  collection.fields.removeById("bool3635396914")

  // remove field
  collection.fields.removeById("text923656216")

  // remove field
  collection.fields.removeById("text1645549167")

  // remove field
  collection.fields.removeById("text1083187511")

  // remove field
  collection.fields.removeById("text3764417517")

  // remove field
  collection.fields.removeById("text4068874947")

  // remove field
  collection.fields.removeById("text196643061")

  // remove field
  collection.fields.removeById("text3848597695")

  return app.save(collection)
})
