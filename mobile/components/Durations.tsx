import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';

interface DurationOption {
  label: string;
  value: number;
}

interface DurationsProps {
  value: number;
  onChange: (value: number) => void;
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: '1h', value: 1 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '3d', value: 72 },
  { label: '1w', value: 168 },
  { label: '∞', value: 0 },
];

export const Durations: React.FC<DurationsProps> = ({ value, onChange }) => {
  const handlePress = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(val);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Room Duration</Text>
      
      <View style={styles.selector}>
        {DURATION_OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          
          return (
            <Pressable
              key={opt.value}
              onPress={() => handlePress(opt.value)}
              style={[
                styles.option,
                isActive && styles.optionActive
              ]}
            >
              <Text style={[
                styles.optionText,
                isActive && styles.optionTextActive
              ]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>
        {value === 0 
          ? 'This room will never expire.' 
          : `Expires after ${value === 168 ? '1 week' : value + ' hours'}.`
        }
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs + 2,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: Colors.text.secondary,
  },
  selector: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    padding: 4,
  },
  option: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  optionActive: {
    backgroundColor: Colors.accent.primary,
  },
  optionText: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.text.tertiary,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.tertiary,
  },
});
