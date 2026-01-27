import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Button, ButtonText } from "@/components/ui/button";

interface OAuthButtonsProps {
  /** Handler for Google sign-in */
  onGooglePress: () => void;
  /** Handler for Facebook sign-in */
  onFacebookPress: () => void;
  /** Handler for Apple sign-in (iOS only) */
  onApplePress: () => void;
  /** Loading state for Google button */
  isGoogleLoading?: boolean;
  /** Loading state for Facebook button */
  isFacebookLoading?: boolean;
  /** Loading state for Apple button */
  isAppleLoading?: boolean;
  /** Whether all buttons should be disabled */
  disabled?: boolean;
}

/**
 * Google Icon Component
 */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

/**
 * Facebook Icon Component
 */
function FacebookIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/**
 * Apple Icon Component
 */
function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/**
 * OAuth Buttons Component
 *
 * Displays OAuth sign-in buttons for Google, Facebook, and Apple (iOS only).
 * Each button has its own loading state and follows platform conventions.
 */
export function OAuthButtons({
  onGooglePress,
  onFacebookPress,
  onApplePress,
  isGoogleLoading = false,
  isFacebookLoading = false,
  isAppleLoading = false,
  disabled = false,
}: OAuthButtonsProps) {
  const { t } = useTranslation();
  const isAnyLoading = isGoogleLoading || isFacebookLoading || isAppleLoading;

  return (
    <View className="w-full gap-3">
      {/* Google Button */}
      <Button
        variant="outline"
        action="secondary"
        size="lg"
        onPress={onGooglePress}
        disabled={disabled || isAnyLoading}
        className="border-background-300 bg-white"
      >
        {isGoogleLoading ? (
          <ActivityIndicator size="small" color="#4285F4" />
        ) : (
          <>
            <GoogleIcon />
            <ButtonText className="ml-2 text-typography-700">
              {t("auth.signIn.continueWithGoogle")}
            </ButtonText>
          </>
        )}
      </Button>

      {/* Facebook Button */}
      <Button
        variant="solid"
        size="lg"
        onPress={onFacebookPress}
        disabled={disabled || isAnyLoading}
        className="border-0 bg-[#1877F2]"
      >
        {isFacebookLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <FacebookIcon />
            <ButtonText className="ml-2 text-white">
              {t("auth.signIn.continueWithFacebook")}
            </ButtonText>
          </>
        )}
      </Button>

      {/* Apple Button - iOS only */}
      {Platform.OS === "ios" && (
        <Button
          variant="solid"
          size="lg"
          onPress={onApplePress}
          disabled={disabled || isAnyLoading}
          className="border-0 bg-black"
        >
          {isAppleLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <AppleIcon />
              <ButtonText className="ml-2 text-white">
                {t("auth.signIn.continueWithApple")}
              </ButtonText>
            </>
          )}
        </Button>
      )}
    </View>
  );
}
