/// <reference path="../pb_data/types.d.ts" />
// Fix 2026-08-20 : collection `scans` était vide (que `id`) — restauration schématique complète.
// Source : APP_FONCTIONNEMENT.md §4.6 + usage service.ts uploadScan/getScan.
migrate((app) => {
  let col = null;
  try { col = app.findCollectionByNameOrId("pbc_3789704380"); } catch {}
  if (!col) try { col = app.findCollectionByNameOrId("scans"); } catch {}
  if (!col) return;
  const hasByName = (n) => { try { return !!col.fields.getByName(n); } catch { return false; } };
  // created / updated si absents
  if (!hasByName("created")) col.fields.add(new Field({ hidden: false, id: "autodate2990389176", name: "created", onCreate: true, onUpdate: false, presentable: false, system: true, type: "autodate" }));
  if (!hasByName("updated")) col.fields.add(new Field({ hidden: false, id: "autodate3332085495", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: true, type: "autodate" }));
  if (!hasByName("document_type")) col.fields.add(new Field({ autogeneratePattern: "", help: "", hidden: false, id: "text_document_type", max: 32, min: 0, name: "document_type", pattern: "", presentable: false, primaryKey: false, required: false, system: false, type: "text" }));
  if (!hasByName("document_id")) col.fields.add(new Field({ autogeneratePattern: "", help: "", hidden: false, id: "text_document_id", max: 32, min: 0, name: "document_id", pattern: "", presentable: false, primaryKey: false, required: false, system: false, type: "text" }));
  if (!hasByName("image")) col.fields.add(new Field({ help: "", hidden: false, id: "file_scans_image", maxSelect: 1, maxSize: 10485760, mimeTypes: ["image/jpeg","image/png","image/webp","image/jpg"], name: "image", presentable: false, protected: false, required: false, system: false, thumbs: null, type: "file" }));
  col.listRule = '@request.auth.id != ""';
  col.viewRule = '@request.auth.id != ""';
  col.createRule = '@request.auth.id != ""';
  col.updateRule = '@request.auth.id != ""';
  col.deleteRule = '@request.auth.id != ""';
  return app.save(col);
}, (app) => {
  let col = null;
  try { col = app.findCollectionByNameOrId("pbc_3789704380"); } catch {}
  if (!col) try { col = app.findCollectionByNameOrId("scans"); } catch {}
  if (!col) return;
  return app.save(col);
});
