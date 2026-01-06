import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Text, Card, Button, Avatar, Divider, List } from "react-native-paper";
import { useTranslation } from "@prostcounter/shared/i18n";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { useAuth } from "@/lib/auth/AuthContext";
import { useFestival } from "@/lib/festival/FestivalContext";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { currentFestival, festivals, setCurrentFestival } = useFestival();

  const handleSignOut = () => {
    Alert.alert(
      t("common.buttons.signOut"),
      "Are you sure you want to sign out?",
      [
        { text: t("common.buttons.cancel"), style: "cancel" },
        {
          text: t("common.buttons.signOut"),
          style: "destructive",
          onPress: signOut,
        },
      ]
    );
  };

  const handleChangeFestival = () => {
    if (festivals.length <= 1) return;

    Alert.alert(
      t("common.menu.changeFestival"),
      "Select a festival",
      festivals.map((festival) => ({
        text: festival.name,
        onPress: () => setCurrentFestival(festival),
        style: festival.id === currentFestival?.id ? "cancel" : "default",
      }))
    );
  };

  const initials = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <Card style={styles.card}>
        <Card.Content style={styles.profileContent}>
          <Avatar.Text
            size={80}
            label={initials}
            style={styles.avatar}
            labelStyle={styles.avatarLabel}
          />
          <Text variant="titleLarge" style={styles.email}>
            {user?.email}
          </Text>
          <Text variant="bodySmall" style={styles.memberId}>
            Member since {user?.created_at?.split("T")[0]}
          </Text>
        </Card.Content>
      </Card>

      {/* Settings Card */}
      <Card style={styles.card}>
        <Card.Content style={styles.settingsContent}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Settings
          </Text>

          <Divider style={styles.divider} />

          <List.Item
            title={t("common.menu.changeFestival")}
            description={currentFestival?.name || "No festival selected"}
            left={(props) => (
              <List.Icon
                {...props}
                icon="calendar-star"
                color="#F59E0B"
              />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleChangeFestival}
            disabled={festivals.length <= 1}
          />

          <Divider style={styles.divider} />

          <List.Item
            title={t("common.menu.profile")}
            description="Coming soon"
            left={(props) => (
              <List.Icon {...props} icon="account-edit" color="#9CA3AF" />
            )}
            disabled
          />

          <List.Item
            title={t("common.menu.achievements")}
            description="Coming soon"
            left={(props) => (
              <List.Icon {...props} icon="medal" color="#9CA3AF" />
            )}
            disabled
          />

          <List.Item
            title="Language"
            description="English"
            left={(props) => (
              <List.Icon {...props} icon="translate" color="#9CA3AF" />
            )}
            disabled
          />
        </Card.Content>
      </Card>

      {/* Sign Out */}
      <Button
        mode="outlined"
        icon="logout"
        onPress={handleSignOut}
        style={styles.signOutButton}
        textColor="#EF4444"
      >
        {t("common.buttons.signOut")}
      </Button>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text variant="bodySmall" style={styles.appVersion}>
          ProstCounter v0.1.0
        </Text>
        <Text variant="bodySmall" style={styles.appVersion}>
          Made with {'<3'} for Oktoberfest fans
        </Text>
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
  profileContent: {
    alignItems: "center",
    paddingVertical: 24,
  },
  avatar: {
    backgroundColor: "#F59E0B",
  },
  avatarLabel: {
    color: "#000000",
    fontWeight: "bold",
  },
  email: {
    marginTop: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  memberId: {
    marginTop: 4,
    color: "#9CA3AF",
  },
  settingsContent: {
    paddingVertical: 8,
  },
  sectionTitle: {
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  divider: {
    marginVertical: 4,
  },
  signOutButton: {
    borderColor: "#EF4444",
    marginTop: 8,
  },
  appInfo: {
    alignItems: "center",
    marginTop: 24,
    gap: 4,
  },
  appVersion: {
    color: "#9CA3AF",
  },
});
