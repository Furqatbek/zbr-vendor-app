import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Root error boundary. Catches any exception thrown during render so a single
 * bad screen (e.g. malformed backend data reaching a .toFixed / .map) shows a
 * recoverable fallback instead of white-screening the whole app.
 *
 * Copy is intentionally hardcoded English, not i18n: the i18n context may be
 * the very thing that threw, and the boundary must render without any app
 * providers or hooks.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Kept on error so it survives the release console strip; wire to a crash
    // reporter (Sentry/Bugsnag) here when one is added.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. Your data is safe — tap below to try again.
        </Text>
        <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.8}>
          <Ionicons name="refresh" size={18} color={Colors.white} />
          <Text style={styles.buttonText}>Reload</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.gray50 },
  iconWrap: { marginBottom: Spacing.base },
  title: { ...Typography.title3, color: Colors.black, marginBottom: Spacing.sm, textAlign: 'center' },
  body: { ...Typography.body, color: Colors.gray500, textAlign: 'center', marginBottom: Spacing.xl },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, minHeight: 48 },
  buttonText: { ...Typography.headline, color: Colors.white },
});
