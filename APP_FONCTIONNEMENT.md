# Application ChrisRoi Agence — Guide de fonctionnement complet

> **Document de référence** rédigé à partir du code source (état actuel, branche `upgrade/sdk-54`, juillet 2026).
> Ce document décrit **ce que fait l'application aujourd'hui** : fonctionnement, fonctionnalités, usage, règles métier.
> Il sert de **base de réflexion** pour les évolutions futures (modifications, ajouts, refontes).
> ⚠️ Si une divergence apparaît entre ce document et le code, **le code fait foi** — signaler la divergence pour mise à jour.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Architecture générale](#3-architecture-générale)
4. [Modèle de données (PocketBase)](#4-modèle-de-données-pocketbase)
5. [Navigation de l'application](#5-navigation-de-lapplication)
6. [Règles métier transverses](#6-règles-métier-transverses)
7. [Écrans de l'application](#7-écrans-de-lapplication)
8. [Workflows métier complets](#8-workflows-métier-complets)
9. [Configuration & paramétrage](#9-configuration--paramétrage)
10. [Outils de diagnostic](#10-outils-de-diagnostic)
11. [Points d'attention & limites actuelles](#11-points-dattention--limites-actuelles)
12. [Annexes](#12-annexes)

---

## 1. Vue d'ensemble

### 1.1 Qu'est-ce que l'application ?

**ChrisRoi Agence** est une application mobile Android de **gestion d'une agence de placement de personnel domestique** basée à Abidjan (Côte d'Ivoire).

L'agence place du **personnel de maison** :
- **Travailleurs** : nounous, serveuses, chauffeurs, vigiles, femmes de ménage, cuisiniers, jardiniers, gouvernantes, lingères, majordomes, gardes malades, domestiques.
- **Employeurs** : majoritairement des **particuliers** (maisons), parfois des commerces (restaurants, magasins) ou entreprises.
- **Contrats** : pas de CDI/CDD classique — trois types : **hébergé sur place**, **non hébergé**, **personnalisé**. La commission de l'agence = **1/3 du premier salaire** de l'employé placé.

### 1.2 Qui utilise l'application ?

- Les **agents de l'agence** (gérant, secrétaires, agents de placement) sur un **téléphone Android** (Expo Go en développement, APK en production).
- Un **serveur PocketBase** local (PC de l'agence, même réseau Wi-Fi) stocke toutes les données.
- La **clé de revenus** de l'agence : commission d'agence = 1/3 du premier salaire.

### 1.3 Objectif métier

Remplacer le fonctionnement papier (fiches d'inscription manuscrites, contrats Word, cahier de suivi des commissions) par un outil numérique :
1. **Inscrire** un candidat (fiche d'inscription complète).
2. **Placer** le candidat chez un employeur (contrat de placement A4 fidèle au document Word officiel).
3. **Imprimer / signer / scanner** le contrat signé.
4. **Suivre les commissions** à percevoir et les fins de contrat.
5. Recevoir des **alertes** (fin de contrat J-7/J-3, commission due).

---

## 2. Stack technique

| Composant | Technologie | Version |
|---|---|---|
| Framework mobile | Expo | SDK 54 (`expo@54.0.36`) |
| React Native | React Native | 0.81.5 |
| React | React | 19.1.0 |
| Langage | TypeScript | ~5.9.2 |
| Architecture native | New Architecture | activée (`newArchEnabled: true`) |
| Écrans edge-to-edge | Android | activé (`edgeToEdgeEnabled: true`) |
| Backend | PocketBase (binaire local `pocketbase.exe`) | v0.23+ (SDK JS `pocketbase@0.27.0`) |
| UI | React Native Paper + React Navigation | Paper 5.12, Navigation 6 |
| Icônes | `@expo/vector-icons/MaterialCommunityIcons` | — |
| Animations | Animated core RN | — |
| Stockage local | `expo-sqlite` (natif) / `localStorage` (web) via `localSettings` | — |
| Photo/scan | `expo-image-picker`, `expo-image-manipulator` | — |
| Impression | `expo-print`, `expo-sharing` | — |
| Réseau | `expo-network` (découverte IP LAN) | — |
| IA (OCR) | Gemini API (REST direct) — `src/services/gemini.ts` | Gemini 2.0 Flash (`gemini-2.0-flash`) |

**Permissions natives déclarées (app.json)** : CAMERA, RECORD_AUDIO, WRITE_EXTERNAL_STORAGE, READ_EXTERNAL_STORAGE, READ_MEDIA_IMAGES + `usesCleartextTraffic: true` (HTTP non-chiffré sur le LAN) + descriptions iOS (caméra/galerie).

---

## 3. Architecture générale

### 3.1 Les 3 couches

```
┌─────────────────────────────────────────────────────────┐
│  UI — src/screens/* + src/components/*                  │
│  (21 écrans, 11+ composants)                            │
├─────────────────────────────────────────────────────────┤
│  Service — src/database/service.ts (1309 lignes)        │
│  Toutes les fonctions métier : createEmploye,           │
│  createContrat, getCalendarEvents, uploadScan, ...      │
├─────────────────────────────────────────────────────────┤
│  Client — src/database/pocketbase.ts                    │
│  getPocketBase(), hydratePocketBaseUrl(), checkHealth() │
├─────────────────────────────────────────────────────────┤
│  Serveur — PocketBase (http://<IP>:8090)                │
│  9 collections métier + users                           │
└─────────────────────────────────────────────────────────┘
```

- Les écrans n'appellent **jamais** PocketBase directement : tout passe par `service.ts` (sauf 2 cas connus : ScanResultScreen fait une requête directe `pb.collection('employeurs')`, et la découverte d'URL).
- Gestion d'erreurs centralisée : `PbError` (code HTTP + erreurs de champs) + `translatePbError`.
- `withTimeout()` (8 s) sur les appels sensibles pour éviter les requêtes qui pendent.

### 3.2 Démarrage de l'application

```
Splash animé (AnimatedSplash : logo + titre, ~1,5 s)
        ↓
AuthProvider useEffect → initDatabase()
        1. hydratePocketBaseUrl()  → résolution URL (voir 3.3)
        2. health check (timeout 8 s)
        3. Auth superuser (admin@chrisroi.com / chrisroi2024)
           → seed du user admin si absent (collection users)
        4. Ré-auth en user normal (admin@chrisroi.com)
        ↓
Si serveur injoignable → écran de connexion + accès "Configurer le serveur"
Si OK → session restaurée ou écran de connexion
```

**Règle d'or de sécurité** : l'app tourne en **user normal** (jamais en superuser) après l'init. Le token superuser n'est utilisé que pour l'init/seed (sinon 403 sur les opérations user).

### 3.3 Découverte automatique de l'URL PocketBase

L'IP du PC serveur change (DHCP). Résolution en **4 niveaux** (`hydratePocketBaseUrl()` dans `pocketbase.ts`) :

| Niveau | Mécanisme | Cas d'usage |
|---|---|---|
| 1. **Scan auto /24** | `discoverPocketBaseUrl()` : lit l'IP du téléphone (`expo-network`), déduit le range `x.x.x.1→254`, teste `http://<ip>:8090/api/health` en parallèle (24 concurrents, timeout 900 ms/IP) | Changement d'IP fréquent, zéro saisie |
| 2. **IP fixe** | Constante `FIXED_LAN_IP = '192.168.1.6'` (testée via `/api/health`) | Fallback si le scan échoue (pare-feu) |
| 3. **Dernière IP persistée** | `localSettings` (SQLite natif / localStorage web) clé `pocketbase_url` | Démarrage instantané si le serveur n'a pas bougé |
| 4. **Constante codée** | `http://127.0.0.1:8090` (web) / IP fixe (Android) | Ultime fallback |

- Chaque IP trouvée est **persistée** → au redémarrage, l'app part sur la dernière connue puis re-scanne.
- ⚠️ **Web** : `Network.getIpAddressAsync()` retourne l'IP *publique* (pas la LAN) → le scan échoue en web → fallback constantes. Comportement connu, sans impact APK.
- ⚠️ `localStorage` **n'existe pas** sur l'APK natif → toute persistance passe par `localSettings` (fichiers `.native.ts` / `.web.ts`).

### 3.4 Authentification

- **Superuser** : `admin@chrisroi.com` / `chrisroi2024` — utilisé uniquement à l'init (seed + droits d'écriture).
- **User normal** : même compte dans la collection `users` (champs custom : `nom`, `prenom`, `role`, `actif`).
- Session : `pb.authStore` + persistance minimale `{id, email, role}` en `localStorage` (clé `chrisroi_user_v1`) — nom/prénom jamais persistés (XSS).
- `authenticateUser(email, password)` : vérifie `actif`, gère le champ `name` standard PB en fallback pour nom/prénom.
- **Règles API PocketBase** (`fix_api_rules` migration) : toutes les collections métier → `list/view/create/update/delete = "@request.auth.id != ''"` (tout utilisateur connecté peut tout faire). `users` : createRule et listRule à `null` (création/lister réservés au superuser — l'écran Paramètres crée les users avec le token superuser de session).

### 3.5 Connexion au serveur

- `checkHealth()` : `fetch(url/api/health)` avec `AbortController` + timeout 8 s (évite le pendu de 120 s sur Android).
- Si PB est injoignable au démarrage : écran de connexion avec bouton **"Configurer le serveur"** (saisie URL + test + enregistrement).

---

## 4. Modèle de données (PocketBase)

> Sources : migrations `pocketbase/pb_migrations/*.js` (vérité serveur) + `src/types/pb-generated.ts` (**⚠️ périmé** — ne contient ni `scans`, ni `photo`, ni `commission_fixe`/`frais_transport`/`date_prelevement`/`ethnie`/`concubinage`).

### 4.1 Collections

| Collection | Type | Rôle |
|---|---|---|
| `users` | auth | Agents de l'agence (email/mot de passe + nom/prenom/role/actif) |
| `employes` | base | Candidats / personnel de maison |
| `parents` | base | Parents d'un employé (père/mère) |
| `personnes_urgence` | base | Personnes à contacter en cas d'urgence |
| `experiences_pro` | base | Expériences professionnelles antérieures |
| `employeurs` | base | Employeurs (particuliers, commerces, entreprises) |
| `demandes_recrutement` | base | Demandes de recrutement des employeurs |
| `contrats` | base | Contrats de placement |
| `alertes` | base | Notifications (fin contrat, commission, demande) |
| `scans` | base | Scans photo des documents signés (fiches, contrats) |

### 4.2 `employes` — champs

| Champ | Type | Notes |
|---|---|---|
| `nom`, `prenom` | text | Requis |
| `date_inscription` | date | Défaut : maintenant |
| `date_naissance`, `lieu_naissance` | text/date | |
| `telephone` | text | |
| `lieu_residence` | text | |
| `nationalite` | text | |
| `situation_matrimoniale` | select | `celibataire` / `marie` / `divorce` / `veuf` / **`concubinage`** (ajout migration) |
| `religion` | text | |
| `niveau_etude` | select | `sait_lire_ecrire` / `primaire` / `secondaire_1` / `secondaire_2` / `superieur` / `aucun` |
| `a_deja_travaille` | bool | |
| `experience_details`, `stages_effectues`, `formations`, `motivation` | text | |
| `categorie_emploi` | select | 14 catégories (voir annexe 12.1) |
| `statut` | select | `disponible` / `en_poste` / `indisponible` — **passe à `en_poste` automatiquement à la création d'un contrat, revient à `disponible` à la fin du contrat** |
| `photo` | **file** | Photo d'identité (ajout migration 1783864421) — ⚠️ absent de `pb-generated.ts` ET de l'interface `Employe` (accédé dynamiquement) |
| `ethnie` | text | (ajout migration) |

Relations : 1 employé → N `parents`, N `personnes_urgence`, N `experiences_pro` (liées par `employe_id`).

### 4.3 `employeurs` — champs

| Champ | Type | Notes |
|---|---|---|
| `nom_complet` | text | Requis ("Nom complet" — particulier ou société) |
| `date_enregistrement` | date | Défaut : maintenant |
| `type_besoin` | select | `particulier` / `entreprise` / `commerce` / `organisation` (le formulaire ne propose que 3 — pas « Organisation ») |
| `adresse`, `telephone`, `email` | text | |
| `nom_contact`, `prenom_contact` | text | Personne de contact |
| `notes` | text | |

### 4.4 `contrats` — champs

| Champ | Type | Notes |
|---|---|---|
| `numero_dossier` | text | **UNIQUE** — format `CHR-<ANNÉE>-<6 caractères base62 aléatoires>` (ex: `CHR-2026-4F7K2A`), généré côté service |
| `employe_id`, `employeur_id` | relation | Requis |
| `demande_id` | relation | Optionnel (demande de recrutement liée) |
| `date_contrat` | date | Défaut : maintenant |
| `poste` | text | Requis |
| `type_contrat` | select | `heberge` (Hébergé sur place) / `non_heberge` / `personnalise` |
| `date_debut` | date | Requis |
| `date_fin` | date | Optionnel |
| `duree` | text | |
| `salaire` | number | Requis |
| `commission_agence` | number | **Auto = `Math.round(salaire / 3)`** (1/3 du premier salaire) |
| `commission_fixe` | number | Défaut **15000** FCFA (éditable au document) |
| `frais_transport` | number | Défaut **5000** FCFA (éditable au document) |
| `commission_payee` | bool | Passage à `true` via "Percevoir"/"Marquer payée" (avec `date_prelevement`) |
| `date_prelevement` | date | ⚠️ absent de `pb-generated.ts` |
| `frais_dossier`, `frais_payes` | number/bool | |
| `statut` | select | `en_cours` (création) / `termine` / `annule` (jamais déclenché par l'UI) |
| `domicile_employe` | text | Rempli depuis `lieu_habitation` au document |
| `signature_employe`, `signature_agence`, `signature_employeur` | text | Libellés (le document signé est scanné et stocké dans `scans`) |
| `notes` | text | |

### 4.5 `alertes` — champs

`type` : `commission` (créé par service), `fin_contrat_j7`, `fin_contrat_j3` (créés par `createFinContratAlertes`), `nouvelle_demande` (créé par `createDemande`) — `titre`, `message`, `contrat_id`, `employe_id`, `employeur_id`, `lu` (bool), `date_alerte`.

### 4.6 `scans` — champs

`document_type` (`fiche_inscription` | `contrat`), `document_id` (id PB du document), `image` (file, nom `scan_{type}_{id}.jpg`, MIME image/jpeg). Un scan **remplace** le précédent (suppression puis recréation) — **un seul scan par document**.

### 4.7 `demandes_recrutement` — champs

`employeur_id`, `date_demande`, `categorie_emploi`, `nombre_postes` (défaut 1), `description`, `salaire_propose`, `date_debut_souhaitee`, `statut` (`en_attente` / `en_cours` / `pourvue` / `annulee`), `notes`. Création → **alerte automatique** "Nouvelle demande de recrutement".

---

## 5. Navigation de l'application

### 5.1 Structure générale

```
NavigationContainer
└── si non connecté : LoginScreen (plein écran)
└── si connecté : RootStack (header masqué)
    ├── Tabs (BottomTabNavigator — 5 onglets)
    │   ├── DashboardStack  "Aujourd'hui"  → DashboardMain, GlobalSearch ("Dossiers")
    │   ├── EmployesStack   "Dossiers"     → EmployesList, EmployeDetail, EmployeForm (modal), FicheInscription (modal)
    │   ├── EmployeursStack "Employeurs"   → EmployeursList, EmployeurDetail, EmployeurForm (modal)
    │   ├── ContratsStack   "Contrats"     → ContratsList, ContratDetail, ContratForm (modal), ContratDocument (modal)
    │   └── SuiviStack      "Commissions"  → SuiviMain
    └── RootStack modales (au-dessus des tabs)
        ├── AlertesModal ("Alertes")
        ├── SettingsModal ("Paramètres")
        ├── ContratDocumentModal ("Contrat de placement")  ← MÊME écran que ContratsStack/ContratDocument (enregistré 2×)
        ├── FicheInscriptionModal ("Fiche d'inscription")
        ├── Scan ("Scanner un document")
        └── ScanResult ("Résultat du scan")
```

### 5.2 Règles de navigation (leçons du terrain)

- **Les écrans liste/détail vivent dans leurs stacks de tab** (navigation interne item → détail). Ne jamais les ouvrir en modale root (casse la navigation interne).
- **Les documents/formulaires autonomes** (Fiche, Contrat, Scan) peuvent être des **modales root** → retour direct au Dashboard.
- Navigation cross-tab depuis le Dashboard : `navigateTab('ContratsStack', { screen: 'ContratDetail', params: {...} })`.
- `getParent()` ×2 (stack → tab → root) pour atteindre les modales root.
- Les listes ouvertes depuis le Dashboard ont un **bouton retour personnalisé** (chevron → retour Dashboard).
- Header custom partout : `useAppHeader()` (titre + logo + chevron bleu), barre blanche, ombre douce.

### 5.3 Tab bar

- 5 onglets, icônes MaterialCommunityIcons (variantes filled/outline selon focus), label actif bleu `#1E88E5`.
- Hauteur adaptative : `56 + max(insets.bottom, 8)` — corrige le chevauchement des 3 boutons système Android.

---

## 6. Règles métier transverses

| Règle | Détail | Où |
|---|---|---|
| **Commission agence** | `commission_agence = Math.round(salaire / 3)` — le tiers du premier salaire, recalculé en direct à chaque changement de salaire | `createContrat` + document |
| **Frais fixes contrat** | `commission_fixe = 15000` FCFA, `frais_transport = 5000` FCFA (éditables au document) | `createContrat` |
| **Numéro de dossier** | `CHR-<ANNÉE>-<6 chars base62 aléatoires>` — unique (contrainte PB) | `createContrat` |
| **Statut employé** | `disponible` → `en_poste` à la création du contrat ; `en_poste` → `disponible` à `terminerContrat` | `createContrat` / `terminerContrat` |
| **Statut contrat** | `en_cours` à la création ; `termine` via l'action "Terminer" ; `annule` existe mais aucun écran ne le déclenche | service.ts |
| **Alerte commission** | Créée automatiquement à la création du contrat si commission > 0 (« Commission de {N} FCFA à percevoir pour le contrat {numéro} ») | `createContrat` |
| **Alerte fin de contrat** | `createFinContratAlertes()` : crée alertes `fin_contrat_j7` et `fin_contrat_j3` pour les contrats en cours (dédupliquées par contrat+type) — appelée au chargement du Dashboard | Dashboard `loadData` |
| **Échéance commission (calendrier)** | `date_debut + 1 mois` (fallback `date_contrat + 1 mois`) — pastille orange | `getCalendarEvents` |
| **Délai de relance (suivi)** | **`date_debut + 30 jours`** — « En attente » < 30 j, « À relancer » ≥ 30 j, badge J+X | SuiviScreen |
| **⚠️ Incohérence 30 j vs 1 mois** | Les deux règles ci-dessus divergent (30 j ≠ 1 mois calendaire). Voir point d'attention #10 | SuiviScreen / service.ts |
| **Rollback contrat** | Si une étape post-création échoue (statut employé, alerte) → suppression du contrat + retour employé `disponible` | `createContrat` |
| **Nettoyage relationnel** | Création employé : si une relation (parents/urgences/expériences) échoue → suppression en cascade de l'employé (pas de fantômes) | `createEmploye` |
| **Marquer commission payée** | `commission_payee = true` + `date_prelevement` (fournie ou aujourd'hui) + alertes `commission` liées marquées lues | `marquerCommissionPayee` |
| **Scans** | Un scan par document — chaque upload **remplace** l'ancien | `uploadScan` |
| **Formatage** | Dates `jj/mm/aaaa` (fr-FR), montants « X FCFA », âge calculé depuis `date_naissance`, `daysRemaining` arrondi au supérieur | `utils/constants.ts` |
| **Catégories d'emploi** | 14 valeurs fixes (constants.ts) | `utils/constants.ts` |

---

## 7. Écrans de l'application

> Chaque écran : rôle, accès, structure, champs, actions, règles. Les libellés sont **exacts** (tels que dans le code).

---

### 7.1 Connexion (LoginScreen) — plein écran, hors auth

- **Rôle** : authentification des agents. Affiché par App.tsx quand `user` est null.
- **Structure** : fond bleu primaire ; 1) en-tête branding (anneau logo « CR », « ChrisRoi Agence », tagline « Agence de Placement de Personnel ») ; 2) carte « Connexion » / « Accédez à votre tableau de bord » (champs + bouton + rappel des identifiants) ; 3) Dialog « Serveur PocketBase ».
- **Champs** : EMAIL (placeholder `admin@chrisroi.com`, icône `email-outline`, clavier email) ; MOT DE PASSE (masqué, œil de visibilité `eye`/`eye-off`).
- **Actions** :
  - « Se connecter » → validation (vide → « Erreur de saisie ») ; **`checkHealth()` d'abord** (serveur injoignable → alerte « Serveur inaccessible » avec l'URL) ; puis `authenticateUser(email, password)`. Échec → « Échec de connexion » avec rappel des identifiants. Erreurs techniques mappées : `connect` → « Impossible de se connecter au serveur… port 8090 » ; `timeout` → « Le serveur met trop temps à répondre » ; `404` → « Service d'authentification indisponible… Redémarrez PocketBase ».
  - « Configurer le serveur » → Dialog : champ « URL du serveur » (placeholder `http://192.168.1.100:8090`), « Tester & Enregistrer » (test `GET {url}/api/health`, timeout 5 s) → OK : `setPocketBaseUrl(url)` + « Serveur accessible : {url} » ; sinon « Réponse inattendue ({status}) » ou « Serveur inaccessible ».
- **Particularités** : les **identifiants par défaut sont affichés en clair** sur l'écran ; 2 appels réseau avant la première tentative d'auth.

### 7.2 Aujourd'hui / Tableau de bord (DashboardScreen) — onglet « Aujourd'hui »

- **Rôle** : écran central (accueil) — vue d'ensemble chiffrée + accès rapide aux actions métier. **Refonte Warm Earth V5** (terracotta `#c45a2a`, olive `#5a7c3a`, sable `#fdf8f3`).
- **Structure** : header (logo + cloche + avatar) ; section « Actions rapides » (5 ActionCards) ; section « 📁 Dossiers » (DossiersCard + lien « Voir tout ») ; section « Urgences » (2 UrgentCards) ; rechargement au focus.
- **Contenu** :
  - **5 ActionCards** (icône + titre + badge + meta + 2 stats + bouton) :
    | Carte | Bouton | Cible |
    |---|---|---|
    | **Inscrire** | — | `FicheInscriptionModal` (nouvelle fiche) |
    | **Créer un contrat** | — | `ContratDocumentModal` (nouveau contrat) |
    | **Scanner** | — | `Scan` (modale root) |
    | **Nouvel employeur** | — | `EmployeurForm` |
    | **Suivi commissions** | « Voir détail » | `SuiviStack` → `SuiviMain` (meta : « N commission(s) en attente · X FCFA », stats « Total perçu » / « En attente ») |
  - **DossiersCard** : compteurs (fiches, employés disponibles/en poste, employeurs, contrats actifs…) + lien « Voir tout (N) » → `EmployesStack` → `EmployesList`.
  - **2 UrgentCards** :
    1. **Contrats finissants** : « {prénom} {nom} · Fin dans {X}j » (X = jours restants), bouton **« Proposer prolongation »** → `ContratsStack` → `ContratDetail` avec `params: { contratId: c.id }` ⚠️ (voir point #9) — ou « Aucune urgence contrat » + « Voir contrats ».
    2. **Commission à percevoir** : « {prénom} {nom} · Commission à percevoir » (1ʳᵉ commission en attente).
  - Header : cloche `bell-outline` (pastille si commissions en attente) → **onglet Suivi** ⚠️ (pas AlertesModal) ; icône `account-outline` → `SettingsModal`.
- **Données** : `loadData` = `Promise.all` (commissions, employés, employeurs, contrats, contrats fin proche) + `createFinContratAlertes()` au chargement.

### 7.3 Dossiers / Liste des candidats (EmployesScreen) — onglet « Dossiers »

- **Rôle et accès** : liste des candidats avec recherche, filtres par statut, accès rapide à la fiche ou au placement. Route `EmployesList` ; rechargement à chaque focus (`getAllEmployes()`, tri `-created`).
- **Structure** : 1) header (📋 « Dossiers », compteur « X candidat(s) », bouton loupe **inerte**) ; 2) Searchbar « Nom, téléphone, catégorie... » ; 3) chips de filtres statut avec compteurs ; 4) FlatList de cartes (pull-to-refresh) ; 5) état vide (« Aucun candidat trouvé » ou « Appuyez sur + pour inscrire un candidat ») ; 6) FAB « + ».
- **Champs** : recherche client-side (minuscules, insensible casse) sur `prenom`+`nom`, `telephone`, libellé FR de `categorie_emploi`, `lieu_residence`. Filtres : `tous` « Tous », `disponible` « Disponibles », `en_poste` « En poste », `en_attente` « En attente », `indisponible` « Indisponibles » (chaque chip affiche son compte). Carte : avatar **initiales** (jamais la photo), pastille statut, « prénom nom », tag catégorie, tag statut, « 📞 téléphone », « 📍 lieu_residence ».
- **Actions** : tap carte → `EmployeDetail {id}` ; si `disponible` → boutons **« Placer »** (→ `ContratsStack` → `ContratDocument` avec `{employe_id}`) et **« Fiche »** (→ `FicheInscription {id}`) ; sinon **« Ouvrir la fiche »** ; FAB « + » → `FicheInscription` (nouvelle).
- **Particularités** : filtre `en_attente` proposé alors que `createEmploye` ne crée que `disponible` ; compteur du header = liste *filtrée*, pas le total.

### 7.4 Détail employé (EmployeDetailScreen)

- **Rôle et accès** : consultation complète (identité, famille, urgences, expérience, historique de contrats) + modification/suppression. Route `EmployeDetail {id}` ; header « prénom nom ».
- **Structure** : entête centrée (avatar — `photo_uri` si chargeable sinon initiales colorées par statut, nom complet, chips statut/catégorie, « Modifier » + menu ⋮) ; cartes « Informations personnelles », « Parents » (si non vide), « Personnes à contacter en cas d'urgence » (si non vide), « Expérience professionnelle » (toujours), « Historique des contrats (N) » (si contrats).
- **Champs** : infos perso (date/lieu de naissance avec « (N ans) », téléphone, résidence, nationalité, situation matrimoniale libellée, religion, niveau d'étude libellé, date d'inscription) ; parents (Père/Mère : prénom nom, téléphone, domicile) ; urgences (« #N » ordre) ; expérience (« A déjà travaillé : » ✓/✗, expériences entreprise/lieu-contact, stages, formations, motivation) ; contrats (numero_dossier + statut + employeur + dates « En cours » si sans fin).
- **Actions** : « Modifier » → `FicheInscription {id}` (**c'est la fiche A4 qui sert d'éditeur**) ; menu ⋮ : « Créer un contrat » → `ContratForm {employe_id}` ⚠️ (pas le Document !) ; « Supprimer » (rouge, confirmation « Cette action est irréversible. ») → `deleteEmploye` + goBack ; tap contrat → `ContratDocumentModal {id, origin: 'Employé'}` ; tap employeur (souligné) → `EmployeurDetail`.
- **Particularités** : l'avatar lit `photo_uri` (ancien champ texte), pas le file field `photo` de la fiche d'inscription.

### 7.5 Formulaire employé multi-étapes (EmployeFormScreen) — [ANCIEN parcours]

- **Rôle** : ancien wizard 4 étapes (Infos personnelles → Parents → Urgences → Expérience). Toujours enregistré (`EmployeForm`, modal) mais **le parcours principal passe par la Fiche d'inscription** (7.6). Concurrence assumée.
- **Structure** : barre d'étapes 1-4 (pastilles ✓/active/à venir) ; étape 1 = photo (Galerie/Caméra) + identité + situation matrimoniale (Célibataire/Marié(e)/Divorcé(e)) + catégorie (14 chips) + niveau d'étude (6 chips) ; étape 2 = Père/Mère (nom, prénom, téléphone, domicile) ; étape 3 = contacts d'urgence (ajout/suppression) ; étape 4 = expériences (ajout/suppression) + formation & motivation.
- **Actions** : « Précédent » / « Suivant » (devient « Enregistrer » vert à la dernière étape) ; sauvegarde → `createEmploye` / `updateEmploye` + Alert « Succès ».
- **⚠️ Pièges majeurs** :
  1. `NavButton`/`ActionButton` attachent `onPress` via `addEventListener('click')` **uniquement sur web** → sur natif, les boutons sont des `View` **inertes** (contournement documenté pour Expo web dev).
  2. En édition, `updateEmploye` **ignore** `parents`, `personnes_urgence`, `experiences`, `photo_uri` → les modifications relations/photo ne sont **jamais persistées**.
  3. La photo n'est pas uploadée depuis cet écran (champ local uniquement).

### 7.6 Fiche d'inscription (FicheInscriptionScreen) — PARCOURS PRINCIPAL

- **Rôle** : **formulaire principal** de création/édition d'un candidat, présenté comme un **document A4 WYSIWYG éditable en ligne** (fiche papier « Demandeur d'emploi »), avec impression et archivage du scan signé. Routes : `FicheInscription` (stack, modal) + `FicheInscriptionModal` (root). Header : « Nouvelle fiche d'inscription » / « Fiche d'inscription » / « — depuis {origin.label} ».
- **Structure** : barre « Voir les contrats » (édition) ; onglets **« Numérique »** / **« Scanné »** (pastille verte si scan) ; onglet Numérique = composant `A4Document` ; onglet Scanné = aperçu du scan + bouton scan ; modale « bottom sheet » de choix de source photo.
- **Champs du document A4** (tous éditables — TextInput soulignés) :
  - En-tête : « CHRISROI AGENCE » / « FICHE D'INSCRIPTION » / « Demandeur d'emploi » ; « N° dossier » (**placeholder « CHR-____ », jamais généré ici**) ; « Date » (du jour, non éditable).
  - « 1. IDENTITÉ DU CANDIDAT » : photo (tap → modale Galerie/Caméra) ; Nom, Prénom(s), Né(e) le + À, Téléphone, Nationalité, Résidence, Religion ; « Situation matrimoniale » (cases Célibataire/Marié(e)/Divorcé(e)) ; « Niveau d'étude » (6 chips).
  - « 2. PARENTS » : Père / Mère (Nom, Prénom, Téléphone, Domicile/Quartier).
  - « 3. PERSONNES À CONTACTER EN CAS D'URGENCE » : lignes « Contact N : » (Nom/Prénom/Téléphone) + « + ».
  - « 4. EXPÉRIENCE PROFESSIONNELLE » : case « A déjà travaillé » ; lignes « Exp. N : » (Entreprise/Lieu/Contact) + « + » ; « Détails de l'expérience », « Stages effectués », « Formations » (multilignes).
  - « 5. EMPLOI RECHERCHÉ » : « Catégorie d'emploi » (14 chips) ; « Motivation ».
  - « 6. SIGNATURE » : zone « Le candidat » (légende = prénom nom) + « L'agent » ; mention « Je certifie l'exactitude des informations fournies ci-dessus. »
- **Actions** :
  - **« Enregistrer » / « Imprimer »** (toolbar A4) → tous deux `handleSave` (l'impression enchaîne sur `handleAfterPrint`). Validation : nom + prénom requis. Création → `createEmploye` (relations en parallèle, rollback si échec) ; édition → `updateEmploye` (⚠️ relations non mises à jour). Puis si `photo_uri` locale → `uploadEmployePhoto(id, uri)` (file field `photo`). Alerts « Employé inscrit » / « Employé modifié ». **L'écran ne navigue pas après sauvegarde** (on reste pour imprimer/scanner).
  - **« Scanner le document signé »** (onglet Scanné, édition seulement — sinon « Enregistrez d'abord la fiche pour pouvoir scanner. ») : natif = `launchCameraAsync` (qualité 0.85) ; web = input file caché. `uploadScan('fiche_inscription', id, uri)` **remplace** l'ancien scan.
  - Modale photo : « Choisir dans la galerie » / « Prendre une photo » / « Annuler ».
  - Après impression (édition) : popup **« Scanner le document ? »** (« Plus tard » / « Oui ») → scan direct. En création : « Enregistrez d'abord la fiche pour pouvoir scanner le document signé. »
- **Particularités** : la fiche A4 est un **vrai formulaire**, pas un aperçu ; chargement édition via `getEmployeById` (employé + 3 relations) + photo serveur (champ `photo` prioritaire) + scan existant.

### 7.7 Employeurs

#### 7.7.1 Liste (EmployeursScreen)
- **Rôle** : liste avec recherche, filtres par type, compteur de candidats dispo, accès rapide au contrat.
- **Structure** : Searchbar ; chips types (compteurs) ; **bandeau vert « X candidat(s) disponible(s) »** ; barre « X résultat(s) (sur N) » ; FlatList (pull-to-refresh) ; FAB « + ».
- **Champs/carte** : `nom_complet`, type libellé (Particulier/Entreprise/Commerce/Organisation), chip « N placement(s) », téléphone (ou « Tél. non renseigné »), email, adresse/ville/quartier, « Contact : » nom+prenom contact. Recherche sur nom_complet, contact, téléphone, email, adresse, ville, quartier. Filtres types **dynamiques** (valeurs présentes en base).
- **Actions** : tap carte → `EmployeurDetail {id}` ; **« Trouver (N dispo) »** → si aucun dispo : Alert « Aucun candidat disponible » sinon cross-tab `EmployesList` ; **« Contrat »** → `ContratDocument` (`{employe_id: undefined}`) ; FAB → `EmployeurForm`.

#### 7.7.2 Détail (EmployeurDetailScreen)
- **Rôle** : fiche détaillée (coordonnées, contact, notes, demandes, employés placés).
- **Structure** : entête (avatar, nom, secteur, « Modifier » + menu ⋮) ; « Coordonnées » ; « Personne de contact » ; « Notes » ; « Demandes de recrutement (N) » ; « Employés placés (N) » (N = employe_id distincts).
- **Actions** : « Modifier » → `EmployeurForm {id}` ; menu ⋮ : **« Nouvelle demande » — AUCUN EFFET (placeholder)** ; « Supprimer » (confirmation) → `deleteEmployeur` + goBack ; tap ligne employé → `FicheInscriptionModal {id: employe_id, origin: {label: nom employeur}}`.

#### 7.7.3 Formulaire (EmployeurFormScreen)
- **Champs** : « Type d'employeur » (SegmentedButtons **Particulier/Entreprise/Commerce** — « Organisation » absent ⚠️ alors que la liste le filtre) ; « Nom complet »/« Raison sociale » (placeholders dynamiques « Ex: Diallo Fatou » / « Ex: Société ABC », obligatoire) ; Adresse (multiligne) ; Téléphone ; Email ; Nom/Prénom du contact ; Notes.
- **Actions** : « Enregistrer l'employeur » / « Modifier l'employeur » → `createEmployeur`/`updateEmployeur` → Alert Succès → goBack. Validation : `nom_complet` obligatoire.

### 7.8 Contrats

#### 7.8.1 Liste (ContratsScreen)
- **Rôle** : liste avec recherche, filtres statut/type/commission, alerte visuelle fin proche.
- **Structure** : Searchbar ; SegmentedButtons « Tous (N) »/« Actifs (N) »/« Terminés (N) » ; toggle « Plus de filtres » (panneau « Type de contrat » + « Commission », « Réinitialiser les filtres ») ; FlatList + FAB « + » vert.
- **Champs/carte** : `numero_dossier` + `poste` ; chip statut ; `employe_nom`+`prenom` ; type libellé ; `nom_complet` employeur ; « Début »/« Fin » (ou « Non définie ») + **badge orange « Nj » (rouge si ≤ 3)** si en cours ; « Salaire » ; « Commission » (vert si payée, rouge sinon, « * » si impayée). Recherche sur numéro dossier, employé, employeur, poste. Filtres : statut, type (dynamique), commission `toutes`/`payee`/`impayee`.
- **Actions** : **tap carte → `ContratDocument {id}`** ⚠️ (le document, pas le détail) ; FAB → `ContratDocument` (création).
- **Règles** : urgence = `daysRemaining(date_fin) <= 7 && en_cours` (bordure rouge).

#### 7.8.2 Formulaire (ContratFormScreen) — [doublon du document]
- **Rôle** : formulaire classique (employé, employeur, poste, dates, salaire, frais). **Doublon** — le parcours effectif passe par ContratDocument (7.8.4). Atteint depuis le menu ⋮ de EmployeDetail (« Créer un contrat »).
- **Champs** : sélecteurs employé/employeur (modals « Sélectionner un employé »/« un employeur ») ; « Poste » (obligatoire) ; « Type de contrat » ⚠️ **libellés bruts affichés** (`heberge`/`non_heberge`/`personnalise`, pas les labels FR) ; « Date de début » (obligatoire) ; « Date de fin » ; « Salaire (FCFA) » (obligatoire) ; carte « Commission agence (⅓) » **auto en direct** ; « Frais de dossier » ; « Domicile de l'employé » ; « Notes ».
- **Actions** : « Créer le contrat »/« Modifier le contrat » → `createContrat`/`updateContrat` → Alert Succès → goBack.

#### 7.8.3 Détail (ContratDetailScreen)
- **Rôle** : vue détaillée (finances, parties, dates, historique, actions) + impression HTML/PDF. Route `ContratDetail {id}` — **pas atteint depuis la liste** (qui ouvre le document). Titre « Contrat #<numero_dossier> ».
- **Structure** : entête bleu (🖨, ⋮, numero_dossier, poste, chip statut + badge jours) ; « 💰 Situation financière » (Commission à percevoir + « 1/3 du salaire · Payée/Non payée », Salaire/Frais dossier) ; « 👥 Parties » ; « 📅 Dates clés » ; « 📜 Historique » (timeline : « Contrat créé », « Alerte commission créée », conditionnel « Fin de contrat imminente / Proposer une prolongation ») ; « ⚡ Actions » (4 boutons) ; « 📝 Notes » ; barre basse « Modifier »/« Imprimer contrat ».
- **Actions** : 🖨 / « Imprimer contrat » → `buildContratHtml` (format « pro » HTML, distinct du document A4 RN) + `printAsync` ; « Voir profils » → `EmployeDetail` ; « Commission payée » → `marquerCommissionPayee` ; « Terminer » (rouge, confirmation) → `terminerContrat` + reload.
- **⚠️ Boutons morts/placeholder** : « Modifier » → **`goBack()` uniquement** (ne mène pas au formulaire !) ; ⋮ « Actions du contrat », « Détails », « Calendrier », « Voir tout », « Appeler » → Alert ; « Prolonger » → « Fonctionnalité à implémenter ».

#### 7.8.4 Document de contrat A4 2 pages (ContratDocumentScreen) — PARCOURS PRINCIPAL (écran le plus riche, 1841 lignes)
- **Rôle** : créer/modifier un contrat en remplissant le **document officiel** (reproduction du contrat Word de l'agence), l'imprimer, scanner la version signée. Depuis : liste contrats (FAB « + » création, tap carte édition `{id}`), bouton « Contrat » d'un employeur, bouton « Placer » d'un employé (`{employe_id}` pré-sélection), RootStack `ContratDocumentModal`.
- **Structure** : 1) barre d'entités liées (édition) : chips « prénom nom » (bleu) et « nom employeur » (vert) → liens « Voir la fiche » / « Voir l'employeur » ; 2) onglets « Numérique » / « Scanné » (pastille verte si scan) ; 3) onglet Numérique : **sélecteurs Employé/Employeur (visibles seulement tant qu'un choix manque)** puis `A4Document` (2 pages) ; 4) onglet Scanné : aperçu ou « Aucun scan pour ce document » + bouton scan ; 5) modals de sélection.
- **Champs — PAGE 1 « EMPLOYE »** (en-tête : logo `assets/logo-agence.jpg`, « CHRISROI AGENCE », « PLACEMENT DE PERSONNELS – SERVICE DE NETTOYAGE – COURTAGE IMMOBILIER », « Tel : +225 27 22 34 22 83 / +225 05 03 97 47 75 », « DATE : » → `date_contrat` éditable, « DOSSIER N° : » → `numero_dossier` ou placeholder « CHR-<année>-____ ») :
  - « Nom et prénoms : » + photo d'identité (encadré 70×80, « PHOTO » si absente)
  - « Date et lieu de naissance : » (« à » entre les deux)
  - « Lieu d'habitation : » → `lieu_habitation` ; « Situation matrimoniale : » cases ■/□ **mutuellement exclusives « Marié(e) » / « Concubinage » / « Célibataire »** (défaut)
  - « Religion : » → `religion`, « Ethnie : » → `ethnie`, « Diplôme : » → `diplome`
  - « Date d'embauche : » → `date_embauche` ; clause statique **« Valable pour un (1) mois et non remboursable. »**
  - « A déjà travaillé : » (Oui/Non) ; si Oui → « Si oui, contact ancien patron : » → `contact_ancien_patron`
  - « PARENTS » : Père, Mère, « Domicile ou quartier du père : » → `domicile_parents`
  - « PERSONNES À CONTACTER EN CAS D'URGENCE » : 3 lignes « Nom et prénoms » + « Contact : »
  - « RESPONSABILITÉS » : **4 clauses employé** (respect de l'employeur ; responsabilité pénale vols/fraude ; « conclu pour une durée de ______ » ; « commence à courir à compter du ____20 sur une durée de »)
  - **Signatures** : « EMPLOYE » (sous-texte prénom nom), « CHRISROI AGENCE » (« Agent ChrisRoi »), « EMPLOYEUR » (nom employeur)
- **Champs — PAGE 2 « EMPLOYEUR »** (séparateur « ─ PAGE SUIVANTE ─ ») :
  - « Nom et Prénoms : », « Domicile et quartier : », « Contact : »
  - « Emploi proposé : » → `poste` ; « Salaire proposé : » → `salaire` + « F CFA »
  - **« Commission : » → `commission_fixe` éditable (défaut 15000) « FCFA »** ; clause statique « Commission : 15 000 FCFA - Valable pour un (1) mois et non remboursable. Transport pour le déplacement du personnel de l'agence (5000 FCFA) »
  - **« Frais transport » → `frais_transport` éditable (défaut 5000) « FCFA »**
  - Encadré bleu « Le tiers (1/3) du sur le premier salaire (montant prélever par l'employeur sur le salaire de l'employé(e)) » + **montant du tiers affiché automatiquement** (`Math.round(salaire/3)`, recalculé à chaque changement de salaire)
  - « RESPONSABILITÉS » : **8 clauses employeur** (connaître le domicile des parents ; tâche non signalée → annulation ; premiers soins + aviser les parents ; aviser CHRISROI AGENCE en cas de renvoi ; « payé au plus grand tard le 5 du mois » ; pas d'arriérés ; condamnation vol/bagarres/maltraitance/privation de nourriture/violence verbale/harcèlement sexuel/viol ; remplacement en une semaine max en cas d'abandon)
  - Signatures identiques à la page 1
- **Actions** :
  - **Sélecteurs** : modals « Sélectionner un employé » (prénom nom + sous-titre catégorie) / « un employeur » (nom + téléphone). **Auto-remplissage** : sélection employé → remplissage immédiat nom/prénom/photo (`getEmployePhotoUrl`) puis `getEmployeById` complet (parents, 3 urgences, expérience[0].contact, niveau_etude → diplome, lieu_residence, situation_matrimoniale, a_deja_travaille) ; employeur → nom/adresse/téléphone puis `getEmployeurById`.
  - **« Enregistrer »** → `handleSave` : employe_id + employeur_id obligatoires (« Champs requis ») ; envoi `salaire` (parseFloat||0), `commission_fixe` (parseInt||15000), `frais_transport` (parseInt||5000), `commission_agence` = tiers recalculé, `domicile_employe` = lieu_habitation ; `createContrat`/`updateContrat` ; Alert « Contrat créé »/« Contrat modifié » ; **pas de navigation — on reste pour imprimer/scanner**.
  - **« Imprimer »** → sauvegarde d'abord, impression web (copie du DOM réel `#a4-print-content`, `@page A4 15mm`), puis `handleAfterPrint` → **popup « Scanner le document ? »** (« Plus tard » / « Oui » → scan caméra) ; si non enregistré → « Enregistrez d'abord le contrat pour pouvoir scanner le document signé. »
  - **« Scanner le document signé »** (onglet Scanné) : natif = `launchCameraAsync` (qualité 0.85) ; web = input file caché ; `uploadScan('contrat', id, uri)` remplace l'ancien ; « Scanné le <date> ».
- **Règles** : `createContrat` côté service : numéro `CHR-<année>-<6 chars base62>`, statut `en_cours`, `commission_payee: false`, employé → `en_poste`, alerte « Commission à percevoir » si commission > 0, **rollback si échec post-création**.

### 7.9 Suivi commissions (SuiviScreen) — onglet « Commissions »

- **Rôle et accès** : suivi des commissions à percevoir + calendrier mensuel d'activité. Onglet « Commissions » ou cloche du Dashboard. Recharge à chaque focus + pull-to-refresh.
- **Structure** : 1) **calendrier mensuel** (composant `WeekCalendar`) ; 2) barre de stats 3 blocs : « À relancer » (compte, rouge), « En attente » (compte, ambre), « Total dû » (somme, bleu) ; 3) liste des commissions en 2 sections « ⚠️ À relancer (N) » puis « ⏳ En attente (N) » (sous-total « X F CFA » par section) ; 4) état vide « Tout est à jour ».
- **Champs/carte commission** (tapable) : avatar (rouge `alert-circle` si urgente, ambre `clock-outline` sinon) ; nom/prénom employé ; **badge « J+X »** (jours écoulés depuis l'échéance) ; nom employeur ; « {montant} F CFA » ; « Contrat signé le {date} » ; téléphone employeur.
- **Actions** : **« Appeler »** → `Linking.openURL('tel:…')` (numéro nettoyé `[0-9+]` ; bouton « Pas de numéro » sinon) ; **« Marquer payée »** → dialogue « Commission prélevée ? » → `marquerCommissionPayee(id, aujourd'hui)` ; tap carte → `ContratDocumentModal {id, origin: 'Commissions'}` ; tap événement calendrier → contrat (`contrat`/`fin_contrat`/`commission`) → `ContratDocumentModal` ; `inscription` → `EmployeDetail`.
- **Règles** : **délai de relance = 30 jours** (`DELAI_ATTENTE = 30`) — référence = `date_debut` sinon `date_contrat` sinon `created_at`, + 30 j. « En attente » = < 30 j ; « À relancer » = ≥ 30 j (urgent dès J+0). ⚠️ **Divergence avec le calendrier (+1 mois)** — point d'attention #10. Données : `getCommissionsAPercevoir()` (contrats `commission_payee = false && commission_agence > 0`, tri `-date_contrat`, expand employe/employeur), `getCalendarEvents(mois)`, `getContratsFinProche()` (fins J+7, filtrées en mémoire car PB n'a pas de fonctions SQL date) → fusionnées au calendrier avec `type: 'fin_contrat'`.

### 7.10 Alertes (AlertesScreen) — modale root

- **Rôle** : centre de notifications. Route `AlertesModal`. ⚠️ **Aucun point d'entrée actif** : la cloche du Dashboard pointe vers Suivi (le badge rouge ne mène pas ici).
- **Structure** : en-tête « {N} alerte(s) non lue(s) » + « Tout marquer » ; FlatList de cartes ; état vide « Aucune alerte ».
- **Champs/carte** : icône circulaire par type (`fin_contrat` → `calendar-clock` rouge ; `commission` → `cash` rose ; `nouvelle_demande` → `briefcase-plus` bleu ; défaut → `bell` ambre — ⚠️ les types réellement créés `fin_contrat_j7`/`fin_contrat_j3` tombent dans le cas défaut) ; titre (gras si non lu) ; message ; date ; pastille bleue si non lue ; bordure gauche ambre si non lue.
- **Actions** : tap carte → si non lue : `marquerAlerteLue(id)` puis navigation prioritaire : `contrat_id` → `ContratDocumentModal (origin 'Alertes')` ; sinon `employe_id` → `EmployeDetail` ; sinon `employeur_id` → `EmployeurDetail`. « Tout marquer » → `marquerToutesAlertesLues()`.

### 7.11 Paramètres (SettingsScreen) — modale root

- **Rôle** : profil, utilisateurs (admin), configuration, déconnexion. Ouvert depuis l'icône `account-outline` du Dashboard. Reçoit `user` + `onLogout` en props.
- **Structure** : 1) carte **Profil** (avatar initiales, prénom nom, email, rôle « Administrateur »/« Agent ») ; 2) carte **Gestion des utilisateurs** (admin uniquement) : « + » + liste (`getAllUsers()`, avatar, badge Admin/Agent, état vide « Aucun utilisateur ») ; 3) carte **Paramètres** (menu 5 entrées) ; 4) carte **Déconnexion** ; 5) footer « ChrisRoi Agence © {année} ».
- **Menu Paramètres** :
  - **« Scanner »** — sous-titre « Clé API configurée ✓ » ou « Configurer la clé API Gemini » → Dialog « Clé API Gemini » (champ masqué + œil ; « Entrez votre clé API Gemini (gratuite sur ai.google.dev). Utilisée pour scanner les documents. ») → `saveGeminiApiKey` (⚠️ **stockage local par appareil**, pas le serveur).
  - **« Serveur »** — sous-titre = URL courante ou « Non configuré » → Dialog « Serveur PocketBase » (champ URL, statut « ✓ Connexion réussie » / « ✗ Serveur injoignable », boutons « Tester » / « Enregistrer » — **enregistre même si le test échoue** (déplacement), message « Redémarrez l'application pour appliquer le changement »).
  - **« Notifications »** — « Gérer les alertes » — **inerte**.
  - **« Sauvegarde »** — « Exporter les données » — **inerte**.
  - **« À propos »** — « ChrisRoi Agence v1.0.0 » — **inerte**.
- **Dialog « Nouvel utilisateur »** (admin) : Nom, Prénom, Email, Mot de passe (masqué) ; « Ajouter » → `createUser({…, role:'agent'})`. ⚠️ La liste des users renvoie `[]` sur erreur 403 (dégradation propre).

### 7.12 Scanner IA (ScanScreen + ScanResultScreen) — modales root

#### 7.12.1 Scan (ScanScreen)
- **Rôle** : point d'entrée du scanner de documents papier (extraction IA Gemini). Route `Scan` (titre « Scanner un document »), ouverte via l'action rapide « Scanner » du Dashboard. Machine d'état `ScanState` : `pending → extracting → ready | error`.
- **Structure** : titre + sous-titre ; « Type de document » + 2 cartes : **« Fiche d'inscription »** (bleue, « Employé ») et **« Contrat de travail »** (verte, « Employé + Employeur ») ; zone d'extraction (spinner « Analyse du document en cours... » + vignette) ou carte d'erreur ; carte « Conseils pour un bon scan » (4 puces : document à plat sur fond contrasté, bien cadrer, bon éclairage, éviter les ombres).
- **Flux** : tap type → dialogue « Choisissez une source » (« 📷 Prendre une photo » / « 🖼️ Choisir dans la galerie » / « Annuler » ; permissions demandées à chaque fois) → `launchCameraAsync`/`launchImageLibraryAsync` (qualité 0.8, **base64: true**) → état `extracting` → `getGeminiApiKey()` (absente → « Configurez d'abord votre clé API Gemini dans Paramètres > Scanner. ») → `extractDocument(apiKey, uri, type, base64)` → succès : `navigate('ScanResult', {imageUri, documentType, extracted})` ; échec : carte d'erreur + « Erreur d'extraction ».
- **Backend Gemini** (`src/services/gemini.ts`) : modèle **`gemini-2.0-flash`**, endpoint `…/v1beta/models/gemini-2.0-flash:generateContent?key={apiKey}`, `temperature: 0.1`, `maxOutputTokens: 4096`, image en base64. Prompts français stricts (« Réponds UNIQUEMENT avec un JSON valide. Si un champ n'est pas visible, mets une chaîne vide. ») :
  - **Fiche** : nom, prenom, date_naissance, telephone, adresse, lieu_residence, nationalite, categorie_emploi, situation_matrimoniale, niveau_etude, religion, personne_contact, contact_urgence, nom_pere, nom_mere, taille, poids, ville_origine, peut_lire_ecrire (bool), experiences[] (entreprise/lieu/duree).
  - **Contrat** : employe (nom, prenom, telephone, adresse) ; employeur (nom_complet, type, telephone, adresse) ; contrat (poste, type_contrat, date_debut, date_fin, duree, salaire nombre FCFA, notes).
  - Normalisation : strip markdown ```json```, `JSON.parse`, défauts (`employeur_type: 'particulier'`, `type_contrat: 'heberge'`, `salaire: 0`). Erreurs : « Erreur Gemini ({status}) : {détail} », « Reponse Gemini vide. », « Erreur de parsing JSON : … ».

#### 7.12.2 Résultat du scan (ScanResultScreen)
- **Rôle** : validation (correction humaine) et création des données extraites. Reçoit `{imageUri, documentType, extracted}`.
- **Structure** : aperçu de l'image (hauteur 200) ; « Informations extraites — Vérifiez avant de créer » ; formulaire éditable (`FicheForm` ou `ContratForm`) ; « Créer le document » ; écran succès alternatif (« Document créé ! », « Retour »).
- **Formulaire Fiche** : Identité (Nom, Prénom, Date de naissance, Téléphone, Adresse, Lieu de résidence, Nationalité, Ville d'origine, Catégorie emploi) ; Informations complémentaires (Taille, Poids, Situation matrimoniale, Niveau d'étude, Religion) ; Contact d'urgence ; Parents.
- **Formulaire Contrat** : Employé (Nom, Prénom, Téléphone, Adresse) ; Employeur (Nom complet, Type, Téléphone, Adresse) ; Contrat (Poste, Type de contrat, Début/Fin/Durée, Salaire FCFA, Notes).
- **Création fiche** : `createEmploye` (mapping des champs extraits, défauts `nationalite: ''`, `photo_uri: ''`, expériences vides) + `personnes_urgence: [contact]` + boucle `addExperience` + `uploadScan('fiche_inscription', id, imageUri)`.
- **Création contrat** : 1) **Employé** : `searchEmployes(nom + prenom)` → **premier résultat réutilisé AUTOMATIQUEMENT (aucune confirmation UI)** ⚠️ ; sinon `createEmploye` (défauts) ; 2) **Employeur** : requête directe `nom_complet ~` → réutilisé si trouvé (try/catch silencieux) ; sinon `createEmployeur` ; 3) `createContrat` (commission auto, numéro auto) ; 4) `uploadScan('contrat', id, imageUri)`.
- **⚠️** : dédoublonnage silencieux (risque de rattacher au mauvais doublon) ; champs en texte libre (pas de sélecteurs) ; aucune validation de dates/salaire avant création.

