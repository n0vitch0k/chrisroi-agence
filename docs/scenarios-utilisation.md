# Scénarios d'Utilisation — ChrisRoi Agence

> **Objectif** : Ce document décrit comment l'application facilite le travail quotidien du personnel de l'agence de placement. Chaque scénario part d'un besoin métier concret et montre comment l'app y répond.

---

## 1. Profils Utilisateurs

| Rôle | Besoin principal | Fréquence |
|------|-----------------|-----------|
| **Agent de placement** | Inscrire des candidats, les placer chez des employeurs, suivre les contrats | Quotidien |
| **Responsable d'agence** | Vision globale de l'activité, suivi des commissions, alertes | Quotidien |
| **Assistant administratif** | Saisie des dossiers, documents, suivi des paiements | Hebdomadaire |

---

## 2. Dashboard — Le centre de commandement

### Scénario 2.1 : Prise de poste le matin

**Agent arrive au bureau.** Il ouvre l'app et voit :

- ✅ **Bonjour, Prénom** — message personnalisé qui confirme son compte actif
- ✅ **Calendrier de la semaine** — d'un coup d'œil : inscriptions, contrats signés, fin de contrats, commissions à percevoir par jour
- ✅ **Urgences** — contrats qui se terminent dans ≤7 jours, commissions impayées, profils disponibles
- ✅ **Timeline "Aujourd'hui"** — les 5 actions les plus importantes du jour ordonnées par priorité
- ✅ **Dossiers actifs** — les contrats en cours qui demandent une attention immédiate

**Ce que l'agent peut faire immédiatement :**
- Cliquer sur un jour du calendrier → voir tous les événements du jour
- Cliquer sur un contrat qui finit → aller directement à la page détail pour le prolonger
- Voir le nombre d'alertes non lues dans le badge 🔔

### Scénario 2.2 : Détection d'un problème

**L'agent voit un point rouge 🔴 sur le calendrier.** Il clique sur le jour → un contrat se termine dans 2 jours. Il clique dessus → il arrive sur la fiche contrat avec les boutons "Prolonger" et "Voir dossier".

**Rien à faire aujourd'hui** = la timeline est vide, pas d'urgences. L'agent consulte le calendrier pour planifier sa semaine.

---

## 3. Gestion des Employés (Candidats)

### Scénario 3.1 : Inscription rapide d'un nouveau candidat

**Un candidat se présente à l'agence.** En 5 minutes, l'agent :

1. **Onglet Employés → "Nouvel Employé"** (ou via QuickActions sur le Dashboard)
2. Saisit les infos personnelles (nom, prénom, téléphone, adresse, nationalité, situation matrimoniale)
3. Sélectionne la **catégorie d'emploi** (chauffeur, gardien, aide-ménagère, cuisinier, etc.)
4. Ajoute les parents ou les **personnes à contacter en cas d'urgence** (optionnel mais recommandé)
5. Renseigne l'**expérience professionnelle** et les formations
6. Confirme → le candidat est enregistré avec le statut **"disponible"**

**Résultat** : Le candidat apparaît immédiatement dans la liste des employés disponibles, dans les statistiques du Dashboard, et est visible dans la recherche globale.

### Scénario 3.2 : Assistant d'inscription guidé (Wizard)

**Nouvel agent, pas encore familier avec le processus.** L'app propose un **assistant multi-étapes** :

1. **Étape 1 — Infos personnelles** : nom, prénom, contact, pièces d'identité
2. **Étape 2 — Expérience** : emplois précédents, stages, formations, motivation
3. **Étape 3 — Contrat** : catégorie, disponibilité, prétentions salariales
4. **Étape 4 — Validation** : récapitulatif avant enregistrement

**Bénéfice** : L'agent suit un fil conducteur, ne saute aucune information obligatoire, et gagne en confiance.

### Scénario 3.3 : Mise à jour du statut d'un employé

**Un employé placé.** L'agent :
1. Cherche l'employé dans la liste (ou recherche globale)
2. Ouvre sa fiche détail
3. Voit son historique : date d'inscription, contrats passés, statut actuel
4. Les champs clés sont visibles : catégorie, téléphone, disponibilité

**Un employé recontacte** : l'agent met à jour son téléphone ou son lieu de résidence en un clic sur le formulaire.

### Scénario 3.4 : Recherche d'un employé par critères

**Un employeur demande un chauffeur avec 5 ans d'expérience.** L'agent :
1. Utilise la **recherche globale** (accessible depuis le Dashboard ou la barre de recherche)
2. Filtre par catégorie "chauffeur"
3. Parcourt les profils avec les expériences visibles dans les résultats
4. Trouve 3 candidats → va directement à leur fiche détail

