import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';

interface Props {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export default function RatingStars({ rating, size = 20, interactive = false, onRate }: Props) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.container}>
      {stars.map((star) => {
        const filled = star <= rating;
        const icon = filled ? 'star' : 'star-outline';
        const color = filled ? Colors.warning : Colors.gray300;

        if (interactive) {
          return (
            <TouchableOpacity
              key={star}
              onPress={() => onRate?.(star)}
              style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
              accessibilityLabel={`${star} star`}
              accessibilityRole="button"
            >
              <Ionicons name={icon} size={size} color={color} />
            </TouchableOpacity>
          );
        }

        return <Ionicons key={star} name={icon} size={size} color={color} style={{ marginRight: 2 }} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
