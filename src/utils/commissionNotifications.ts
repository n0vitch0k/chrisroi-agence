// ─── Rappels de commission — notifications locales ────────────────────────
// Le cahier avait déjà ce besoin, la commission en est le jumeau : trois
// notifications locales programmées à l'avance (J-7, J-3, J) pour chaque
// contrat qui a une commission à percevoir. Aucun serveur, aucun FCM, aucune
// clé push — c'est exactement le pattern de cahierNotifications.ts.
//
// L'échéance = date_debut + 1 mois (règle unique, getCommissionDueDate).
// On notifie à J-7, J-3 et le jour J. Chaque notification a son identifiant
// déterministe `commission_<contrat_id>_j7` (etc.), ce qui permet de les
// annuler/replanifier sans stocker d'id de notification en base.
//
// Le module expo-notifications est importé DYNAMIQUEMENT — si l'environnement
// ne l'a pas (Expo Go), l'appel retourne { ok: false } au lieu de faire
// planter l'écran qui crée le contrat.

import { getCommissionDueDate } from '../database/service';

export type CommissionRappelResultat = { ok: true } | { ok: false; raison: string };

type JourNotif = 'j7' | 'j3' | 'j0';

const prefixId = (contratId: string, jour: JourNotif) => `commission_${contratId}_${jour}`;

/** Heure de la notification locale : 09h00, comme le cahier. Assez tôt pour
 *  traiter avant la tournée, assez tard pour ne pas réveiller. */
const HEURE_RAPPEL = 9;

/** Décalage de repli si l'échéance est déjà passée (ou aujourd'hui) : on
 *  programme dans quelques minutes plutôt que de laisser une notif morte. */
const MINUTES_AVANT_POUR_TODAY = 2;

async function chargerModule(): Promise<any | null> {
  try {
    const mod: any = await import('expo-notifications');
    return mod?.default ?? mod;
  } catch (e) {
    console.warn('[commission] expo-notifications indisponible:', e);
    return null;
  }
}

export async function demanderPermissionCommission(): Promise<boolean> {
  const Notifications = await chargerModule();
  if (!Notifications?.requestPermissionsAsync) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    const ok = status === 'granted' || status === 'provisional';
    console.log('[commission] permission notifications =', status);
    return ok;
  } catch (e) {
    console.warn('[commission] permission notifications refusée:', e);
    return false;
  }
}

/** Calcule la date/heure de la notif pour un jour de relance (j7 = 7j avant, etc.) */
function momentNotification(dueStr: string, joursAvant: number): Date | null {
  const due = new Date(dueStr + 'T09:00:00');
  if (isNaN(due.getTime())) return null;
  const target = new Date(due.getTime() - joursAvant * 86400000);
  target.setHours(HEURE_RAPPEL, 0, 0, 0);

  // Si la date cible est déjà passée (ou aujourd'hui mais l'heure est passée),
  // on décale de 2 minutes plutôt que de laisser une notification morte.
  const now = new Date();
  const finJour = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59);
  if (target < now && due <= finJour) {
    return new Date(now.getTime() + MINUTES_AVANT_POUR_TODAY * 60000);
  }
  return target;
}

/** (Re)programme les 3 rappels de commission pour un contrat. Idempotent :
 *  annule les éventuels rappels précédents avant d'en créer de nouveaux (donc
 *  éditer la date_debut ou le salaire marche sans doublon). */
export async function planifierCommissionRappels(
  contratId: string,
  contrat: Record<string, any>,
  messageSuffix?: string,
): Promise<{ programmed: number; raison?: string }> {
  const Notifications = await chargerModule();
  if (!Notifications) return { programmed: 0, raison: 'module indisponible' };

  const dueStr = getCommissionDueDate(contrat);
  if (!dueStr) return { programmed: 0, raison: 'pas de date échéance' };

  const montant = Number(contrat.commission_agence || 0);
  const montantStr = montant > 0 ? ` (${montant.toLocaleString('fr-FR')} FCFA)` : '';
  const suffix = messageSuffix ? ` — ${messageSuffix}` : '';

  const dates: Array<[JourNotif, number, string]> = [
    ['j7', 7, `Commission à percevoir dans 7 jours${montantStr}`],
    ['j3', 3, `Commission à percevoir dans 3 jours${montantStr}`],
    ['j0', 0, `Commission due aujourd'hui${montantStr}`],
  ];

  let programmed = 0;
  let premiereRaison: string | undefined;

  try {
    for (const [jour, joursAvant, titre] of dates) {
      const identifiant = prefixId(contratId, jour);
      await Notifications.cancelScheduledNotificationAsync(identifiant).catch(() => {});

      const quand = momentNotification(dueStr, joursAvant);
      if (!quand) {
        if (!premiereRaison) premiereRaison = `date échéance invalide (${dueStr})`;
        continue;
      }

      Notifications.setNotificationHandler?.({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      await Notifications.scheduleNotificationAsync({
        identifier: identifiant,
        content: {
          title: titre,
          body: `Échéance le ${new Date(dueStr + 'T12:00:00').toLocaleDateString('fr-FR')}${suffix}`,
          data: { contratId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date',
          date: quand,
          channelId: 'commission-rappels',
        },
      });
      programmed++;
      console.log('[commission] rappel planifié', identifiant, quand.toISOString());
    }
  } catch (e: any) {
    console.warn('[commission] planification impossible:', e?.message || e);
    return { programmed, raison: e?.message || 'planification impossible' };
  }

  return { programmed, raison: premiereRaison };
}

/** Annule les 3 rappels de commission d'un contrat (commission payée, contrat
 *  supprimé, date vidée). */
export async function annulerCommissionRappels(contratId: string): Promise<void> {
  const Notifications = await chargerModule();
  if (!Notifications?.cancelScheduledNotificationAsync) return;
  try {
    await Promise.all(
      (['j7', 'j3', 'j0'] as JourNotif[]).map((jour) =>
        Notifications.cancelScheduledNotificationAsync(prefixId(contratId, jour)).catch(() => {}),
      ),
    );
    console.log('[commission] rappels annulés pour', contratId);
  } catch (e) {
    console.warn('[commission] annulation rappels impossible:', e);
  }
}
