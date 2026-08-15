# PLAN DE REFONTE — ChrisRoi Agence (Personnel Domestique)

## Contexte
L'agence ne place pas des cadres ou professionnels diplômés, mais du **personnel de maison** :
- **Travailleurs** : nounous, serveuses, chauffeurs, vigiles, femmes de ménage, cuisiniers, jardiniers, gouvernantes — personnes qui savent lire et écrire, rarement au-delà du second cycle
- **Employeurs** : majoritairement des **particuliers** cherchant du personnel pour leur maison, parfois des petits commerces (restaurants, magasins)
- **Contrats** : pas de CDI/CDD mais **hébergé sur place**, **non hébergé**, **personnalisé**

---

## Phase 1 — Types de contrat (hébergé/non-hébergé/personnalisé)

### 1.1 Types · `src/types/index.ts`
- [ ] Remplacer `type_contrat: 'CDD' | 'CDI'` (ligne 119) par `type_contrat: 'heberge' | 'non_heberge' | 'personnalise'`

### 1.2 Constants · `src/utils/constants.ts`
- [ ] Remplacer `TYPES_CONTRAT` (lignes 113-116) :
  ```ts
  { value: 'heberge', label: 'Hébergé sur place' },
  { value: 'non_heberge', label: 'Non hébergé' },
  { value: 'personnalise', label: 'Personnalisé' },
  ```

### 1.3 FormContrat · `src/screens/ContratFormScreen.tsx`
- [ ] Modifier le type `formData.type_contrat` (ligne 50) : `'heberge' | 'non_heberge' | 'personnalise'`
- [ ] Remplacer le `SegmentedButtons` (lignes 366-384) pour 3 options au lieu de 2
- [ ] Supprimer la logique conditionnelle `formData.type_contrat === 'CDD'` (lignes 395-402) — la date de fin est toujours optionnelle maintenant
- [ ] Mettre à jour `handleSubmit` (ligne 98) : valeur par défaut `'heberge'` au lieu de `'CDD'`
- [ ] Mettre à jour `onValueChange` (ligne 369) : `value as 'heberge' | 'non_heberge' | 'personnalise'`

### 1.4 ContratDetail · `src/screens/ContratDetailScreen.tsx`
- [ ] Remplacer l'affichage `|| 'CDI'` (lignes 180, 73) — ne plus afficher CDI comme fallback de date_fin vide
- [ ] Afficher le libellé du type de contrat au lieu de la valeur brute

### 1.5 ContratsScreen · `src/screens/ContratsScreen.tsx`
- [ ] Remplacer `|| 'CDI'` (ligne 85) pour l'affichage de la date de fin
- [ ] Ajouter un indicateur du type de contrat (hébergé/non-hébergé/perso) dans chaque carte

### 1.6 Service DB · `src/database/service.ts`
- [ ] Mettre à jour la valeur par défaut `type_contrat: contrat.type_contrat || 'heberge'` (ligne 445)

### 1.7 Schema SQLite · `src/database/schema.ts` (si encore utilisé)
- [ ] Remplacer `DEFAULT 'CDD'` par `DEFAULT 'heberge'` (ligne 117)

### 1.8 Alerte fin de contrat
- [ ] Vérifier que `getContratsFinProche` utilise toujours `date_fin` — pour hébergé/non-hébergé, une date de fin est optionnelle. Ne pas alerter sur les contrats sans date_fin.

---

## Phase 2 — Profil Employeur (Particuliers)

### 2.1 Types · `src/types/index.ts`
- [ ] Remplacer `nom_entreprise` par `nom_complet` (ou ajouter un champ `prenom_employeur`)
- [ ] Remplacer `secteur_activite` par `type_besoin: 'particulier' | 'entreprise' | 'commerce'`
- [ ] Ajouter `prenom_contact` (séparé du nom)

### 2.2 Formulaire Employeur · `src/screens/EmployeurFormScreen.tsx`
- [ ] Remplacer "Nom de l'entreprise" → "Nom complet" avec sous-titre explicateur
- [ ] Remplacer "Secteur d'activité" → "Type d'employeur" (Particulier / Entreprise / Commerce)
- [ ] Adapter les placeholders et labels

### 2.3 Détail Employeur · `src/screens/EmployeurDetailScreen.tsx`
- [ ] Adapter l'affichage : `nom_entreprise` → `nom_complet` + `prenom_contact`
- [ ] Remplacer icône `office-building` par `account` si particulier
- [ ] Afficher le type d'employeur

### 2.4 Liste Employeurs · `src/screens/EmployeursScreen.tsx`
- [ ] Adapter la recherche et l'affichage
- [ ] Montrer le type (particulier/entreprise)

### 2.5 Service DB · `src/database/service.ts`
- [ ] Mettre à jour `createEmployeur` (ligne 335) : champs `nom_complet`, `prenom_contact`, `type_besoin`
- [ ] Mettre à jour `getEmployeurById` et autres fonctions

### 2.6 Carte Dashboard · `src/screens/DashboardScreen.tsx`
- [ ] Adapter les labels si nécessaire