---

## 4. Gestion des Employeurs (Entreprises)

### Scénario 4.1 : Enregistrement d'un nouvel employeur

**Une entreprise contacte l'agence pour recruter.** L'agent :

1. **Onglet Employeurs → "Nouvel Employeur"**
2. Saisit : nom de l'entreprise, adresse, téléphone, email
3. Ajoute le **contact principal** (nom, prénom) — la personne qui suit le dossier côté entreprise
4. Prend des notes sur le **type de besoin** (gardiennage, entretien, chauffeur…)
5. Enregistre → l'employeur est actif, peut recevoir des propositions de candidats

### Scénario 4.2 : Suivi d'un employeur existant

**L'agent consulte l'historique d'un employeur.** Il voit :
- Tous les contrats en cours et passés
- Les demandes de recrutement en attente
- Les montants des commissions versées et impayées
- Les coordonnées à jour pour recontacter facilement

---

## 5. Gestion des Contrats (Placement)

### Scénario 5.1 : Création d'un contrat de placement

**L'agent a trouvé un candidat "disponible" et un employeur avec un besoin.** Il crée le contrat :

1. **Onglet Contrats → "Nouveau Contrat"**
2. Sélectionne l'employé (recherche automatique)
3. Sélectionne l'employeur
4. Définit : poste, salaire, type de contrat (hébergé/sans hébergement), date de début, durée
5. Indique la **commission agence** et les frais de dossier
6. Enregistre → le contrat est créé, l'employé passe automatiquement en statut **"en_poste"**

**Résultat** : L'employeur est facturé, l'employé est placé, l'agent suit la commission.

### Scénario 5.2 : Fin de contrat et prolongation

**Un contrat arrive à son terme.** Le Dashboard le signale (point rouge 🔴). L'agent :

1. Clique sur le contrat depuis le calendrier ou les dossiers actifs
2. Voit les détails : employé, employeur, salaire, date de fin
3. Si l'employeur veut prolonger → bouton **"Prolonger"** → met à jour la date de fin
4. Si le contrat se termine → bouton **"Terminer"** → l'employé repasse en "disponible"

### Scénario 5.3 : Suivi des commissions

**L'agent veut savoir combien l'agence doit encore percevoir.**

- Dans le Dashboard, les **commissions à percevoir** sont affichées dans les urgences et le calendrier
- Le compteur "commissions à percevoir" est mis à jour en temps réel
- Quand l'employeur paie → l'agent clique **"Marquer payée"** → la commission disparaît des alertes

### Scénario 5.4 : Alerte automatique de fin de contrat

**Le système détecte automatiquement** :
- Les contrats qui finissent dans ≤7 jours → crée une alerte
- Les commissions impayées → les signale
- Les employés sans contrat depuis longtemps → trace une alerte

L'agent voit le badge 🔔 sur l'icône de notification, accède à l'écran Alertes, et traite chaque item.

---

## 6. Recherche Globale — Trouver tout, partout, instantanément

### Scénario 6.1 : L'agent cherche un dossier sans se rappeler le type

**Un employeur appelle, l'agent doit retrouver le dossier rapidement.**

1. Depuis le Dashboard → bouton "Voir tout" dans Dossiers actifs (ou la loupe)
2. Tape juste quelques lettres : nom, téléphone, numéro de dossier…
3. **Résultats en temps réel** : employés, employeurs, contrats — tout apparaît mélangé
4. L'agent clique sur le bon résultat → arrive directement sur la fiche

**Bénéfice** : Pas besoin de savoir si c'est un employé ou un contrat. Un seul champ de recherche pour tout.

---

## 7. Administration et Paramètres

### Scénario 7.1 : Profil et préférences de l'agent connecté

**L'agent clique sur son avatar (icône 👤 en haut à droite).**
- Voit ses informations de connexion (nom, email, rôle)
- Peut changer son mot de passe
- Voit le serveur auquel il est connecté

### Scénario 7.2 : Gestion des utilisateurs (pour le responsable)

**Le responsable d'agence** peut :
- Ajouter un nouvel agent (nom, email, mot de passe, rôle)
- Lister tous les utilisateurs actifs
- Désactiver un compte si nécessaire

---

## 8. Principes UX — Ce qui rend l'app "facile" au quotidien

### 8.1 Interface pensée pour l'action

