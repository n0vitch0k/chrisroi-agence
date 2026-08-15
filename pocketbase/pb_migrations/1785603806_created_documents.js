/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_3909458153",
        "help": "",
        "hidden": false,
        "id": "rel_fc0447b9",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "employe_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "sel_5bdc8648",
        "maxSelect": 1,
        "name": "type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "carte_identite",
          "carte_identite_parent",
          "extrait_naissance",
          "permis_conduire",
          "passeport",
          "cv"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "fil_ab78b839",
        "maxSelect": 1,
        "maxSize": 10485760,
        "mimeTypes": [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf"
        ],
        "name": "image",
        "presentable": false,
        "protected": false,
        "required": true,
        "system": false,
        "thumbs": null,
        "type": "file"
      }
    ],
    "id": "pbc_3332084752",
    "indexes": [],
    "listRule": "",
    "name": "documents",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3332084752");

  return app.delete(collection);
})