### 2.7 Schema · `src/database/schema.ts`
- [ ] Mettre à jour les colonnes SQLite

### 2.8 Navigation (Tab "Employeurs")
- [ ] Renommer l'onglet "Employeurs" → "Employeurs" (inchangé)
- [ ] Vérifier que les labels textuels dans `App.tsx` (ligne 123) sont corrects

---

## Phase 3 — Catégories d'emploi élargies

### 3.1 Types · `src/types/index.ts`
- [ ] Ajouter les catégories manquantes au type `CategorieEmploi` :
  - `jardinier`, `gouvernante`, `domestique`, `cuisiniere` (ou séparer cuisinier/cuisinière)

### 3.2 Constants · `src/utils/constants.ts`
- [ ] Ajouter dans `CATEGORIES_EMPLOI` et `getCategorieLabel` :
  ```ts
  jardinier: 'Jardinier',
  gouvernante: 'Gouvernante',
  domestique: 'Domestique',
  cuisiniere: 'Cuisinière',
  ```

### 3.3 Formulaires employés
- [ ] Vérifier que le dropdown/modal de sélection de catégorie supporte les nouvelles valeurs
- [ ] Adapter les filtres de recherche

---

## Phase 4 — Niveau d'étude adapté

### 4.1 Constantes · `src/utils/constants.ts`
- [ ] Créer une liste `NIVEAUX_ETUDE` avec des valeurs réalistes :
  ```ts
  { value: 'sait_lire_ecrire', label: 'Sait lire et écrire' },
  { value: 'primaire', label: 'Primaire (CEPE)' },
  { value: 'secondaire_1', label: 'Secondaire 1er cycle (BEPC)' },
  { value: 'secondaire_2', label: 'Secondaire 2e cycle (BAC)' },
  { value: 'superieur', label: 'Supérieur' },
  { value: 'aucun', label: 'Aucun' },
  ```

### 4.2 Formulaire Employé · `src/screens/EmployeFormScreen.tsx`
- [ ] Remplacer le champ texte libre `niveau_etude` (lignes 427-428) par un dropdown/sélecteur avec les valeurs ci-dessus

### 4.3 Détail Employé · `src/screens/EmployeDetailScreen.tsx`
- [ ] Mettre à jour l'affichage (ligne 139) pour utiliser le libellé via constants

---

## Phase 5 — Vocabulaire & labels transverses

### 5.1 ContratsScreen
- [ ] Remplacer "Entreprise" par "Employeur" dans les labels et l'affichage
- [ ] Partout où `nom_entreprise` est affiché, utiliser plutôt le nom complet

### 5.2 ContratFormScreen & ContratDetailScreen
- [ ] Adapter les labels "Poste" → "Poste / Type de service"
- [ ] Adapter "Entreprise" → "Employeur"

### 5.3 DashboardScreen
- [ ] Vérifier tous les textes "entreprise"
- [ ] Adapter les alertes fin de contrat

### 5.4 Alertes
- [ ] Vérifier les textes des alertes automatiques dans `service.ts`

### 5.5 Export web
- [ ] Vérifier le template HTML statique dans `ContratDetailScreen.tsx` (lignes 63-94)
- [ ] Mettre à jour les textes "Entreprise" → "Employeur"

---

## Phase 6 — PocketBase (schéma BD serveur)

### 6.1 Collection `employeurs`
- [ ] Ajouter champs : `type_besoin` (particulier/entreprise/commerce), `prenom_contact` (séparé)
- [ ] Rendre `nom_entreprise` → `nom_complet` optionnel avec un label adapté

### 6.2 Collection `contrats`
- [ ] Mettre à jour le type de contrat : `'heberge' | 'non_heberge' | 'personnalise'`

### 6.3 Collection `employes`
- [ ] `niveau_etude` : pas de changement structurel, mais adaptation des valeurs possibles

### 6.4 Seed admin
- [ ] Vérifier que le seed dans `service.ts` (lignes 20-33) fonctionne toujours

---

## Phase 7 — Tests & validation

### 7.1 Build web
- [ ] `npx expo export --platform web` après chaque phase
- [ ] Vérifier qu'aucune erreur TypeScript (`npx tsc --noEmit`)

### 7.2 Test serveur
- [ ] Lancer `npx serve dist` et vérifier le rendu

### 7.3 Vérification fonctionnelle
- [ ] Créer un employé avec nouveau niveau d'étude
- [ ] Créer un employeur particulier
- [ ] Créer un contrat hébergé/non-hébergé/personnalisé
- [ ] Vérifier les alertes sur les fins de contrat

---

## Ordre d'exécution recommandé

```
Phase 1 (Types contrat) → Phase 4 (Niveau étude) → Phase 3 (Catégories)
  → Phase 2 (Employeurs particuliers) → Phase 5 (Labels transerves)
    → Phase 6 (PocketBase) → Phase 7 (Validation)
```

Les Phases 1 et 4 sont les plus rapides et les plus indépendantes.  
La Phase 2 a le plus d'impact UI.  
On valide avec `tsc --noEmit` + `expo export --platform web` après chaque phase.
