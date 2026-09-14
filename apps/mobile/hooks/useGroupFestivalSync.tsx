import { useSyncFestivalWithGroup } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";

import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { View } from "@/components/ui/view";

/**
 * Switch to the festival of a group opened from a notification or link, and
 * tell the user. The toast is dark because it sits over the yellow header and
 * would blend into it otherwise; top placement matches every other toast in the
 * app.
 */
export function useGroupFestivalSync(
  groupId: string | undefined,
  groupFestivalId: string | undefined,
) {
  const { t } = useTranslation();
  const toast = useToast();

  useSyncFestivalWithGroup(groupId, groupFestivalId, (festival) => {
    toast.show({
      placement: "top",
      render: () => (
        <View className="rounded-lg bg-background-800 px-4 py-3">
          <Text className="font-medium text-typography-0">
            {t("festival.switchedToast", { festival: festival.name })}
          </Text>
        </View>
      ),
    });
  });
}