### 7.13 Recherche globale (GlobalSearchScreen) — DashboardStack

- **Rôle** : recherche multi-entités (employés, employeurs, contrats). Route `GlobalSearch` (titre « 📁 Dossiers »). ⚠️ **Enregistrée mais sans point d'entrée actif** dans les écrans analysés.
- **Structure** : en-tête (titre, Searchbar « Rechercher : nom, téléphone, contrat... », chips de filtre) ; « 🔍 Résultats (N) » + « Trier » (inactif) ; cartes ; état vide « Aucun résultat ».
- **Filtres (chips)** : « Tout », « Employés », « Employeurs », « Contrats », « Urgent ».
- **Fonctionnement** : `Promise.all([getAllEmployes(), getAllEmployeurs(), getAllContrats()])` rechargé à chaque focus ET changement de requête ; filtrage **côté client** (`includes` minuscules) ; sans requête → tous les enregistrements affichés.
- **Cartes** : Employé (👤, avatar bleu, « prénom nom », « {catégorie} · {statut} », « 📞 téléphone », **« ⭐ 4.8 » — note factice codée en dur** ⚠️, « 📍 {ville} » ou **« 📍 Abidjan » — défaut codé en dur** ⚠️) ; Employeur (🏠/🏢, avatar violet, meta « {type} · {N} contrats actifs », « 💰 {N} contrats ») ; Contrat (📄, avatar orange, numero_dossier, « 📅 Fin dans {X}j » ou « En cours », « 💰 montant », « ⚠️ Urgent » si fin ≤ 7 j).
- **Tap** : Employé → `EmployeDetail` ; Employeur → `EmployeurDetail` ; Contrat → `ContratDocumentModal (origin 'Recherche')`.

