import { useJoinGroupByToken } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle, XCircle, Loader2 } from "lucide-react-native";
import { useEffect, useState } from "react";

import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

type JoinStatus = "loading" | "success" | "error";

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
        setStatus("error");
        // Try to extract error message
        const errorMessage =
          error?.message ||
          t("groups.deepLink.joinFailed", {
            defaultValue: "Failed to join group. The invite link may be invalid or expired.",
          });
        setResult({ errorMessage });
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
          <View className="animate-spin">
            <Loader2 size={48} color={Colors.primary[500]} />
          </View>
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

  // Error state
  return (
    <View className="flex-1 items-center justify-center bg-background-50 p-6">
      <VStack space="xl" className="w-full items-center">
        <XCircle size={64} color={IconColors.error} />

        <VStack space="sm" className="items-center">
          <Heading size="xl" className="text-center text-error-600">
            {t("groups.deepLink.errorTitle", { defaultValue: "Unable to Join" })}
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
              {t("groups.deepLink.goToGroups", { defaultValue: "Go to Groups" })}
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
