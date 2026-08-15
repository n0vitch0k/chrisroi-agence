/// <reference path="../pb_data/types.d.ts" />
// PB v0.23+ ne supporte pas removeCollection dans les migrations.
// La collection demandes_recrutement est conservée dans la DB mais plus utilisée.
migrate((app) => {
  // Ne rien faire — conservation de l'historique
}, (app) => {
  // Rollback : ne rien faire
});
