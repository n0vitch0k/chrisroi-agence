import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Searchbar } from 'react-native-paper';
import { Colors, Spacing, Radius } from '../theme';

type FilterType = 'all' | 'employees' | 'employers' | 'contracts' | 'available' | 'urgent';

type UnifiedSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  resultCount?: number;
};

const filters: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: 'Tout' },
  { value: 'employees', label: 'Employés' },
  { value: 'employers', label: 'Employeurs' },
  { value: 'contracts', label: 'Contrats' },
  { value: 'available', label: 'Disponible' },
  { value: 'urgent', label: 'Urgent' },
];

export default function UnifiedSearch({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  resultCount = 0,
}: UnifiedSearchProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Searchbar
          placeholder="Rechercher : nom, téléphone, contrat..."
          onChangeText={onQueryChange}
          value={query}
          style={styles.searchbar}
          inputStyle={styles.searchbarInput}
          iconColor={Colors.iconLight}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {filters.map((item) => (
          <View
            key={item.value}
            style={[
              styles.filterChip,
              filter === item.value && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === item.value && styles.filterChipTextActive,
              ]}
              onPress={() => onFilterChange(item.value)}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      {resultCount > 0 && (
        <Text style={styles.resultCount}>{resultCount} résultat{resultCount > 1 ? 's' : ''}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  searchIcon: {
    position: 'absolute',
    left: Spacing.md,
    top: 13,
    zIndex: 1,
    fontSize: 18,
  },
  searchbar: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    elevation: 0,
  },
  searchbarInput: {
    fontSize: 14,
  },
  filterRow: {
    gap: Spacing.sm,
  },
  filterChip: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.textOnPrimary,
  },
  resultCount: {
    marginTop: Spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