### 7.14 Composants réutilisables notables

| Composant | Usage | Particularités |
|---|---|---|
| `A4Document` | Fiche + Contrat | Largeur fixe 600 px (ratio A4 210/297), double ScrollView (horizontal + vertical), toolbar « Enregistrer »/« Imprimer », `pageCount`. Impression web : copie du DOM `#a4-print-content` + `@page A4 15mm`. ⚠️ `onAfterPrint` appelé à l'ouverture de la fenêtre (pas à sa fermeture) ; pas de vraie impression native. |
| `WeekCalendar` (« MonthCalendar ») | SuiviScreen | Calendrier mensuel (le nom est trompeur, `weekStart` ignoré). **4 types** : inscription VERT `#22c55e`, contrat BLEU `#3b82f6`, commission AMBRE `#f59e0b`, fin_contrat ROUGE `#ef4444`. ⚠️ Mapping inverse de `CalendarGrid` (voir point #13). |
| `CalendarGrid` | — (inutilisé) | Grille mensuelle générique, **3 types** : inscription BLEU `#1A56DB`, contrat VERT `#059669`, commission ORANGE `#D97706` (conforme à `utils/calendar.ts`). |
| `UnifiedSearch` | — (inutilisé) | Barre de recherche + chips contrôlée (dont filtre « Disponible » absent de GlobalSearch). |
| `SafeButton` | Partout | Bouton avec effet `pressed` (style fonctionnel) — corrige le défaut de feedback visuel de Pressable. |
| `BackendDebugOverlay` | App.tsx (permanent) | Badge flottant → panneau « 🔍 Debug Backend » (voir section 10). |
| `DossiersCard`, `ActionCard`, `UrgentCard` | Dashboard | Cartes de la refonte Warm Earth. |
| `StatusBadge`, `InfoRow`, `SectionCard`, `FormField`, `StatCard`, `Timeline` | Divers | Blocs UI du thème legacy (bleu `#1A56DB`). |

---

## 8. Workflows métier complets

### 8.1 Inscrire un candidat (Fiche d'inscription)

1. Dashboard → carte **« Inscrire »** → `FicheInscriptionModal`.
2. Remplir le document A4 (identité, parents, urgences, expérience, emploi recherché).
3. Photo d'identité (optionnelle) : galerie/appareil → upload file field `photo` (après sauvegarde, l'id étant nécessaire).
4. **« Enregistrer »** → `createEmploye` (relations en parallèle, cleanup si échec) → « Employé inscrit ». L'écran reste ouvert.
5. **« Imprimer »** → l'agent fait signer la fiche → popup **« Scanner le document ? »** → photo de la fiche signée → `uploadScan('fiche_inscription', id)` (remplace l'ancien).
6. L'employé est `disponible` (défaut) et apparaît dans Dossiers + Dashboard.

