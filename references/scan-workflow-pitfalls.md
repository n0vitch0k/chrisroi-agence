# Scan Workflow Pitfalls

## 1. SafeButton n'a pas de prop `icon`
SafeButton (src/components/SafeButton.tsx) n'accepte **pas** de prop `icon`. Utiliser l'icône séparément avec un View ou utiliser Icon + Text + les props Style de SafeButton.

## 2. getPocketBaseUrl() n'est pas dans service.ts
La fonction `getPocketBaseUrl()` est dans `../database/pocketbase`, **pas** dans service. Importer depuis le bon module : `import { getPocketBaseUrl } from '../database/pocketbase'`.

## 3. uploadScan existe déjà dans service.ts
Ne pas ré-implémenter uploadScan dans ScanResultScreen. Importer depuis service : `import { uploadScan } from '../database/service'`. Sa signature : `uploadScan(documentType: 'fiche_inscription' | 'contrat', documentId: string, imageUri: string | File)`.

## 4. Type object properties sur une même ligne
TypeScript exige `;` ou `,` entre les propriétés de type sur la même ligne :
```typescript
// ❌ Erreur
imageUri: string  documentType: DocumentType;

// ✅ Correct
imageUri: string; documentType: DocumentType;
```

## 5. Suppression de code avec execute_code
Quand on filtre/supprime des lignes dans execute_code, vérifier qu'on n'emporte pas accidentellement le `return` et le JSX. Préférer `patch` pour les suppressions ciblées.

## 6. `***` au lieu de `string` dans les types
Le marqueur `***` apparaît quand on écrit manuellement des annotations de type avec `imageUri` - c'est un bug de saisie répétée. Vérifier avec `xxd` ou `cat -A` après chaque écriture.

## 7. Dynamic import de pocketbase dans ScanResultScreen
Ne pas utiliser `await import('../database/pocketbase')` — utiliser un import statique en haut du fichier. Les imports dynamiques sont supportés en React Native/Expo mais mal typés en TypeScript.
