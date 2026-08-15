# Audit Complet — ChrisRoi Agence

Date: 12 juin 2026
Périmètre: code source (TypeScript/React Native), PocketBase (schéma + règles + données), runtime web (build dist/)
Build audité: dist/ (export web du 11 juin 2026)

═══════════════════════════════════════════════════════════════
RÉSUMÉ EXÉCUTIF
═══════════════════════════════════════════════════════════════

Total problèmes identifiés: 24
  P0 (Critique - bloque production): 3
  P1 (Haute - à corriger rapidement): 8
  P2 (Moyenne - qualité): 9
  P3 (Basse - nice to have): 4

Verdict global: NE PAS DÉPLOYER EN PRODUCTION EN L'ÉTAT.
La faille de sécurité P0 #1 seule justifie ce blocage.

Tests runtime:
  Login:        OK (admin@chrisroi.com / chrisroi2024)
  Dashboard:    OK (calendrier Juin 2026, 4 stats cards, alertes)
  Liste Employés: OK (15 employés affichés)
  Console JS:   0 erreur, 0 warning
  Navigation:   OK entre les 4 tabs

═══════════════════════════════════════════════════════════════
P0 - CRITIQUES (à corriger AVANT tout déploiement)
═══════════════════════════════════════════════════════════════

P0-1 [SECURITE] Toutes les collections métier PocketBase en accès PUBLIC
──────────────────────────────────────────────────────────────────────
Fichier: pocketbase/pb_data/data.db (table _collections)
Sévérité: CRITIQUE
CWE-284: Improper Access Control

État: 8/9 collections ont listRule='', viewRule='', createRule='',
updateRule='', deleteRule='', deleteRule='' (string VIDE, pas null).
Selon la doc PocketBase, une règle vide = true = accès public.

Preuve (test live, sans authentification):
  GET /api/collections/employes/records     → HTTP 200, 15 employés
  GET /api/collections/parents/records     → HTTP 200, 4 parents avec tel/domicile
  GET /api/collections/employeurs/records   → HTTP 200
  POST /api/collections/employes/records   → HTTP 200, injection réussie

Collections concernées: alertes, contrats, demandes_recrutement,
employes, employeurs, experiences_pro, parents, personnes_urgence

Impact:
  • Tout acteur connaissant http://IP:8090 peut lire les données
    personnelles des employés (téléphone, adresse, parents, urgences).
  • Tout acteur peut injecter de faux employés.
  • Un script kiddie peut wipe toute la base en boucle.

Fix immédiat (P0 - faire MAINTENANT):
  1. Backup: cp -r pocketbase/pb_data pocketbase/pb_data.bak.$(date +%Y%m%d)
  2. Ouvrir l'admin UI: http://127.0.0.1:8090/_/
  3. Pour chaque collection, mettre:
       listRule / viewRule:  null  (admin only)
       createRule / updateRule / deleteRule:  null
  4. NE PAS laisser les règles ''.

Fix migration (reproductible, à committer):
  // pocketbase/pb_migrations/<TS>_lock_collections.js
  const cols = app.findCollectionByNameOrId("pbc_XXX"); // pour chaque
  cols.listRule = null;
  cols.viewRule = null;
  cols.createRule = null;
  cols.updateRule = null;
  cols.deleteRule = null;
  app.save(cols);

Note: pour permettre l'usage réel, créer un user "agent" avec token
durable, et ajouter aux rules: "@request.auth.id != ''".

──────────────────────────────────────────────────────────────────────
P0-2 [BUILD] Incohérence binaire PocketBase vs SDK JS
──────────────────────────────────────────────────────────────────────
Binaire: pocketbase v0.39.0
SDK JS:  pocketbase 0.27.0  (package.json + node_modules)

Fichiers concernés:
  - package.json ligne 32: "pocketbase": "^0.27.0"
  - pocketbase/pocketbase.exe (binaire)
  - src/database/pocketbase.ts

Risque: bug d'auth aléatoire. La skill `dogfood` documente précisément
ce cas: un SDK v0.27 contre serveur v0.39 marche pour l'auth `_superusers`
mais peut casser sur d'autres endpoints (auth de records, fichiers, etc.).

Aujourd'hui: ça marche (curl auth `_superusers` → 200 avec token).
Mais c'est de la chance, pas de la conception.

Fix: aligner.
  Option A (recommandée): upgrade SDK vers 0.21+ récent (~0.21.0+ pour
                           compat serveur v0.23+).
  Option B: garder SDK 0.27 et downgrader binaire vers 0.27.

