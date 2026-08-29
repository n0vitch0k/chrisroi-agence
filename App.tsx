// ─── App.tsx — Navigation restructurée (refonte Warm Earth, maquette v1 validée) ───
// POLITIQUE DE HEADER : headerShown: false PARTOUT. Chaque écran rend SON header
// via <AppHeader/> (safe-area intégrée) → plus de double header, plus de flèche
// sous la barre de statut Android, plus de hacks getParent()?.getParent().
import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import BackendDebugOverlay from './src/components/BackendDebugOverlay';
import { Colors, Typography, Spacing, Radius, Shadows } from './src/theme';
import type {
  RootStackParamList,
  TabParamList,
  DashboardStackParamList,
  EmployesStackParamList,
  SuiviStackParamList,
} from './src/types/navigation';

// Import des écrans
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import GlobalSearchScreen from './src/screens/GlobalSearchScreen';
import FicheInscriptionScreen from './src/screens/FicheInscriptionScreen';
import EmployeDetailScreen from './src/screens/EmployeDetailScreen';
import EmployeurFormScreen from './src/screens/EmployeurFormScreen';
import ContratDocumentScreen from './src/screens/ContratDocumentScreen';
import SuiviScreen from './src/screens/SuiviScreen';
import AlertesScreen from './src/screens/AlertesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ScanScreen from './src/screens/ScanScreen';
import ScanResultScreen from './src/screens/ScanResultScreen';
import JournalScreen from './src/screens/JournalScreen';
import AnimatedSplash from './src/components/AnimatedSplash';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const DashStack = createNativeStackNavigator<DashboardStackParamList>();
const EmpStack = createNativeStackNavigator<EmployesStackParamList>();

// Thème Paper — Warm Earth
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    secondary: Colors.success,
    accent: Colors.warning,
    error: Colors.danger,
    background: Colors.bg,
    surface: Colors.surface,
    text: Colors.text,
    outline: Colors.border,
  },
};

// ─── Compat temporaire (écrans legacy non encore portés) ───
// La nouvelle politique : pas de header natif. Ces hooks ne font plus rien ;
// chaque écran rend <AppHeader/> directement. Supprimés après portage complet.
export function HeaderTitle() {
  return null;
}
export function useAppHeader() {
  // no-op — les écrans portés utilisent <AppHeader/>
}
export const defaultHeaderOptions = {
  headerShown: false,
};

// ─── Dashboard Stack ──────────────────────────────────────
function DashboardStack() {
  const { user } = useAuth();
  return (
    <DashStack.Navigator screenOptions={{ headerShown: false }}>
      <DashStack.Screen name="DashboardMain" options={{ headerShown: false }}>
        {(props) => <DashboardScreen {...props} user={user!} />}
      </DashStack.Screen>
    </DashStack.Navigator>
  );
}

