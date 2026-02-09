import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { Camera, Users, UsersRound } from "lucide-react-native";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";

import { BaseSlide, SlideSubtitle, SlideTitle, StatItem } from "./base-slide";

interface SocialSlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function SocialSlide({ data, isActive }: SocialSlideProps) {
  const { t } = useTranslation();

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-purple-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>{t("wrapped.social.title")}</SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.social.subtitle")}
        </SlideSubtitle>

        <View className="mt-6">
          <VStack space="md">
            <StatItem
              label={t("wrapped.social.groups")}
              value={String(data.social_stats?.groups_joined ?? 0)}
              icon={<UsersRound size={24} color={Colors.primary[500]} />}
              isActive={isActive}
              delay={200}
            />
            <HStack space="md">
              <View className="flex-1">
                <StatItem
                  label={t("wrapped.social.photos")}
                  value={String(data.social_stats?.photos_uploaded ?? 0)}
                  icon={<Camera size={24} color={Colors.primary[500]} />}
                  isActive={isActive}
                  delay={350}
                />
              </View>
              <View className="flex-1">
                <StatItem
                  label={t("wrapped.social.friends")}
                  value={String(data.social_stats?.total_group_members ?? 0)}
                  icon={<Users size={24} color={Colors.primary[500]} />}
                  isActive={isActive}
                  delay={500}
                />
              </View>
            </HStack>
          </VStack>
        </View>
      </VStack>
    </BaseSlide>
  );
}
