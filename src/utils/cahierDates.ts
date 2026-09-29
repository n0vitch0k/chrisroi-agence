// ─── Dates du Cahier (notes d'appels) ─────────────────────────────
// Règle : tout ce qui relie une date saisie par l'utilisateur à une date
// stockée par PocketBase se fait sur une CLÉ LOCALE « yyyy-mm-dd », jamais
// via toISOString().
//
// Pourquoi : toISOString() convertit en UTC. Sur le fuseau du marché
// (Africa/Abidjan UTC+0, mais tout utilisateur hors UTC est concerné), une
// note écrite à 00h15 est datée de la VEILLE. Le symptôme est invisible en dev
// sur une machine en UTC : il n'apparaît que sur le téléphone.

/** Clé locale « yyyy-mm-dd » — le format exact d'un <input type="date">. */
export const localDayKey = (d: Date | string | null | undefined): string => {
  const x = d ? new Date(d) : new Date();
  if (isNaN(x.getTime())) return '';
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
};

/** Décale une clé « yyyy-mm-dd » de N jours (delta négatif = passé). */
export const shiftDayKey = (key: string, delta: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return localDayKey(dt);
};

/** Plage locale d'un jour → format PocketBase (« yyyy-MM-dd HH:mm:ss », ESPACE).
 *  toISOString() (« T », millis, Z) fait échouer la comparaison texte de PB
 *  (l'espace < 'T' → tout est exclu) — même piège que JournalScreen. */
export const pbDateTime = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Bornes du jour (00:00:00 → jour suivant 00:00:00, exclusif). */
export const dayRange = (key: string): { dateDebut: string; dateFin: string } => {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) {
    const now = new Date();
    return { dateDebut: pbDateTime(now), dateFin: pbDateTime(now) };
  }
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0);
  return { dateDebut: pbDateTime(start), dateFin: pbDateTime(end) };
};

/** Plage des N derniers jours (bornée au jour courant inclus). */
export const recentRange = (days: number): { dateDebut: string; dateFin: string } => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return { dateDebut: pbDateTime(start), dateFin: pbDateTime(end) };
};

/** Libellé lisible d'une clé de jour. */
export const dayLabel = (key: string): string => {
  const today = localDayKey(new Date());
  if (key === today) return "Aujourd'hui";
  if (key === shiftDayKey(today, -1)) return 'Hier';
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
};

/** Écart humain court (« il y a 3 h », « Hier »…). null si date illisible. */
export const formatRelative = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

/** Horodatage complet pour la fiche détaillée. */
export const formatAbsolute = (value: string | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** État d'un rappel : 'retard' (date dépassée), 'aujourdhui', 'futur', null. */
export const rappelState = (rappel: string | null | undefined): 'retard' | 'aujourdhui' | 'futur' | null => {
  if (!rappel) return null;
  // On compare en clé locale : « demain » n'est jamais « aujourd'hui » parce
  // qu'on a basculé en UTC, et « aujourd'hui » ne saute pas au lendemain.
  const key = rappel.length === 10 ? rappel : localDayKey(rappel);
  if (!key) return null;
  const today = localDayKey(new Date());
  if (key < today) return 'retard';
  if (key === today) return 'aujourdhui';
  return 'futur';
};
