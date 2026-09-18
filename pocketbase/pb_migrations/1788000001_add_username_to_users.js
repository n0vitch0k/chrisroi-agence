/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users")

  // add field : username (text, unique) — identifiant de connexion
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_username_001",
    "max": 50,
    "min": 3,
    "name": "username",
    "pattern": "^[a-zA-Z0-9._-]+$",
    "presentable": true,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("users")

  // remove field : username
  collection.fields.removeById("text_username_001")

  return app.save(collection)
})
