export type QueryRow = Record<string, any>;

const STORE_KEY = 'chrisroi_db_v1';

const store: Record<string, QueryRow[]> = {};

function saveToStorage() {
  try {
    const data: Record<string, QueryRow[]> = {};
    for (const [key, rows] of Object.entries(store)) {
      if (rows.length > 0) data[key] = rows;
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage peut être plein ou désactivé
    console.warn('[browserDb] save failed:', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      for (const [key, rows] of Object.entries(data)) {
        if (Array.isArray(rows)) {
          store[key] = rows;
        }
      }
    }
  } catch (e) {
    // Données corrompues ou localStorage vide — on ignore
  }
}

function ensure(name: string): QueryRow[] {
  if (!store[name]) store[name] = [];
  return store[name];
}

export const browserDb = {
  open: async () => {},
  execAsync: async (_sql: string) => {
    // Charger les données persistées au démarrage
    loadFromStorage();
  },
  runAsync: async (sql: string, params: any[] = []) => {
    const s = sql.trim().toLowerCase();
    if (s.startsWith('insert into')) {
      const table = s.split('into')[1]?.split('(')[0]?.trim();
      if (!table) return;
      const row: QueryRow = {};
      const cols = s.substring(s.indexOf('(') + 1, s.indexOf(')')).split(',').map((c: string) => c.trim());
      cols.forEach((c: string, i: number) => (row[c] = params[i]));
      ensure(table).push(row);
      saveToStorage();
      return;
    }
    if (s.startsWith('update')) {
      const table = s.split('update')[1]?.split('set')[0]?.trim();
      if (!table) return;
      const rows = ensure(table);
      if (params.length) {
        const id = params[params.length - 1];
        const idx = rows.findIndex((r) => r.id === id);
        if (idx >= 0) Object.assign(rows[idx], { ...params });
      }
      saveToStorage();
      return;
    }
    if (s.startsWith('delete')) {
      const table = s.split('from')[1]?.split('where')[0]?.trim();
      if (!table) return;
      const rows = ensure(table);
      if (params.length) {
        const idx = rows.findIndex((r) => r.id === params[0]);
        if (idx >= 0) rows.splice(idx, 1);
      } else {
        store[table] = [];
      }
      saveToStorage();
      return;
    }
  },
  getFirstAsync: async (sql: string, params: any[] = []) => {
    const all = await browserDb.getAllAsync(sql, params);
    return all.length > 0 ? all[0] : null;
  },
  _getTable: (s: string): string => {
    // Match table name after FROM (works for both simple and JOIN queries)
    const fromMatch = s.match(/\bfrom\s+(\w+)\b/);
    const table = fromMatch ? fromMatch[1] : '';
    return table === 'utilisateurs' ? 'utilisateurs' :
      table === 'employes' ? 'employes' :
      table === 'parents' ? 'parents' :
      table === 'personnes_urgence' ? 'personnes_urgence' :
      table === 'experiences_pro' ? 'experiences_pro' :
      table === 'employeurs' ? 'employeurs' :
      table === 'demandes_recrutement' ? 'demandes_recrutement' :
      table === 'contrats' ? 'contrats' :
      table === 'alertes' ? 'alertes' : '';
  },
  _parseSelectAliases: (sql: string): Record<string, string> => {
    // Parse SQL aliases like "e.nom as employe_nom, e.prenom as employe_prenom, emp.nom_complet"
    // Returns map: { 'e_nom': 'employe_nom', 'e_prenom': 'employe_prenom', ... }
    const aliases: Record<string, string> = {};
    const s = sql.toLowerCase();
    // Match patterns like: alias.colname as newname
    const regex = /(\w+)\.(\w+)\s+as\s+(\w+)/gi;
    let match;
    while ((match = regex.exec(s)) !== null) {
      const tableAlias = match[1];
      const colName = match[2];
      const asName = match[3];
      const key = tableAlias + '_' + colName;
      aliases[key] = asName;
    }
    return aliases;
  },
  _resolveJoins: (rows: any[], sql: string): any[] => {
    // Handle JOINs: enrich rows with columns from joined tables
    // Supports multiple JOINs
    const s = sql.toLowerCase();
    const joinRegex = /join\s+(\w+)\s+(\w+)\s+on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi;
    const aliases = browserDb._parseSelectAliases(sql);
    let match;
    let result = rows;
    while ((match = joinRegex.exec(s)) !== null) {
      const joinTable = match[1];
      const joinAlias = match[2];
      const leftKey = match[4];
      const rightKey = match[6];
      const joinRows = ensure(joinTable);
      result = result.map(r => {
        const joined = joinRows.find(j => j[rightKey] === r[leftKey]);
        if (joined) {
          // Copy all columns from joined row
          Object.keys(joined).forEach(k => {
            const rawKey = joinAlias + '_' + k;
            // Use SQL alias if defined, otherwise use the raw prefixed key
            const targetKey = aliases[rawKey] || rawKey;
            r[targetKey] = joined[k];
          });
        }
        return r;
      });
    }
    return result;
  },
  getAllAsync: async (sql: string, params: any[] = []): Promise<any[]> => {
    const s = sql.toLowerCase();
    const hasJoin = s.includes(' join ');

    if (hasJoin) {
      // For JOIN queries: extract the main table, get its rows, then resolve joins
      const mainTable = browserDb._getTable(s);
      let rows = ensure(mainTable);
      rows = browserDb._resolveJoins(rows, sql);

      // Apply simple WHERE filter
      if (s.includes(' where ') && params.length) {
        if (s.includes('employe_id =')) rows = rows.filter((r) => r.employe_id === params[0]);
        if (s.includes('employeur_id =')) rows = rows.filter((r) => r.employeur_id === params[0]);
        if (s.includes('statut =')) rows = rows.filter((r) => String(r.statut) === String(params[0]));
        if (s.includes('commission_payee =')) rows = rows.filter((r) => Number(r.commission_payee) === Number(params[0]));
        if (s.includes('lu =')) rows = rows.filter((r) => Number(r.lu) === Number(params[0]));
      }

      // Handle date comparisons for fin_contrat proche
      if (s.includes('date_fin') && s.includes('date(')) {
        const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        rows = rows.filter(r => r.date_fin && r.date_fin.split('T')[0] <= in7days);
      }

      // Handle commission queries (WHERE commission_payee = 0 AND commission_agence > 0)
      if (s.includes('commission_payee') && s.includes('commission_agence')) {
        rows = rows.filter(r => Number(r.commission_payee) === 0 && Number(r.commission_agence) > 0);
      }

      return rows;
    }

    // Simple (no JOIN) queries
    const table = browserDb._getTable(s);
    let rows = ensure(table);

    if (s.includes('select count(*)')) return [{ count: rows.length }];
    if (!s.startsWith('select')) return [];

    if (s.includes(' where ') && params.length) {
      if (s.includes('email =') && s.includes('mot_de_passe =')) {
        return rows.filter((r) => r.email === params[0] && r.mot_de_passe === params[1] && (r.actif === 1 || r.actif === true));
      }
      if (s.includes('email =')) return rows.filter((r) => r.email === params[0]);
      if (s.includes('role =')) return rows.filter((r) => r.role === params[0]);
      if (s.includes('employe_id =')) return rows.filter((r) => r.employe_id === params[0]);
      if (s.includes('employeur_id =')) return rows.filter((r) => r.employeur_id === params[0]);
      if (s.includes('statut =')) return rows.filter((r) => String(r.statut) === String(params[0]));
      if (s.includes('categorie_emploi =')) return rows.filter((r) => r.categorie_emploi === params[0]);
      if (s.includes('lu =')) return rows.filter((r) => Number(r.lu) === Number(params[0]));
      if (s.includes('actif =')) return rows.filter((r) => Number(r.actif) === Number(params[0]));
    }
    return rows.slice();
  },
} as const;
