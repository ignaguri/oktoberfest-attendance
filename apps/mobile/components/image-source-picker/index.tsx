/**
 * Shared image source picker action sheet
 *
 * Used for selecting image source (camera or library) in a consistent way
 * across the app (avatar upload, beer pictures, etc.)
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { useCallback } from "react";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/ui/actionsheet";
import { IconColors } from "@/lib/constants/colors";

export type ImageSource = "camera" | "library";

interface ImageSourcePickerProps {
  /** Whether the picker is open */
  isOpen: boolean;
  /** Called when the picker should close */
  onClose: () => void;
  /** Called when a source is selected */
  onSelect: (source: ImageSource) => void;
  /** Whether the picker is disabled (e.g., during upload) */
  disabled?: boolean;
}

/**
 * Action sheet for selecting image source (camera or library)
 *
 * Provides a consistent UI for image selection across the app
 */
export function ImageSourcePicker({
  isOpen,
  onClose,
  onSelect,
  disabled = false,
}: ImageSourcePickerProps) {
  const { t } = useTranslation();

  const handleSelect = useCallback(
    (source: ImageSource) => {
      if (disabled) return;
      onClose();
      onSelect(source);
    },
    [disabled, onClose, onSelect],
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetItem
          onPress={() => handleSelect("camera")}
          disabled={disabled}
        >
          <Camera size={20} color={IconColors.default} />
          <ActionsheetItemText>
            {t("profile.avatar.takePhoto", { defaultValue: "Take Photo" })}
          </ActionsheetItemText>
        </ActionsheetItem>

        <ActionsheetItem
          onPress={() => handleSelect("library")}
          disabled={disabled}
        >
          <ImagePlus size={20} color={IconColors.default} />
          <ActionsheetItemText>
            {t("profile.avatar.chooseFromLibrary", {
              defaultValue: "Choose from Library",
            })}
          </ActionsheetItemText>
        </ActionsheetItem>

        <ActionsheetItem onPress={handleClose}>
          <X size={20} color={IconColors.muted} />
          <ActionsheetItemText>
            {t("common.buttons.cancel")}
          </ActionsheetItemText>
        </ActionsheetItem>
      </ActionsheetContent>
    </Actionsheet>
  );
}

ImageSourcePicker.displayName = "ImageSourcePicker";