──────────────────────────────────────────────────────────────────────
P0-3 [ARCHITECTURE] Pas de gestion d'erreur centralisée ni de
        transaction pour les opérations multi-étapes
──────────────────────────────────────────────────────────────────────
Fichier: src/database/service.ts
Fonctions concernées:
  - createEmploye (ligne 167-213):
      Crée l'employé, puis itère séquentiellement sur parents/
      personnes_urgence/experiences (3 boucles for...of avec await).
      Si l'étape 4 sur 7 plante, l'employé existe en BD SANS ses
      relations. Pas de rollback.
  - createContrat (ligne 457-510):
      Génère numéro, calcule commission, crée contrat, update statut
      employé, crée alerte. 4 requêtes en séquence. Si l'update
      statut employé plante, on a un contrat "fantôme" où l'employé
      n'est pas marqué en poste.
  - terminerContrat (ligne 597-604):
      Update contrat puis update employé. Pas de transaction.
  - marquerCommissionPayee (ligne 606-617):
      Update contrat puis boucle for pour marquer alertes lues.
      Pas de transaction.

Fix:
  • Remplacer les `for...of` séquentiels par `Promise.all(map)`.
  • Pour les opérations qui doivent être atomiques, utiliser
    PocketBase transactions (PB v0.22+) via `pb.send()` ou batch.
  • Au minimum, ajouter un try/catch global qui supprime l'employé
    si createEmploye plante après la création initiale.

═══════════════════════════════════════════════════════════════
P1 - HAUTES (à corriger dans la semaine)
═══════════════════════════════════════════════════════════════

P1-1 [CODE] Génération numero_dossier à race condition
──────────────────────────────────────────────────────────────────────
Fichier: src/database/service.ts ligne 463-467
Code:
  const existing = await pb.collection('contrats').getFullList({
    filter: `numero_dossier ~ "${year}"`,
  });
  const count = existing.length;
  const numeroDossier = `CHR-${year}-${String(count + 1).padStart(4, '0')}`;

Bug: entre le getFullList et le create, un autre admin peut créer
un contrat → doublon de numero_dossier.
Le champ numero_dossier est UNIQUE côté PB donc l'un des deux
échouera avec une erreur 400 cryptique.

Fix: utiliser le mécanisme PB de compteur atomique (collection
`counters` + transaction), OU générer côté serveur via hook PB
onRecordCreate, OU utiliser UUID.

──────────────────────────────────────────────────────────────────────
P1-2 [CODE] Boucles séquentielles await au lieu de Promise.all
──────────────────────────────────────────────────────────────────────
Fichier: src/database/service.ts
Occurrences:
  - createEmploye lignes 197, 202, 207 (3 boucles)
  - getEmployeById lignes 222, 225, 229 (3 requêtes parallélisables)
  - marquerToutesAlertesLues lignes 660-663
  - marquerCommissionPayee lignes 614-616
  - getDashboardStats ligne 671: Promise.all OK, mais chaque
    getFullList charge TOUTE la collection au lieu d'un count.

Impact: latence × N pour N relations. Sur un employé avec 5 parents,
3 contacts, 4 expériences = 12 requêtes séquentielles au lieu de 3.

Fix: remplacer par `await Promise.all(items.map(create))`.

──────────────────────────────────────────────────────────────────────
P1-3 [CODE] getDashboardStats charge toutes les collections en mémoire
──────────────────────────────────────────────────────────────────────
Fichier: src/database/service.ts ligne 668-690
Code:
  const [employes, employeurs, contrats, alertes] = await Promise.all([
    pb.collection('employes').getFullList(),   // charge TOUT
    pb.collection('employeurs').getFullList(), // charge TOUT
    pb.collection('contrats').getFullList(),  // charge TOUT
    pb.collection('alertes').getFullList({ filter: 'lu = false' }),
  ]);

Bug: pour 15 employés c'est OK, mais à 5000 employés + 5000 contrats
ça pète la mémoire du device Android bas de gamme (le user a dit
"low-end CPU" en mémoire).

Fix: utiliser `getList(1, 1, {})` pour avoir juste le totalItems,
ou `pb.collection('employes').getList(1, 1, {fields: 'id'})` puis
lire `.totalItems`.

──────────────────────────────────────────────────────────────────────
P1-4 [SECURITE] update avec PATCH public a échoué (HTTP 400)
──────────────────────────────────────────────────────────────────────
Test live (sans auth):
  PATCH /api/collections/employes/records/{id}  body={"nom": "x"}
  → HTTP 400 (vs HTTP 200 pour POST)