| Principe | Application dans l'app |
|----------|----------------------|
| **Tout est à 1 ou 2 clics** | Dashboard → calendrier cliquable → détail contrat. Pas de navigation à 4 niveaux |
| **Les urgences sont visibles sans cliquer** | Badge 🔔, points rouges 🔴 sur le calendrier, section Urgences du Dashboard |
| **Recherche unique** | Un seul champ cherche dans employés + employeurs + contrats |
| **Actions rapides** | 3 boutons sur le Dashboard pour créer (Employé, Contrat, Employeur) |
| **Le calendrier comme outil** | Pas décoratif : cliquable, avec des vraies données, navigation entre semaines |

### 8.2 Feedback immédiat

| Action | Feedback |
|--------|----------|
| Création d'un employé | Apparaît dans la liste, compteur Dashboard mis à jour |
| Création d'un contrat | Statut employé → "en_poste", événement ajouté au calendrier |
| Commission payée | Disparaît des alertes, sommes mises à jour |
| Refresh (pull-to-refresh) | Toutes les données se rafraîchissent |
| Erreur réseau | Message clair : "Vérifiez que le serveur tourne" |

### 8.3 Prévention des erreurs

- **Validation des formulaires** avant enregistrement (champs obligatoires, formats)
- **Messages d'erreur traduits** en français compréhensible (pas de "400 Bad Request" ou "NetworkError")
- **Confirmation avant destruction** (fin de contrat, suppression)
- **États vides** : "Créez un contrat pour commencer" au lieu d'une page blanche

### 8.4 Cohérence graphique

- **Harmonie des couleurs** : thème bleu primaire, avec code couleur sémantique :
  - 🔴 Rouge = urgent / danger (fin contrat imminente)
  - 🟠 Orange = avertissement (commission à percevoir)
  - 🟢 Vert = succès / disponible
  - 🔵 Bleu = information / contrat
- **Cards arrondies, ombres douces** : chaque section respire visuellement
- **Typographie structurée** : tailles de texte hiérarchisées (h1 → caption)

### 8.5 Navigation fluide entre les modules

| Départ → Arrivée | Pourquoi |
|------------------|----------|
| Calendrier → Détail contrat | Un clic sur un événement "Fin contrat" amène directement au contrat |
| Dashboard → Employé/Contrat/Employeur (création) | QuickActions en haut du Dashboard |
| Recherche globale → N'importe quelle fiche | Résultat cliquable → fiche détail |
| Alerte → Dossier concerné | Cliquer sur une alerte → contrat/employé associé |

---

## 9. Flows Transverses (Cas complexes)

### Scénario 9.1 : Placement complet — de l'inscription à la commission

**Parcours complet d'un placement réussi :**

1. **Agent recoit un candidat** → l'inscrit (Employés)
2. **Agent recoit une demande employeur** → enregistre l'employeur (Employeurs)
3. **Agent match le candidat à l'employeur** → crée le contrat (Contrats)
   - L'employé passe en "en_poste"
   - Le calendrier enregistre l'événement
4. **Agent suit le contrat** → Dashboard montre la fin du contrat quand approche
5. **Commission due** → Dashboard signale, l'agent relance l'employeur
6. **Commission payée** → l'agent marque payée, l'alerte disparaît
7. **Fin ou prolongation** → l'agent agit depuis le Dashboard

### Scénario 9.2 : Prise de fonction d'un nouvel agent

**Un nouvel agent arrive à l'agence.**

1. Le responsable le crée dans **Settings → Gestion des utilisateurs**
2. Le nouvel agent se connecte avec ses identifiants
3. Il atterrit sur le **Dashboard** : voit le calendrier, les urgences, les stats
4. Il explore les **QuickActions** pour créer son premier employé
5. Il suit l'**assistant Wizard** pour être guidé pas à pas
6. En cas de doute, la **recherche globale** lui permet de retrouver n'importe quoi

---

## 10. Pistes d'Amélioration Futures

_Ce que l'app pourrait faire pour être encore plus utile :_

| Idée | Bénéfice |
|------|----------|
| **Notifications push** (email/téléphone) quand un contrat finit dans 3 jours | L'agent n'a pas besoin d'ouvrir l'app pour être alerté |
| **Filtres avancés** dans la liste employés (par catégorie + disponibilité + expérience) | Trouver le bon candidat en 2 clics au lieu de 5 |
| **Génération de documents PDF** (contrat, fiche employé, attestation) | Plus besoin de retaper dans Word |
| **Statistiques mensuelles** (nombre de placements, commissions totales, évolution) | Rapports pour la direction sans Excel |
| **Mode hors-ligne** (cache local) | Utilisable même sans connexion internet |
| **Export CSV** des listes | Partage de données avec Excel |
| **Thème nuit** | Confort visuel en soirée |

