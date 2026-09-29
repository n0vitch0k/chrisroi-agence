// ─── Rappels du Cahier — notifications locales ──────────────────────────
// Le cahier est une feature d'AGENCE : un rappel doityenauer même sans réseau
// et sans compte push configuré. On utilise donc la notification LOCALE
// d'expo-notifications, qui ne demande ni serveur ni FCM.
//
// Deux protections, les deux indispensables :
// 1. import DYNAMIQUE — si le module est absent ou incompatible du runtime
//    (Expo Go), l'import échoue et on retourne `false` au lieu de faire
//    planter l'écran qui demande le rappel ;
// 2. identifiant DÉRMINISTE (`cahier_<id note>`) — on peut annuler le rappel
//    d'une note sans stocker d'id de notification en base.
//
// L'utilisateur reçoit DEUX signaux, comme demandé :
// - le badge (compteur de rappels dus) → purement visuel, toujours disponible ;
// - la notification locale à l'heure choisie → si le module répond.

export type RappelResultat = { ok: true } | { ok: false; raison: string };

const prefix = (noteId: string) => `cahier_${noteId}`;

/** Heure de la notification locale pour un jour donné. 09h00 par défaut :
 *  assez tôt pour traiter un rappel avant la tournée, assez tard pour waking up. */
const HEURE_RAPPEL = 9;
const MINUTES_AVANT_POUR_TODAY = 2;

function momentNotification(dayKey: string): Date | null {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const target = new Date(y, m - 1, d, HEURE_RAPPEL, 0, 0);
  // Un rappel « aujourd'hui » à 09h00 est déjà dépassé l'après-midi : on
  // décale de 2 minutes plutôt que de laisser une notification morte.
  if (dayKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`) {
    const soon = new Date(now.getTime() + MINUTES_AVANT_POUR_TODAY * 60000);
    return soon;
  }
  return target;
}

async function chargerModule(): Promise<any | null> {
  try {
    const mod: any = await import('expo-notifications');
    return mod?.default ?? mod;
  } catch (e) {
    console.warn('[cahier] expo-notifications indisponible:', e);
    return null;
  }
}

/** Demande la permission Android 13+ (POST_NOTIFICATIONS). Douce : appelée au
 *  premier rappel, jamais au démarrage. */
export async function demanderPermissionRappel(): Promise<boolean> {
  const Notifications = await chargerModule();
  if (!Notifications?.requestPermissionsAsync) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    const ok = status === 'granted' || status === 'provisional';
    console.log('[cahier] permission notifications =', status);
    return ok;
  } catch (e) {
    console.warn('[cahier] permission notifications refusée:', e);
    return false;
  }
}

/** (Re)programme le rappel d'une note. Idempotent : annule l'éventuel rappel
 *  précédent avant d'en créer un autre (donc éditer la date marche). */
export async function planifierRappel(
  noteId: string,
  dayKey: string,
  contenu: string,
): Promise<RappelResultat> {
  const Notifications = await chargerModule();
  if (!Notifications) return { ok: false, raison: 'module indisponible' };

  const quand = momentNotification(dayKey);
  if (!quand) return { ok: false, raison: 'date invalide' };

  try {
    const identifiant = prefix(noteId);
    await Notifications.cancelScheduledNotificationAsync(identifiant).catch(() => {});
    Notifications.setNotificationHandler?.({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
    });
    await Notifications.scheduleNotificationAsync({
      identifier: identifiant,
      content: {
        title: 'Rappel — cahier',
        body: (contenu || 'Note à rappeler').slice(0, 120),
        data: { noteId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date', date: quand, channelId: 'cahier-rappels' },
    });
    console.log('[cahier] rappel planifié', identifiant, quand.toISOString());
    return { ok: true };
  } catch (e: any) {
    console.warn('[cahier] planification impossible:', e?.message || e);
    return { ok: false, raison: e?.message || 'planification impossible' };
  }
}

/** Annule le rappel d'une note (à la suppression, ou quand la date est vidée). */
export async function annulerRappel(noteId: string): Promise<void> {
  const Notifications = await chargerModule();
  if (!Notifications?.cancelScheduledNotificationAsync) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(prefix(noteId));
  } catch (e) {
    console.warn('[cahier] annulation rappel impossible:', e);
  }
}
