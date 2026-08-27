// ─── Types de navigation ───────────────────────────────────
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps, BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, CompositeNavigationProp } from '@react-navigation/native';

// Utilisateur connecté
export interface UserInfo {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
}

// ─── Root Stack (modales au-dessus des tabs) ────────────────
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  AlertesModal: undefined;
  SettingsModal: undefined;
  ContratDocumentModal: { id?: string; employe_id?: string; origin?: OriginInfo } | undefined;
  FicheInscriptionModal: { id?: string; origin?: OriginInfo } | undefined;
  JournalModal: undefined;
  Scan: undefined;
  ScanResult: {
    imageUri: string;  documentType: 'fiche_inscription' | 'contrat';
    extracted: any;
  };
};

export type OriginInfo = {
  label: string;
};

// ─── Tabs ──────────────────────────────────────────────────
export type TabParamList = {
  DashboardStack: NavigatorScreenParams<DashboardStackParamList>;
  EmployesStack: NavigatorScreenParams<EmployesStackParamList>;
  /** Onglet redirigeant vers l'écran Dossier, section Employeurs. */
  EmployeursTab: NavigatorScreenParams<EmployesStackParamList>;
  /** Onglet redirigeant vers l'écran Dossier, section Contrats. */
  ContratsTab: NavigatorScreenParams<EmployesStackParamList>;
  SuiviStack: NavigatorScreenParams<SuiviStackParamList>;
};

// ─── Dashboard ─────────────────────────────────────────────
export type DashboardStackParamList = {
  DashboardMain: undefined;
  GlobalSearch: undefined;
};

// ─── Employés / Dossier (l'écran "Dossier" global) ─────────
// L'EmployesStack expose TOUS les écrans de navigation profonde
// (liste employés, détail employé, fiche d'inscription, formulaire
// employeur, formulaire contrat). La navbar y entre par 3 chemins
// différents (Dossiers/Employeurs/Contrats) avec un paramètre `section`
// qui détermine la section à afficher dans l'écran principal.
export type EmployesStackParamList = {
  EmployesList: { section?: 'all' | 'employe' | 'employeur' | 'contrat' } | undefined;
  EmployeDetail: { id: string };
  FicheInscription: { id?: string } | undefined;
  EmployeurForm: { id?: string } | undefined;
  ContratDocument: { id?: string; employe_id?: string } | undefined;
};

// ─── Suivi (Commissions) ─────────────────────────────────
export type SuiviStackParamList = {
  SuiviMain: undefined;
};

// ─── Types de navigation composites pour cross-tab navigation
export type EmployeListNavProps = CompositeScreenProps<
  NativeStackScreenProps<EmployesStackParamList, 'EmployesList'>,
  BottomTabScreenProps<TabParamList>
>;

export type EmployeDetailNavProps = CompositeScreenProps<
  NativeStackScreenProps<EmployesStackParamList, 'EmployeDetail'>,
  BottomTabScreenProps<TabParamList>
>;

export type DashboardNavProps = CompositeScreenProps<
  NativeStackScreenProps<DashboardStackParamList, 'DashboardMain'>,
  BottomTabScreenProps<TabParamList>
>;

// Pour les modales (accès direct au root stack)
export type AlertesModalNavProps = NativeStackScreenProps<RootStackParamList, 'AlertesModal'>;
export type SettingsModalNavProps = NativeStackScreenProps<RootStackParamList, 'SettingsModal'>;

// Navigation prop globale (root stack) - pour navigation cross-stack et modales
export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Navigation prop pour les écrans qui naviguent partout (cross-stack + modales)
// Combine root stack + tab navigator
export type GlobalNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  RootNavigationProp
>;

// ─── Navigation Prop Types (pour useNavigation) ────────────────
// Dashboard (stack dans tabs)
export type DashboardNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<DashboardStackParamList, 'DashboardMain'>,
  BottomTabNavigationProp<TabParamList>
>;

// Employés
export type EmployeListNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<EmployesStackParamList, 'EmployesList'>,
  BottomTabNavigationProp<TabParamList>
>;

export type EmployeDetailNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<EmployesStackParamList, 'EmployeDetail'>,
  BottomTabNavigationProp<TabParamList>
>;

export type FicheInscriptionNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<EmployesStackParamList, 'FicheInscription'>,
  BottomTabNavigationProp<TabParamList>
>;

// EmployeurForm (exposé dans l'EmployesStack)
export type EmployeurFormNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<EmployesStackParamList, 'EmployeurForm'>,
  BottomTabNavigationProp<TabParamList>
>;

// ContratDocument (exposé dans l'EmployesStack)
export type ContratDocumentNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<EmployesStackParamList, 'ContratDocument'>,
  BottomTabNavigationProp<TabParamList>
>;

// Suivi
export type SuiviListNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<SuiviStackParamList, 'SuiviMain'>,
  BottomTabNavigationProp<TabParamList>
>;

// Modales (root stack direct)
export type AlertesModalNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AlertesModal'>;
export type JournalModalNavigationProp = NativeStackNavigationProp<RootStackParamList, 'JournalModal'>;
export type SettingsModalNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SettingsModal'>;
