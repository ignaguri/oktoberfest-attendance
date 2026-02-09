import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { Camera } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Dimensions, Image, Text, View } from "react-native";

import { VStack } from "@/components/ui/vstack";
import { BackgroundColors, Colors } from "@/lib/constants/colors";
import { getBeerPictureUrl } from "@/lib/image-urls";

import { BaseSlide, SlideSubtitle, SlideTitle } from "./base-slide";

interface PicturesSlideProps {
  data: WrappedData;
  isActive: boolean;
}

function PictureItem({
  uri,
  size,
  index,
  isActive,
}: {
  uri: string;
  size: number;
  index: number;
  isActive: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <Motion.View
      initial={{
        opacity: 0,
        scale: 0.8,
        rotate: `${index % 2 === 0 ? -3 : 3}deg`,
      }}
      animate={{
        opacity: isActive ? 1 : 0,
        scale: isActive ? 1 : 0.8,
        rotate: `${index % 2 === 0 ? -2 : 2}deg`,
      }}
      transition={{
        type: "spring",
        damping: 15,
        stiffness: 100,
        delay: 300 + index * 150,
      }}
    >
      {failed ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            backgroundColor: BackgroundColors[100],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Camera size={32} color={Colors.primary[500]} />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: 12,
          }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
    </Motion.View>
  );
}

export function PicturesSlide({ data, isActive }: PicturesSlideProps) {
  const { t } = useTranslation();
  const screenWidth = Dimensions.get("window").width;
  const imageSize = (screenWidth - 72) / 2; // 2 columns with padding

  // Show up to 6 pictures
  const pictures = useMemo(
    () => data.social_stats?.pictures?.slice(0, 6) || [],
    [data.social_stats?.pictures],
  );

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-stone-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.pictures.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.pictures.subtitle")}
        </SlideSubtitle>

        <Text className="mt-2 text-center text-sm text-gray-500">
          {t("wrapped.pictures.count", {
            count: data.social_stats?.pictures?.length ?? 0,
          })}
        </Text>

        <View className="mt-4 flex-row flex-wrap justify-center gap-3">
          {pictures.map((pic, index) => (
            <PictureItem
              key={pic.id}
              uri={getBeerPictureUrl(pic.picture_url) || ""}
              size={imageSize}
              index={index}
              isActive={isActive}
            />
          ))}
        </View>
      </VStack>
    </BaseSlide>
  );
}
