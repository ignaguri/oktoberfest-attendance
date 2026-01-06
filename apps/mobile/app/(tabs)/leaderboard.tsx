import { View, StyleSheet } from "react-native";
import { Text, Card } from "react-native-paper";
import { useTranslation } from "@prostcounter/shared/i18n";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function LeaderboardScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <MaterialCommunityIcons name="trophy" size={64} color="#D1D5DB" />
          <Text variant="headlineSmall" style={styles.title}>
            {t("common.menu.leaderboard")}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Coming Soon
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            View global rankings, compare stats with other attendees, and see
            who's leading the festival.
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 16,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
  },
  content: {
    alignItems: "center",
    paddingVertical: 48,
  },
  title: {
    marginTop: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  subtitle: {
    color: "#F59E0B",
    marginTop: 8,
    fontWeight: "600",
  },
  description: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 16,
    paddingHorizontal: 24,
  },
});
