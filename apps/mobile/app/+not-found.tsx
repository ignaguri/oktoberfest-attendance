import { View, StyleSheet } from "react-native";
import { Text, Button } from "react-native-paper";
import { Link, Stack } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!", headerShown: true }} />
      <View style={styles.container}>
        <MaterialCommunityIcons name="beer-outline" size={80} color="#D1D5DB" />
        <Text variant="headlineMedium" style={styles.title}>
          Page Not Found
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Looks like this page wandered off to another tent!
        </Text>
        <Link href="/(tabs)" asChild>
          <Button mode="contained" style={styles.button}>
            Go to Home
          </Button>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    marginTop: 24,
    fontWeight: "bold",
    color: "#1F2937",
  },
  subtitle: {
    marginTop: 8,
    textAlign: "center",
    color: "#6B7280",
  },
  button: {
    marginTop: 32,
    backgroundColor: "#F59E0B",
  },
});