Investigation: l'update a échoué probablement parce que le champ
"nom" a une validation "non-vide" ou "min length". Le test de
création avec seulement "nom" a passé car les autres champs
étaient optionnels.

Conclusion partielle: pour l'update il faut peut-être fournir
plus de champs requis. Mais c'est à retester avec les bons champs.
Le fait que createRule="" suffit déjà pour la faille critique P0-1.

──────────────────────────────────────────────────────────────────────
P1-5 [TYPESCRIPT] ~30 erreurs TS bloquantes non détectées
──────────────────────────────────────────────────────────────────────
Fichier: src/components/*, src/screens/*
Sortie `npx tsc --noEmit`:
  SafeButton.tsx:       3 erreurs (cursor: 'default' | 'pointer')
  SectionCard.tsx:      2 erreurs (overflow: 'hidden' as string)
  StatCard.tsx:         4 erreurs (textAlign/fontWeight: string)
  StatusBadge.tsx:      2 erreurs (fontWeight: string)
  ContratDetailScreen:  9 erreurs (alignItems/overflow)
  ContratFormScreen:    6 erreurs (maxHeight/fontWeight)
  DashboardScreen:      2 erreurs (alignItems)
  EmployeDetailScreen:  9 erreurs (overflow, propriété 'style')
  EmployeFormScreen:    8 erreurs (fontWeight, alignItems, position)
  EmployeurDetailScreen: 7 erreurs (overflow, alignItems)
  EmployeurFormScreen:  1 erreur
  SettingsScreen:       5 erreurs (overflow)

Cause racine: les objets de style sont créés en JS pur (sans `as const`)
donc TypeScript les infère comme `{ overflow: string }` au lieu de
`{ overflow: 'hidden' }`. La 2e n'est pas assignable à ViewStyle.

Exemple SafeButton.tsx ligne 66:
  cursor: isDisabled ? 'default' : 'pointer'   // inféré: string
  // Attendu: cursor: 'default' | 'pointer'  (CursorValue)
Fix:
  cursor: (isDisabled ? 'default' : 'pointer') as const

Ou mieux: typer les styles hors de StyleSheet.create.

Pourquoi ça ne casse pas en runtime: skipLibCheck:true dans tsconfig.json
ligne 9 ne suffit pas à skipper nos propres erreurs. Le build passe
quand même grâce au bundler (Metro/webpack) qui strip les types.

Fix groupé (refacto): créer un helper `ss<T>(obj: T): T` qui force
l'inférence, OU utiliser `StyleSheet.create({...} as const)`.

──────────────────────────────────────────────────────────────────────
P1-6 [CODE] SafeButton useEffect avec deps incomplètes
──────────────────────────────────────────────────────────────────────
Fichier: src/components/SafeButton.tsx ligne 35-51
Code:
  useEffect(() => {
    ...
    const handler = (e: MouseEvent) => {
      if (!isDisabled && onPress) {  // capture isDisabled & onPress
        e.stopPropagation();
        onPress();
      }
    };
    domNode.addEventListener('click', handler);
    return () => domNode.removeEventListener('click', handler);
  }, [isDisabled, onPress]);  // mais isDisabled n'est pas listé!

Bug: `isDisabled` est référencé dans le closure mais absent du tableau
de dépendances. Le linter react-hooks/exhaustive-deps se déclencherait.
Comportement: si `disabled` change après mount, le handler garde
l'ancienne valeur de isDisabled (closure stale).

Fix: ajouter isDisabled au tableau de dépendances.

──────────────────────────────────────────────────────────────────────
P1-7 [CODE] SafeButton code mort + race condition
──────────────────────────────────────────────────────────────────────
Fichier: src/components/SafeButton.tsx ligne 40
Code:
  const domNode = el.nodeType === 1 ? el : el;  // toujours el !

Le ternaire est tautologique. Probablement un reliquat de debug.
Fix: supprimer → `const domNode = el;`.

Aussi ligne 32: `useRef<any>(null)` devrait être `useRef<View>(null)`
pour la sûreté de typage. Mineur mais bon.

──────────────────────────────────────────────────────────────────────
P1-8 [UI] InfoRow.tsx import bizarre
──────────────────────────────────────────────────────────────────────
Fichier: src/components/InfoRow.tsx
Ligne 1: `import React from 'react';` et `import {View, StyleSheet, ViewStyle} from 'react-native';`
Ligne 34: `import { Text } from 'react-native';`   ← import tardif

JS hoist les imports donc ça marche, mais c'est moche et certains
linter (eslint-plugin-import) vont le signaler.
Fix: déplacer l'import de Text en haut du fichier.

═══════════════════════════════════════════════════════════════
P2 - MOYENNES (qualité / dette technique)
═══════════════════════════════════════════════════════════════

P2-1 [TYPES] Type any{} omniprésent
──────────────────────────────────────────────────────────────────────
50+ occurrences de `any` dans service.ts et les screens. Empêche la
sécurité de typage et cache des bugs.

Exemples:
  service.ts: getEmployeById, createEmploye, searchEmployes, etc.
              tous les retours sont Promise<any>
  screens:    const [stats, setStats] = useState<any[]>([])

Fix: générer des types depuis pocketbase-types (le SDK PB peut
générer les types depuis le schéma). Voir scripts/.

──────────────────────────────────────────────────────────────────────
P2-2 [NAVIGATION] useNavigation<any>() utilisé partout
──────────────────────────────────────────────────────────────────────
La skill `chrisroi-agence-expo-project` dit que des types stricts
existent dans src/types/navigation.ts, mais 12/12 screens utilisent
quand même `useNavigation<any>()` au lieu des types composites
définis (DashboardNavProps, EmployeListNavProps, etc.).

Fix: remplacer par les types composites. Exemple EmployesScreen:
  import type { EmployeListNavProps } from '../types/navigation';
  const navigation = useNavigation<EmployeListNavProps>();

──────────────────────────────────────────────────────────────────────
P2-3 [DATA] numero_dossier regex "~" trop permissive
──────────────────────────────────────────────────────────────────────
Fichier: src/database/service.ts ligne 464
Code: filter: `numero_dossier ~ "${year}"`
Le `~` est l'opérateur "contains" en PB filter. Si year="2026",
ça matche aussi "CHR-20265-001" ou "CHR-12026-001". Pas critique
en 2026 mais à surveiller en 2030.

Fix: filter: `numero_dossier ~ "CHR-${year}-"`.

──────────────────────────────────────────────────────────────────────
P2-4 [UX] Validation date faible dans formulaires
──────────────────────────────────────────────────────────────────────
Fichier: src/screens/ContratFormScreen.tsx ligne 386-400
Les champs "Date de début" et "Date de fin" sont des TextInput
libres avec placeholder "JJ/MM/AAAA" mais aucune validation.
Un user peut taper "abc" et soumettre.

Fix: utiliser un DatePicker (expo-datepicker ou picker natif).

──────────────────────────────────────────────────────────────────────
P2-5 [UX] Pas de gestion d'erreur visible pour les requêtes PB
──────────────────────────────────────────────────────────────────────
Plusieurs screens catchent les erreurs et font `console.error()`
mais n'affichent rien à l'utilisateur. Si la connexion PB tombe
mid-session, l'utilisateur ne voit qu'une liste vide sans
explication.

Fix: Toast/Snackbar global + retry pattern.

──────────────────────────────────────────────────────────────────────
P2-6 [CONFIG] pocketbase.zip laissé dans le repo (12 MB)
──────────────────────────────────────────────────────────────────────
Fichier: pocketbase/pocketbase.zip (12,294,990 octets)
Pas dans .gitignore (seul pocketbase.exe est exécuté). Alourdit
le repo inutilement.

Fix: rm pocketbase/pocketbase.zip + ajouter *.zip au .gitignore.

──────────────────────────────────────────────────────────────────────
P2-7 [SECURITE] session localStorage non sécurisée
──────────────────────────────────────────────────────────────────────
Fichier: src/context/AuthContext.tsx ligne 24-28
Le token user est sérialisé en JSON dans localStorage, accessible
à tout script tiers si faille XSS sur le web.
C'est un compromis acceptable pour un build web de dev, mais
à renforcer avant prod:
  • Ne stocker que {id, email, role}, pas nom/prénom.
  • Re-valider le token au démarrage via pb.collection('users').authRefresh().

──────────────────────────────────────────────────────────────────────
P2-8 [BUILD] Pas de script pour générer les types PocketBase
──────────────────────────────────────────────────────────────────────
Le projet dépend de la cohérence schema PB ↔ code TS mais aucun
script ne vérifie ça. Si quelqu'un ajoute un champ côté PB sans
mettre à jour src/types/index.ts, l'erreur apparaît seulement
au runtime.

Fix: ajouter dans package.json:
  "types:pb": "pocketbase-typegen --db pocketbase/pb_data/data.db --out src/types/pb-generated.ts"

──────────────────────────────────────────────────────────────────────
P2-9 [CONFIG] AGENTS.md obsolète (Expo SDK 56 demandé)
──────────────────────────────────────────────────────────────────────
Fichier: AGENTS.md dit "Read the exact versioned docs at
https://docs.expo.dev/versions/v56.0.0/" mais package.json
est en SDK 52. Contradiction. Soit on upgradait à SDK 56
(gros chantier) soit on corrige le fichier.

Fix: mettre à jour AGENTS.md pour pointer vers SDK 52, OU
planifier un upgrade.

═══════════════════════════════════════════════════════════════
P3 - BASSES (nice to have)
═══════════════════════════════════════════════════════════════

P3-1 [GIT] 1 seul commit "Initial commit" + 25 fichiers modifiés non commités
       Risque de perte si crash disque.

P3-2 [GIT] Dossier .idea/ non ignoré (caches IntelliJ/WebStorm)
       Fichiers: .idea/caches/, .idea/misc.xml, .idea/vcs.xml

P3-3 [BUILD] Dossier dist3/, dist2/, web-build/ non gitignoré
       Ancien: dist2/, dist3/, web-build/ (alourdit le repo)

P3-4 [DATA] Dossier IMG_20260604_*.jpg/png (50+ MB) à la racine
       Fichiers d'OCR ancien (projet contrat_upscaled.png), devraient
       être dans docs/ ou supprimés.

═══════════════════════════════════════════════════════════════
CE QUI MARCHE BIEN (à conserver)
═══════════════════════════════════════════════════════════════

✓ Le flow login → dashboard → tabs fonctionne sans erreur console
✓ Le calendrier interactif charge, affiche Juin 2026, navigation OK
✓ La navigation 4 tabs + 2 modales est propre et typée (types
  composites existent même si non utilisés dans les screens)
✓ Le plan de refonte domestique est appliqué dans le code:
  - 14 catégories d'emploi (cuisinier/cuisinière, jardinier, etc.)
  - 6 niveaux d'étude réalistes
  - Types contrat hébergé/non-hébergé/perso
  - Profil employeur particulier/entreprise/commerce
✓ Le theme/index.ts utilise 'as const' partout → propre
✓ La skill SafeButton existe pour contourner le bug web TouchableOpacity
✓ Le code seed admin au premier démarrage évite l'erreur 404
✓ L'autoCancellation(false) sur PocketBase évite les bugs Dashboard
✓ Le composant CalendarGrid a son architecture propre (référence skill)
✓ 27 migrations PB ordonnées et propres

═══════════════════════════════════════════════════════════════
PLAN D'ACTION RECOMMANDÉ
═══════════════════════════════════════════════════════════════

Sprint 1 (jour 1 - bloquant prod):
  [P0-1] Verrouiller les collections PB (10 min via admin UI)
  [P0-2] Aligner SDK PB et binaire (15 min)
  [P0-3] Wrapper try/catch + cleanup sur createEmploye/createContrat

Sprint 2 (semaine 1):
  [P1-1] Fix race condition numero_dossier
  [P1-2] Promise.all sur les 5 boucles séquentielles
  [P1-3] getDashboardStats avec counts au lieu de getFullList
  [P1-5] Fix les 30 erreurs TS (refacto as const groupé)
  [P1-6] SafeButton deps array
  [P1-7] Supprimer code mort SafeButton
  [P1-8] InfoRow imports

Sprint 3 (semaine 2 - dette):
  [P2-1] Générer types PB → TS
  [P2-2] Remplacer useNavigation<any>() par types composites
  [P2-3, P2-4, P2-5, P2-7, P2-8, P2-9] Qualité
  [P3-*] Nettoyage repo

═══════════════════════════════════════════════════════════════
MÉTHODOLOGIE
═══════════════════════════════════════════════════════════════

Audits réalisés:
  • Statique: `npx tsc --noEmit` (30 erreurs)
  • Statique: lecture des 12 screens, 7 components, service.ts (791 lignes)
  • PB schema: lecture _collections, _migrations via sqlite3
  • PB runtime: 4 tests d'accès (lecture/create/update/delete sans auth)
  • Web runtime: dist/ servi sur :5173, login OK, navigation 4 tabs OK
  • Console browser: 0 erreur, 0 warning

Outils utilisés:
  • TypeScript 5.3.3 (npx tsc --noEmit)
  • SQLite direct (Python sqlite3)
  • curl pour tests HTTP
  • Browserbase pour le test runtime
  • Skill: chrisroi-agence-expo-project v1.3.0
  • Skill: dogfood (issue taxonomy)
