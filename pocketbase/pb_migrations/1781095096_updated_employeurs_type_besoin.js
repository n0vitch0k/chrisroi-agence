/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3761893225")

  // update type_besoin select field to include "commerce"
  const typeBesoinField = collection.fields.getById("select2731508521")
  if (typeBesoinField) {
    typeBesoinField.values = ["particulier", "entreprise", "commerce", "organisation"]
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3761893225")

  // revert to original values
  const typeBesoinField = collection.fields.getById("select2731508521")
  if (typeBesoinField) {
    typeBesoinField.values = ["particulier", "entreprise", "organisation"]
  }

  return app.save(collection)
})
