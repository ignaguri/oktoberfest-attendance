import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Handle /join-group?token=TOKEN format (from Universal Links)
 * Redirects to /join-group/[token] which has the actual joining logic
 */
export default function JoinGroupQueryHandler() {
  const { token } = useLocalSearchParams<{ token?: string }>();

  if (!token) {
    // No token provided, redirect to groups tab
    return <Redirect href="/(tabs)/groups" />;
  }

  // Redirect to the [token] route which handles the joining logic
  return <Redirect href={`/join-group/${token}`} />;
}
