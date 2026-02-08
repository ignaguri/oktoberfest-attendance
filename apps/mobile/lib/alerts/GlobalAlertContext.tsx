import { useTranslation } from "@prostcounter/shared/i18n";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { View } from "react-native";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Colors } from "@/lib/constants/colors";

type AlertType = "info" | "warning" | "error" | "success";

interface GlobalAlert {
  id: string;
  title: string;
  message: string;
  type: AlertType;
}

interface GlobalAlertContextValue {
  showAlert: (title: string, message: string, type?: AlertType) => void;
  dismissAlert: () => void;
}

const GlobalAlertContext = createContext<GlobalAlertContextValue | null>(null);

/**
 * Get background color for the alert icon based on type
 */
function getIconBgColor(type?: AlertType): string {
  switch (type) {
    case "success":
      return `${Colors.success[500]}20`;
    case "error":
      return `${Colors.error[500]}20`;
    case "warning":
      return `${Colors.amber[500]}20`;
    default:
      return `${Colors.primary[500]}20`;
  }
}

/**
 * Get the appropriate icon for the alert type
 */
function AlertIcon({ type }: { type?: AlertType }) {
  const size = 40;
  switch (type) {
    case "success":
      return <CheckCircle size={size} color={Colors.success[500]} />;
    case "error":
      return <XCircle size={size} color={Colors.error[500]} />;
    case "warning":
      return <AlertTriangle size={size} color={Colors.amber[500]} />;
    default:
      return <Info size={size} color={Colors.primary[500]} />;
  }
}

interface GlobalAlertProviderProps {
  children: React.ReactNode;
}

/**
 * Global alert provider that renders alerts in a native Modal layer.
 *
 * Uses React Native's Modal component to ensure alerts appear above
 * everything, including other native Modals (like LocationMapModal).
 *
 * @example
 * ```tsx
 * // In _layout.tsx
 * <GluestackUIProvider>
 *   <GlobalAlertProvider>
 *     {children}
 *   </GlobalAlertProvider>
 * </GluestackUIProvider>
 *
 * // In any component
 * const { showAlert } = useGlobalAlert();
 * showAlert('Title', 'Message', 'warning');
 * ```
 */
export function GlobalAlertProvider({ children }: GlobalAlertProviderProps) {
  const { t } = useTranslation();
  const [alert, setAlert] = useState<GlobalAlert | null>(null);

  const showAlert = useCallback(
    (title: string, message: string, type: AlertType = "info") => {
      setAlert({ id: Date.now().toString(), title, message, type });
    },
    [],
  );

  const dismissAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const contextValue = useMemo(
    () => ({ showAlert, dismissAlert }),
    [showAlert, dismissAlert],
  );

  return (
    <GlobalAlertContext.Provider value={contextValue}>
      {children}

      {/* AlertDialog rendered at provider level */}
      <AlertDialog isOpen={!!alert} onClose={dismissAlert} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent className="bg-background-0">
          <AlertDialogHeader className="flex-col items-center pb-4">
            <View
              className="mb-4 rounded-full p-4"
              style={{ backgroundColor: getIconBgColor(alert?.type) }}
            >
              <AlertIcon type={alert?.type} />
            </View>
            <Heading size="lg" className="text-center">
              {alert?.title}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-center text-typography-600">
              {alert?.message}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="pt-4">
            <Button
              action="primary"
              onPress={dismissAlert}
              className="w-full"
              accessibilityLabel={t("common.buttons.ok")}
            >
              <ButtonText>{t("common.buttons.ok")}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GlobalAlertContext.Provider>
  );
}

/**
 * Hook to access the global alert system.
 *
 * Can be called from anywhere in the app, including inside Modals.
 *
 * @example
 * ```tsx
 * const { showAlert } = useGlobalAlert();
 *
 * // Show a warning
 * showAlert('Warning', 'Something needs attention', 'warning');
 *
 * // Show an error
 * showAlert('Error', 'Something went wrong', 'error');
 *
 * // Show success
 * showAlert('Success', 'Operation completed', 'success');
 * ```
 */
export function useGlobalAlert(): GlobalAlertContextValue {
  const context = useContext(GlobalAlertContext);
  if (!context) {
    throw new Error("useGlobalAlert must be used within a GlobalAlertProvider");
  }
  return context;
}
