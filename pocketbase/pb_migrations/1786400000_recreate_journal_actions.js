/// <reference path="../pb_data/types.d.ts" />
// Répare/crée la collection journal_actions.
// PB 0.39 n'ajoute PAS automatiquement les champs created/updated quand la
// collection est créée via migration JS (new Collection) — contrairement à
// l'API REST. Or l'absence de `created` provoquait "Invalid Date" à l'affichage
// et l'absence de user_display (user_id était en relation).
// Cette migration est idempotente :
//   - si la collection existe : on force user_id en text (si relation) et on
//     ajoute created/updated (autodate) s'ils manquent.
//   - si elle n'existe pas : on la crée AVEC created/updated déclarés.
migrate((app) => {
  const existing = app.findCollectionByNameOrId("journal_actions");

  if (existing) {
    let changed = false;

    // user_id doit être du text (pas relation)
    const f = existing.fields.getByName("user_id");
    if (f && f.type === "relation") {
      existing.fields.removeById(f.id);
      existing.fields.add(new Field({
        name: "user_id",
        type: "text",
        required: true,
        max: 50,
      }));
      changed = true;
    }

    // created / updated (autodate) doivent exister
    if (!existing.fields.getByName("created")) {
      existing.fields.add(new Field({
        name: "created",
        type: "autodate",
        required: true,
        system: true,
        onCreate: true,
        onUpdate: false,
      }));
      changed = true;
    }
    if (!existing.fields.getByName("updated")) {
      existing.fields.add(new Field({
        name: "updated",
        type: "autodate",
        required: true,
        system: true,
        onCreate: true,
        onUpdate: true,
      }));
      changed = true;
    }

    if (changed) {
      app.save(existing);
    }
    return;
  }

  // Création from scratch (avec created/updated déclarés explicitement)
  const collection = new Collection({
    name: "journal_actions",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "created", type: "autodate", required: true, system: true, onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", required: true, system: true, onCreate: true, onUpdate: true },
      { name: "user_id", type: "text", required: true, max: 50 },
      { name: "user_display", type: "text", required: true, max: 255 },
      { name: "action_type", type: "text", required: true, max: 50 },
      { name: "entite_type", type: "text", required: true, max: 50 },
      { name: "entite_id", type: "text", required: false, max: 50 },
      { name: "description", type: "text", required: true, max: 2000 },
      { name: "details", type: "text", required: false, max: 4000 },
    ],
    indexes: [
      "CREATE INDEX `idx_journal_user` ON `journal_actions` (`user_id`)",
      "CREATE INDEX `idx_journal_entite` ON `journal_actions` (`entite_type`, `entite_id`)",
    ],
  });

  app.save(collection);
}, (app) => {
  // Rollback : ne rien faire (collection conservée)
});