// ─── Employés Stack (Dossiers) ────────────────────────────
function EmployesStackScreen() {
  return (
    <EmpStack.Navigator screenOptions={{ headerShown: false }}>
      <EmpStack.Screen
        name="EmployesList"
        component={GlobalSearchScreen}
        options={{ headerShown: false }}
      />
      <EmpStack.Screen
        name="EmployeDetail"
        component={EmployeDetailScreen}
        options={{ headerShown: false }}
      />
      <EmpStack.Screen
        name="FicheInscription"
        component={FicheInscriptionScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <EmpStack.Screen
        name="EmployeurForm"
        component={EmployeurFormScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <EmpStack.Screen
        name="ContratDocument"
        component={ContratDocumentScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </EmpStack.Navigator>
  );
}

// ─── Suivi Stack ─────────────────────────────────────────
function SuiviStackScreen() {
  const Stack = createNativeStackNavigator<SuiviStackParamList>();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="SuiviMain"
        component={SuiviScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ─── Tab Navigator (Warm Earth) ───────────────────────────
function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          switch (route.name) {
            case 'DashboardStack': iconName = focused ? 'calendar-today' : 'calendar-outline'; break;
            case 'EmployesStack': iconName = focused ? 'folder-search' : 'folder-search-outline'; break;
            case 'EmployeursTab': iconName = focused ? 'office-building' : 'office-building-outline'; break;
            case 'ContratsTab': iconName = focused ? 'file-document' : 'file-document-outline'; break;
            case 'SuiviStack': iconName = focused ? 'cash-multiple' : 'cash'; break;
            default: iconName = 'circle';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.borderSoft,
          elevation: 0,
          shadowColor: 'transparent',
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          height: 58 + Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 1,
        },
      })}
    >
      <Tab.Screen
        name="DashboardStack"
        component={DashboardStack}
        options={{ tabBarLabel: "Aujourd'hui" }}
      />
      {/* Dossiers : écran principal, affiche toutes les sections. */}
      <Tab.Screen
        name="EmployesStack"
        component={EmployesStackScreen}
        options={{ tabBarLabel: 'Dossiers' }}
      />
      {/* Employeurs : même écran Dossier, filtré sur la section "employeur". */}
      <Tab.Screen
        name="EmployeursTab"
        component={EmployesStackScreen}
        initialParams={{ screen: 'EmployesList', params: { section: 'employeur' } }}
        options={{ tabBarLabel: 'Employeurs' }}
      />
      {/* Contrats : même écran Dossier, filtré sur la section "contrat". */}
      <Tab.Screen
        name="ContratsTab"
        component={EmployesStackScreen}
        initialParams={{ screen: 'EmployesList', params: { section: 'contrat' } }}
        options={{ tabBarLabel: 'Contrats' }}
      />
      <Tab.Screen
        name="SuiviStack"
        component={SuiviStackScreen}
        options={{ tabBarLabel: 'Commissions' }}
      />
    </Tab.Navigator>
  );
}

// ─── App (Root) ─────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { user, isLoading, onLogin, onLogout } = useAuth();
  const [animDone, setAnimDone] = useState(false);

  const handleSplashFinish = useCallback(() => {
    setAnimDone(true);
  }, []);

  // Splash couvre tout : animation + connexion PB (plus d'écran spinner séparé)
  // Le texte "Connexion en cours..." s'affiche juste au-dessus des 3 points rebondissants
  if (!animDone || isLoading) {
    return <AnimatedSplash onFinish={handleSplashFinish} statusText={isLoading ? "Connexion en cours..." : undefined} />;
  }

  // Phase 3 : App (si user connecté) ou Login
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <StatusBar style="dark" />
        {user ? (
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="Tabs" component={TabNavigator} />
            {/* ── Modales (chaque écran rend son AppHeader) ── */}
            <RootStack.Group screenOptions={{ presentation: 'modal', headerShown: false }}>
              <RootStack.Screen
                name="AlertesModal"
                component={AlertesScreen}
                options={{ headerShown: false }}
              />
              <RootStack.Screen name="SettingsModal" options={{ headerShown: false }}>
                {(props) => <SettingsScreen {...props} user={user} onLogout={onLogout} />}
              </RootStack.Screen>
              <RootStack.Screen
                name="ContratDocumentModal"
                component={ContratDocumentScreen}
                options={{ headerShown: false }}
              />
              <RootStack.Screen
                name="FicheInscriptionModal"
                component={FicheInscriptionScreen}
                options={{ headerShown: false }}
              />
              <RootStack.Screen
                name="JournalModal"
                component={JournalScreen}
                options={{ headerShown: false }}
              />
              <RootStack.Screen
                name="Scan"
                component={ScanScreen}
                options={{ headerShown: false }}
              />
              <RootStack.Screen
                name="ScanResult"
                component={ScanResultScreen}
                options={{ headerShown: false }}
              />
            </RootStack.Group>
          </RootStack.Navigator>
        ) : (
          <LoginScreen onLogin={onLogin} />
        )}
      </NavigationContainer>
      <BackendDebugOverlay />
    </PaperProvider>
  );
}
