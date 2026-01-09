import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { Button } from '@/components/ui/button';

export default function SettingsLayout() {
  const { t } = useTranslation();
  const router = useRouter();

  const BackButton = () => (
    <Button
      variant="ghost"
      size="icon"
      onPress={() => router.back()}
    >
      <ChevronLeft size={28} color="#FFFFFF" strokeWidth={2} />
    </Button>
  );

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#F59E0B',
        },
        headerTintColor: '#FFFFFF',
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