### 8.2 Créer un contrat de placement

1. Dashboard → **« Créer un contrat »** (ou liste Contrats FAB, ou bouton « Placer »/« Contrat » depuis un employé/employeur).
2. Sélectionner **employé** et **employeur** (sélecteurs modaux, **auto-remplissage complet** du document : identité, parents, urgences, diplôme, situation matrimoniale, ancien patron).
3. Ajuster : poste, salaire (le **tiers s'affiche automatiquement**), dates, commission fixe (15 000), frais transport (5 000).
4. **« Enregistrer »** → `createContrat` : numéro `CHR-AAAA-XXXXXX`, statut `en_cours`, employé → `en_poste`, alerte « Commission à percevoir ».
5. **« Imprimer »** → signature → popup **« Scanner le document ? »** → scan du signé → `uploadScan('contrat', id)`.
6. Le contrat est listé (onglet Contrats) ; sa commission apparaît dans Suivi + Dashboard.

### 8.3 Suivre les commissions

1. Onglet **« Commissions »** (ou cloche du Dashboard) → SuiviScreen.
2. Calendrier : pastilles par jour (inscription vert, contrat bleu, commission ambre, fin contrat rouge — WeekCalendar).
3. Liste : sections « À relancer » / « En attente » (seuil 30 j), badge J+X.
4. **« Marquer payée »** → confirmation → `marquerCommissionPayee` (commission_payee, date_prelevement, alertes lues).
5. **« Appeler »** l'employeur directement depuis la carte.
6. Dashboard : carte « Suivi commissions » (Total perçu / En attente) + UrgentCard.

### 8.4 Gérer les fins de contrat

- Au chargement du Dashboard : `createFinContratAlertes()` crée les alertes **J-7** et **J-3** (dédupliquées).
- Dashboard → UrgentCard « Fin dans {X}j » → **« Proposer prolongation »** → `ContratDetail` ⚠️ (param `contratId` vs type `id`).
- Alertes visibles dans AlertesModal ⚠️ (pas de point d'entrée actif — la cloche va vers Suivi).
- « Terminer » (ContratDetail) → employé redevient `disponible`.

### 8.5 Scanner un document papier (IA Gemini)

1. Dashboard → **« Scanner »** → choix du type (Fiche / Contrat) → source (photo/galerie).
2. Extraction Gemini 2.0 Flash (JSON) → `ScanResult` : **correction humaine** des champs.
3. « Créer le document » → création PB (avec **dédoublonnage automatique** employé/employeur pour les contrats) + upload du scan.
4. Clé API : **locale par appareil** (Paramètres > Scanner), jamais sur le serveur.

### 8.6 Gérer les employeurs

- Onglet « Employeurs » : liste + filtres + « Trouver (N dispo) » + « Contrat » direct.
- Formulaire : 3 types (⚠️ pas « Organisation »), nom complet obligatoire.
- Détail : coordonnées, demandes, employés placés (⚠️ « Nouvelle demande » sans effet).

### 8.7 Recherche globale

- (Pas de point d'entrée actif détecté) — recherche sur employés/employeurs/contrats, filtres + « Urgent », note ⭐ factice.

---

## 9. Configuration & paramétrage

### 9.1 Écran Paramètres (modale root)

Voir 7.11 — clé Gemini locale, URL serveur, users (admin), déconnexion, 3 menus inertes.

### 9.2 Écran de connexion

Voir 7.1 — identifiants par défaut affichés, config serveur accessible sans auth.

### 9.3 Fichiers de config

| Fichier | Rôle |
|---|---|
| `app.json` | Identité app, permissions, cleartext, New Arch, edge-to-edge, icônes, splash |
| `src/database/pocketbase.ts` | `FIXED_LAN_IP`, port 8090, découverte, `setPocketBaseUrl` |
| `src/database/localSettings.*` | Persistance locale (SQLite natif / localStorage web) |
| `eas.json` | Profils de build EAS (preview…) |

---

## 10. Outils de diagnostic

### 10.1 BackendDebugOverlay

Badge flottant (bas droite, couleur = dernier log) avec le nombre de logs ; au tap, panneau « 🔍 Debug Backend » : liste des logs (étape, détail, horodatage, niveau coloré info/success/warn/error), bouton « Effacer ». Présent en permanence dans App.tsx.

### 10.2 Logs backend (`src/utils/backendLogger.ts`)

`logBackend(step, detail, level)` — utilisé par pocketbase.ts (connexion, découverte, health, URL) et service.ts. Abonnement temps réel (`subscribeToLogs`) pour l'overlay.

---

## 11. Points d'attention & limites actuelles

> Ces points sont **volontairement listés** : ce sont les candidats naturels aux prochaines décisions (corriger, retirer, ou garder en l'état).

| # | Point | Détail | Suggestion |
|---|---|---|---|
| 1 | **`WizardNouvelEmployeScreen` orphelin** | Écran présent (`src/screens/WizardNouvelEmployeScreen.tsx`, 384 lignes) mais **jamais enregistré** dans App.tsx ni navigation.ts → inaccessible. C'est une **maquette statique** : données factices (« Mme Fatou Koné », « Marie Diallo »), navigation avec `employe_id: 'TODO'`, score de compatibilité « 85 % » factice | Le brancher, l'adapter, ou le retirer |
| 2 | **`QuickActions` orphelin** | Composant `src/components/QuickActions.tsx` non importé par aucun écran | Le garder ou le retirer |
| 3 | **`pb-generated.ts` périmé** | Manquent : `scans`, `employes.photo`, `contrats.commission_fixe`, `contrats.frais_transport`, `contrats.date_prelevement`, `employes.ethnie`, option `concubinage` | Régénérer (`npm run types:pb`, serveur PB requis) |
| 4 | **`schema.ts` SQLite historique** | Ancien schéma SQLite local (PocketBase est la vérité) | Documenter ou supprimer |
| 5 | **Fonctions mortes dans service.ts** | `getServerUrl()`/`saveServerUrl()` écrivent sur `_superusers.pocketbase_url` → 403 en user normal | Supprimer ou réécrire |
| 6 | **`getDemandesByEmploye`** | Filtre sur `employe_id` mais `demandes_recrutement` n'a que `employeur_id` → retourne toujours vide | Corriger ou supprimer |
| 7 | **Types `src/types/index.ts` partiellement périmés** | `Employe` sans file field `photo` (utilisé par `uploadEmployePhoto`) ; `SituationMatrimoniale` sans `veuf`/`concubinage` ; `StatutEmploye` sans `en_attente` (pourtant filtré) ; `Alerte.type` sans `fin_contrat_j7/j3` | Harmoniser avec PB |
| 8 | **`EmployeFormScreen` : boutons inertes sur natif + édition incomplète** | `NavButton`/`ActionButton` n'attachent `onPress` que via `addEventListener('click')` (web-only) → **boutons morts sur iOS/Android** ; `updateEmploye` ignore parents/urgences/expériences/photo_uri → les modifs relations ne sont jamais persistées | Le retirer (la Fiche d'inscription le remplace) ou le corriger |
| 9 | **`ContratDetail` : boutons morts + paramètre incohérent** | « Modifier » → `goBack()` (trompeur) ; « Détails »/« Calendrier »/« Voir tout »/« Appeler »/« Prolonger » → Alert ; Dashboard envoie `params: { contratId }` mais le type déclare `ContratDetail: { id }` | Corriger les actions + uniformiser le paramètre |
| 10 | **30 jours vs 1 mois (commissions)** | SuiviScreen relance à **30 j** ; le calendrier marque l'échéance à **+1 mois** (ex: 31/01 → 28/02 ≠ 30 j) | Décider d'une règle unique |
| 11 | **Couleurs calendrier incohérentes** | `WeekCalendar` (utilisé) : inscription VERT, contrat BLEU, commission AMBRE, fin ROUGE ; `CalendarGrid` + `utils/calendar.ts` (inutilisé) : inscription BLEU, contrat VERT, commission ORANGE | Harmoniser (le calendrier visible impose le mapping réel) |
| 12 | **`AlertesModal` et `GlobalSearch` sans point d'entrée** | La cloche du Dashboard → onglet Suivi (pas AlertesModal) ; GlobalSearch n'a aucun accès visible | Brancher la cloche sur AlertesModal + un accès à la recherche, ou documenter l'intention |
| 13 | **Données factices dans GlobalSearch** | « ⭐ 4.8 » et ville par défaut « Abidjan » codés en dur (aucune donnée réelle de notation) | Retirer ou implémenter |
| 14 | **Settings : 3 menus inertes** | « Notifications », « Sauvegarde », « À propos » n'ont aucune action | Implémenter ou retirer |
| 15 | **Scan contrat : dédoublonnage silencieux** | Employé/employeur existants réutilisés **automatiquement** (1ᵉʳ résultat), aucune confirmation UI → risque de mauvais doublon ; aucune validation dates/salaire avant création | UI de choix + validation |
| 16 | **Boutons morts divers** | Loupe inerte (EmployesScreen) ; « Nouvelle demande » sans effet (EmployeurDetail) ; « Trouver »/« Contrat » dépendent du contexte | Passe d'assainissement |
| 17 | **Incohérences mineures UI** | ContratForm affiche `type_contrat` bruts ; EmployeurForm sans « Organisation » (la liste le filtre) ; ContratsScreen ouvre le Document au tap (pas le Détail) ; avatar EmployeDetail lit `photo_uri` (ancien champ) au lieu de `photo` ; `SITUATIONS_MATRIMONIALES` sans « Veuf » (label pourtant défini) | Harmoniser |
| 18 | **Web : PB injoignable** | Scan auto IP publique en web + CORS 127.0.0.1 → l'app web ne se connecte pas au PB local | Non bloquant (cible = APK) |
| 19 | **Changements non commités** | Refonte Warm Earth (Dashboard, Employes, Suivi, SafeButton, A4Document) non commitée sur `upgrade/sdk-54` | **Commit recommandé avant toute suite** |
| 20 | **Identifiants par défaut en clair** | LoginScreen affiche `admin@chrisroi.com / chrisroi2024` ; mot de passe superuser codé en dur dans `initDatabase` | À assumer (app interne) ou sécuriser |

---

## 12. Annexes

### 12.1 Catégories d'emploi (14)

| Valeur | Libellé | Valeur | Libellé |
|---|---|---|---|
| `serveuse` | Serveuse | `gouvernante` | Gouvernante |
| `chauffeur` | Chauffeur | `jardinier` | Jardinier |
| `femme_de_menage` | Femme de ménage | `domestique` | Domestique |
| `cuisinier` | Cuisinier | `cuisiniere` | Cuisinière |
| `vigil` | Vigil | `majordome` | Majordome |
| `nounou` | Nounou | `garde_malade` | Garde malade |
| `lingere` | Lingère | `autre` | Autre |

### 12.2 Niveaux d'étude (6)

`sait_lire_ecrire` (Sait lire et écrire), `primaire` (Primaire (CEPE)), `secondaire_1` (Secondaire 1er cycle (BEPC)), `secondaire_2` (Secondaire 2e cycle (BAC)), `superieur` (Supérieur), `aucun` (Aucun)

### 12.3 Types de contrat (3)

`heberge` (Hébergé sur place), `non_heberge` (Non hébergé), `personnalise` (Personnalisé)

### 12.4 Situations matrimoniales

Codes : `celibataire`, `marie`, `divorce`, `veuf`, `concubinage`. UI : 3 options (Célibataire/Marié(e)/Divorcé(e)) dans les formulaires ; **3 cases (Marié(e)/Concubinage/Célibataire)** dans le document de contrat.

### 12.5 Types d'employeur

`particulier` (Particulier), `entreprise` (Entreprise), `commerce` (Commerce), `organisation` (Organisation — non proposé au formulaire)

### 12.6 Statuts

- **Employé** : `disponible` (Disponible), `en_poste` (En poste), `indisponible` (Indisponible), (+ filtre `en_attente` dans la liste)
- **Contrat** : `en_cours` (En cours), `termine` (Terminé), `annule` (Annulé — non déclenché par l'UI)
- **Couleurs** : disponible/en_cours vert `#4CAF50`, en_poste bleu `#2196F3`, indisponible/annule rouge `#F44336`, en_attente/termine orange `#FF9800`

### 12.7 Comptes & accès

- Superuser PB : `admin@chrisroi.com` / `chrisroi2024` (init/seed uniquement)
- User app : `admin@chrisroi.com` / `chrisroi2024`
- Serveur : `http://192.168.1.6:8090` (IP fixe actuelle — réservation DHCP recommandée)

### 12.8 Commandes utiles

```bash
npm start                 # démarre Metro (l'utilisateur lance lui-même)
pocketbase.exe serve      # démarre PocketBase (l'utilisateur lance lui-même)
npm run typecheck         # tsc --noEmit (vérification locale)
npx expo export --platform web  # vérification bundler sans APK
npm run types:pb          # régénère src/types/pb-generated.ts (serveur PB requis)
EAS_NO_VCS=1 npx eas build -p android --profile preview --non-interactive --no-wait  # build APK
```

### 12.9 Logique de recherche / filtres client-side

- **Employés** (liste) : `prenom+nom`, `telephone`, libellé catégorie, `lieu_residence` — filtres statut avec compteurs.
- **Employeurs** : `nom_complet`, `nom_contact`+`prenom_contact`, `telephone`, `email`, `adresse`, `ville`, `quartier` — filtres types dynamiques.
- **Contrats** : `numero_dossier`, noms employé, nom employeur, `poste` — filtres statut/type/commission.
- **Globale** : `includes` minuscules sur les concaténations de champs par type (3 collections chargées en mémoire).

---

*Fin du document — état juillet 2026, branche `upgrade/sdk-54`.*
