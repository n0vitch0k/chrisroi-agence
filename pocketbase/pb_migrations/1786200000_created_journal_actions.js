/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: "journal_actions",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "user_id",
        type: "relation",
        required: true,
        collectionId: "_pb_users_auth_",
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
      },
      {
        name: "user_display",
        type: "text",
        required: true,
        max: 255,
      },
      {
        name: "action_type",
        type: "text",
        required: true,
        max: 50,
      },
      {
        name: "entite_type",
        type: "text",
        required: true,
        max: 50,
      },
      {
        name: "entite_id",
        type: "text",
        required: false,
        max: 50,
      },
      {
        name: "description",
        type: "text",
        required: true,
        max: 2000,
      },
      {
        name: "details",
        type: "text",
        required: false,
        max: 4000,
      },
    ],
    indexes: [
      "CREATE INDEX `idx_journal_user` ON `journal_actions` (`user_id`)",
      "CREATE INDEX `idx_journal_entite` ON `journal_actions` (`entite_type`, `entite_id`)",
    ],
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("journal_actions");
  if (collection) {
    app.removeCollection(collection);
  }
});
