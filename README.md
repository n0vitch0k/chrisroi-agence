# ChrisRoi Agence - Application Mobile Android

Application de gestion pour l'agence de placement de personnel ChrisRoi, cible APK Android.

## Fonctionnalités

- Gestion des employés (inscription complète, photo, parents, urgences, expériences)
- Gestion des employeurs (entreprises, contacts, demandes)
- Gestion des contrats CDD/CDI avec commission automatique (1/3 du premier salaire)
- Alertes : fin de contrat proche, commissions à percevoir, nouvelles demandes
- Tableau de bord temps réel
- Impression de contrat via `expo-print`

## Stack

- Expo SDK 52 / React Native 0.76.9
- TypeScript
- Expo SQLite
- Expo Image Picker
- React Navigation
- React Native Paper
- Expo Print

## Prérequis

- Node.js 18+
- Java JDK 17
- Android SDK (cmdline-tools)
- Émulateur Android ou device physique en mode debug

## Installation

```bash
npm install
```

## Lancer sur Android

```bash
# Démarrer Expo
npx expo start

# Dans le tunnel/terminal Expo, appuyer sur :
# - a : lancer sur Android (émulateur ou device)
```

## Compilation APK

```bash
# Build local via EAS (nécessite eas-cli et un compte Expo)
eas login
eas build -p android --profile preview
```

> Le profile `preview` d'`eas.json` génère un APK (`buildType: apk`).
> Pour un App Bundle Play Store, utiliser `--profile production`.

## Identifiants par défaut

- Email : admin@chrisroi.com
- Mot de passe : chrisroi2024

## Notes

- Le stockage est local via SQLite (`expo-sqlite`).
- La prise de photo est gérée par `expo-image-picker` en natif Android.
- L'impression utilise `expo-print` en environnement natif.
