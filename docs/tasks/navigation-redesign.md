# Navigation Redesign Plan

## Architecture cible

```
App (NavigationContainer)
├── LoginScreen (plein écran, pas de tab/stack)
└── TabNavigator (4 tabs)
    ├── 📊 DashboardTab → Stack
    │   ├── DashboardScreen (accueil avec stats, calendrier)
    │   ├── AlertesScreen (modal/sheet depuis header)
    │   └── SettingsScreen (modal depuis avatar)
    ├── 👥 EmployesTab → Stack
    │   ├── EmployesScreen (liste + FAB)
    │   ├── EmployeFormScreen (modal)
    │   └── EmployeDetailScreen
    ├── 🏢 EmployeursTab → Stack
    │   ├── EmployeursScreen (liste + FAB)
    │   ├── EmployeurFormScreen (modal)
    │   └── EmployeurDetailScreen
    └── 📋 ContratsTab → Stack
        ├── ContratsScreen (liste + FAB)
        ├── ContratFormScreen (modal)
        └── ContratDetailScreen
```

## Phases

### Phase 1: Types navigation
- Créer `src/types/navigation.ts` avec tous les paramètres typés
- Remplacer tous les `useNavigation<any>()`

### Phase 2: App.tsx restructuration
- 4 tabs au lieu de 6
- Alertes et Settings deviennent des modales accessibles depuis le header
- headerShown: true partout

### Phase 3: Headers écrans
- Dashboard: header custom avec badge alertes + avatar
- Listes: titre + search
- Détails: titre dynamique + back

### Phase 4: FAB + Animation
- FAB consistent (Employés déjà, ajouter Dashboard)
- Animations de transition
- Fix TouchableOpacity pour web
