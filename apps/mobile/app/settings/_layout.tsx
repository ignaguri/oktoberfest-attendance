import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Colors, IconColors } from '@/lib/constants/colors';

export default function SettingsLayout() {
  const { t } = useTranslation();
  const router = useRouter();

  const BackButton = () => (
    <Button
      variant="ghost"
      size="icon"
      onPress={() => router.back()}
    >
      <ChevronLeft size={28} color={IconColors.white} strokeWidth={2} />
    </Button>
  );

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary[500],
        },
        headerTintColor: IconColors.white,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerLeft: () => <BackButton />,
      }}
    >
      <Stack.Screen
        name="notifications"
        options={{
          title: t('profile.notifications.title'),
        }}
      />
      <Stack.Screen
        name="photo-privacy"
        options={{
          title: t('profile.photoPrivacy.title', { defaultValue: 'Photo Privacy' }),
        }}
      />
      <Stack.Screen
        name="change-password"
        options={{
          title: t('profile.changePassword.title', { defaultValue: 'Change Password' }),
        }}
      />
    </Stack>
  );
}
