import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Colors, IconColors } from "@/lib/constants/colors";

function BackButton() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="icon" onPress={() => router.back()}>
      <ChevronLeft size={28} color={IconColors.white} strokeWidth={2} />
    </Button>
  );
}

export const defaultScreenOptions: NativeStackNavigationOptions = {
  headerStyle: {
    backgroundColor: Colors.primary[500],
  },
  headerTintColor: IconColors.white,
  headerLeft: () => <BackButton />,
};
