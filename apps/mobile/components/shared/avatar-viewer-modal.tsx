import { useTranslation } from "@prostcounter/shared/i18n";
import { X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { View } from "@/components/ui/view";
import { Colors } from "@/lib/constants/colors";

interface AvatarViewerModalProps {
  /** Whether the viewer is open */
  visible: boolean;
  /** Fully resolved avatar URL, already passed through getAvatarUrl */
  imageUrl: string;
  /** Name used as the image's accessibility label */
  name: string;
  /** Callback when the viewer should close */
  onClose: () => void;
}

/**
 * Full-screen viewer for a profile picture.
 *
 * Rendered as a React Native Modal rather than a Gluestack one so it sits above
 * the profile modal that opens it, instead of nesting inside its portal.
 */
export function AvatarViewerModal({ visible, imageUrl, name, onClose }: AvatarViewerModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/*
        The backdrop closes on tap for sighted users, but it must not be an
        accessibility element itself: marking it one makes RN collapse the
        image and the close button into a single merged node.
      */}
      <Pressable className="flex-1 bg-black" onPress={onClose} accessible={false}>
        {isLoading && (
          <View className="absolute inset-0 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.white} />
          </View>
        )}
        <Image
          source={{ uri: imageUrl }}
          className="h-full w-full"
          resizeMode="contain"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          accessibilityLabel={name}
          alt=""
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("profile.avatar.fullSizeClose")}
          className="absolute right-4 rounded-full bg-black/50 p-2"
          style={{ top: Math.max(insets.top, 12) }}
        >
          <X size={24} color={Colors.white} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
