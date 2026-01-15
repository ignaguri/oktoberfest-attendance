import { useJoinGroupByToken } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle, XCircle, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

type JoinStatus = "loading" | "success" | "error" | "already_member";

interface JoinResult {
  groupId?: string;
  groupName?: string;
  errorMessage?: string;
}

/**
 * Deep link handler for joining groups via invite token
 * URL format: prostcounter://join-group/TOKEN
 */
export default function JoinGroupByTokenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const joinGroupByToken = useJoinGroupByToken();

  const [status, setStatus] = useState<JoinStatus>("loading");
  const [result, setResult] = useState<JoinResult>({});

  // Join group when component mounts
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setResult({
        errorMessage: t("groups.deepLink.invalidToken", {
          defaultValue: "Invalid invite link. The token is missing.",
        }),
      });
      return;
    }

    const joinGroup = async () => {
      try {
        const response = await joinGroupByToken.mutateAsync(token);
        setStatus("success");
        setResult({
          groupId: response.group.id,
          groupName: response.group.name,
        });
      } catch (error: any) {
        const errorMessage = error?.message || "";

        // Check if user is already a member
        if (errorMessage.toLowerCase().includes("already a member")) {
          setStatus("already_member");
          setResult({ errorMessage });
        } else {
          setStatus("error");
          setResult({
            errorMessage:
              errorMessage ||
              t("groups.deepLink.joinFailed", {
                defaultValue:
                  "Failed to join group. The invite link may be invalid or expired.",
              }),
          });
        }
      }
    };

    joinGroup();
  }, [token]); // Only run once on mount with the token

  const handleViewGroup = () => {
    if (result.groupId) {
      router.replace(`/groups/${result.groupId}`);
    }
  };

  const handleGoToGroups = () => {
    router.replace("/(tabs)/groups");
  };

  const handleGoHome = () => {
    router.replace("/(tabs)");
  };

  // Loading state
  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-background-50 p-6">
        <VStack space="lg" className="items-center">
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text className="text-center text-typography-500">
            {t("groups.deepLink.joining", { defaultValue: "Joining group..." })}
          </Text>
        </VStack>
      </View>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <View className="flex-1 items-center justify-center bg-background-50 p-6">
        <VStack space="xl" className="w-full items-center">
          <CheckCircle size={64} color={IconColors.success} />

          <VStack space="sm" className="items-center">
            <Heading size="xl" className="text-center text-typography-900">
              {t("groups.deepLink.successTitle", { defaultValue: "Welcome!" })}
            </Heading>
            <Text className="text-center text-typography-500">
              {t("groups.deepLink.successMessage", {
                defaultValue: "You've successfully joined",
              })}
            </Text>
            {result.groupName && (
              <Text className="text-center text-lg font-semibold text-primary-600">
                {result.groupName}
              </Text>
            )}
          </VStack>

          <VStack space="md" className="w-full">
            <Button
              variant="solid"
              action="primary"
              size="lg"
              className="w-full"
              onPress={handleViewGroup}
            >
              <ButtonText>
                {t("groups.deepLink.viewGroup", { defaultValue: "View Group" })}
              </ButtonText>
            </Button>

            <Button
              variant="outline"
              action="secondary"
              size="lg"
              className="w-full"
              onPress={handleGoToGroups}
            >
              <ButtonText>
                {t("groups.deepLink.allGroups", { defaultValue: "All Groups" })}
              </ButtonText>
            </Button>
          </VStack>
        </VStack>
      </View>
    );
  }

  // Already a member state
  if (status === "already_member") {
    return (
      <View className="flex-1 items-center justify-center bg-background-50 p-6">
        <VStack space="xl" className="w-full items-center">
          <Users size={64} color={IconColors.primary} />

          <VStack space="sm" className="items-center">
            <Heading size="xl" className="text-center text-typography-900">
              {t("groups.deepLink.alreadyMemberTitle", {
                defaultValue: "Already a Member",
              })}
            </Heading>
            <Text className="text-center text-typography-500">
              {t("groups.deepLink.alreadyMemberMessage", {
                defaultValue: "You're already a member of this group.",
              })}
            </Text>
          </VStack>

          <VStack space="md" className="w-full">
            <Button
              variant="solid"
              action="primary"
              size="lg"
              className="w-full"
              onPress={handleGoToGroups}
            >
              <ButtonText>
                {t("groups.deepLink.viewYourGroups", {
                  defaultValue: "View Your Groups",
                })}
              </ButtonText>
            </Button>

            <Button
              variant="outline"
              action="secondary"
              size="lg"
              className="w-full"
              onPress={handleGoHome}
            >
              <ButtonText>
                {t("groups.deepLink.goHome", { defaultValue: "Go Home" })}
              </ButtonText>
            </Button>
          </VStack>
        </VStack>
      </View>
    );
  }

  // Error state
  return (
    <View className="flex-1 items-center justify-center bg-background-50 p-6">
      <VStack space="xl" className="w-full items-center">
        <XCircle size={64} color={IconColors.error} />

        <VStack space="sm" className="items-center">
          <Heading size="xl" className="text-center text-error-600">
            {t("groups.deepLink.errorTitle", {
              defaultValue: "Unable to Join",
            })}
          </Heading>
          <Text className="text-center text-typography-500">
            {result.errorMessage}
          </Text>
        </VStack>

        <VStack space="md" className="w-full">
          <Button
            variant="solid"
            action="primary"
            size="lg"
            className="w-full"
            onPress={handleGoToGroups}
          >
            <ButtonText>
              {t("groups.deepLink.goToGroups", {
                defaultValue: "Go to Groups",
              })}
            </ButtonText>
          </Button>

          <Button
            variant="outline"
            action="secondary"
            size="lg"
            className="w-full"
            onPress={handleGoHome}
          >
            <ButtonText>
              {t("groups.deepLink.goHome", { defaultValue: "Go Home" })}
            </ButtonText>
          </Button>
        </VStack>
      </VStack>
    </View>
  );
}
