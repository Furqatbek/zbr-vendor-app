import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius } from '../constants/theme';

interface Props {
  startedAt: string;
  durationMinutes: number;
}

export default function CountdownTimer({ startedAt, durationMinutes }: Props) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const start = new Date(startedAt).getTime();
      const end = start + durationMinutes * 60000;
      const now = Date.now();
      setRemaining(Math.max(0, Math.floor((end - now) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining < 180;

  return (
    <View style={[styles.container, isUrgent && styles.urgent]}>
      <Text style={[styles.text, isUrgent && styles.urgentText]}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.chip,
    backgroundColor: Colors.warningLight,
  },
  urgent: {
    backgroundColor: Colors.dangerLight,
  },
  text: {
    ...Typography.footnote,
    fontWeight: '700',
    color: Colors.warning,
    fontVariant: ['tabular-nums'],
  },
  urgentText: {
    color: Colors.danger,
  },
});
