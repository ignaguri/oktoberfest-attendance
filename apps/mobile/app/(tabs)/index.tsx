import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Card, Button, ActivityIndicator, Chip } from "react-native-paper";
import { useTranslation } from "@prostcounter/shared/i18n";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { useAuth } from "@/lib/auth/AuthContext";
import { useFestival } from "@/lib/festival/FestivalContext";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentFestival, isLoading: festivalLoading } = useFestival();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Welcome Card */}
      <Card style={styles.card}>
        <Card.Content style={styles.welcomeContent}>
          <MaterialCommunityIcons name="beer" size={48} color="#F59E0B" />
          <Text variant="headlineSmall" style={styles.welcomeTitle}>
            Welcome to ProstCounter!
          </Text>
          <Text variant="bodyMedium" style={styles.welcomeSubtitle}>
            {user?.email}
          </Text>
        </Card.Content>
      </Card>

      {/* Festival Card */}
      <Card style={styles.card}>
        <Card.Title
          title="Current Festival"
          left={(props) => (
            <MaterialCommunityIcons
              {...props}
              name="calendar-star"
              size={24}
              color="#F59E0B"
            />
          )}
        />
        <Card.Content>
          {festivalLoading ? (
            <ActivityIndicator animating={true} color="#F59E0B" />
          ) : currentFestival ? (
            <View style={styles.festivalInfo}>
              <Text variant="titleMedium" style={styles.festivalName}>
                {currentFestival.name}
              </Text>
              <Chip icon="map-marker" style={styles.chip}>
                {currentFestival.location}
              </Chip>
              <Text variant="bodySmall" style={styles.festivalDates}>
                {currentFestival.start_date} - {currentFestival.end_date}
              </Text>
              {currentFestival.beer_cost && (
                <Chip icon="currency-eur" style={styles.chip}>
                  {currentFestival.beer_cost}€ per beer
                </Chip>
              )}
            </View>
          ) : (
            <Text variant="bodyMedium" style={styles.noFestival}>
              No festival selected
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Coming Soon Card */}
      <Card style={styles.card}>
        <Card.Content style={styles.comingSoon}>
          <MaterialCommunityIcons
            name="rocket-launch"
            size={32}
            color="#9CA3AF"
          />
          <Text variant="titleMedium" style={styles.comingSoonTitle}>
            More Features Coming Soon!
          </Text>
          <Text variant="bodyMedium" style={styles.comingSoonText}>
            Quick beer registration, statistics, and more will be available in
            the next update.
          </Text>
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Button
          mode="contained"
          icon="beer"
          style={styles.quickButton}
          contentStyle={styles.quickButtonContent}
          disabled
        >
          Log Beer (Coming Soon)
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  welcomeContent: {
    alignItems: "center",
    paddingVertical: 24,
  },
  welcomeTitle: {
    fontWeight: "bold",
    marginTop: 12,
    color: "#1F2937",
  },
  welcomeSubtitle: {
    color: "#6B7280",
    marginTop: 4,
  },
  festivalInfo: {
    gap: 8,
  },
  festivalName: {
    fontWeight: "bold",
    color: "#1F2937",
  },
  festivalDates: {
    color: "#6B7280",
  },
  chip: {
    alignSelf: "flex-start",
  },
  noFestival: {
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  comingSoon: {
    alignItems: "center",
    paddingVertical: 24,
  },
  comingSoonTitle: {
    marginTop: 12,
    color: "#6B7280",
  },
  comingSoonText: {
    textAlign: "center",
    color: "#9CA3AF",
    marginTop: 8,
  },
  quickActions: {
    marginTop: 8,
  },
  quickButton: {
    backgroundColor: "#F59E0B",
  },
  quickButtonContent: {
    paddingVertical: 8,
  },
});
