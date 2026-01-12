import { IconColors } from "@/lib/constants/colors";
import { X } from "lucide-react-native";
import { useState, useCallback } from "react";
import {
  Modal,
  Pressable,
  Image,
  Dimensions,
  ActivityIndicator,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ImagePreviewModalProps {
  imageUri: string | null;
  onClose: () => void;
}

/**
 * Full-screen image preview modal
 *
 * Features:
 * - Full-screen black background
 * - Close button (X) in top-right
 * - Tap anywhere to close
 * - Loading indicator while image loads
 * - Works with both remote URLs and local file URIs
 */
export function ImagePreviewModal({
  imageUri,
  onClose,
}: ImagePreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <Modal
      visible={!!imageUri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "black" }}>
        {/* Close Button */}
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            right: 16,
            top: 48,
            zIndex: 10,
            borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: 8,
          }}
        >
          <X size={24} color="#FFFFFF" />
        </Pressable>

        {/* Image Container - tap to close */}
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Loading Indicator */}
          {isLoading && (
            <View style={{ position: "absolute" }}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {/* Image */}
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={{
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT * 0.8,
              }}
              resizeMode="contain"
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
            />
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

ImagePreviewModal.displayName = "ImagePreviewModal";
