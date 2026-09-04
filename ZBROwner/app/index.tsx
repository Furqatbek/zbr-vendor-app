import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

/**
 * Entry route. Sends the user to the tabs or to login.
 *
 * `Redirect` must be RENDERED, not called. This file previously did
 * `return Redirect({ href })`, which is why it was a .ts rather than .tsx —
 * calling it as a plain function sidesteps JSX, and with it every guarantee
 * React makes. Redirect calls useRouter and useFocusEffect internally, so
 * invoking it directly hoists those hooks into this component's hook list and
 * re-registers the focus effect with a fresh callback on every render. It
 * returns null either way, so when the navigation does not happen the result is
 * a blank screen with nothing logged.
 */
export default function Index() {
  const user = useAuthStore((s) => s.user);
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
