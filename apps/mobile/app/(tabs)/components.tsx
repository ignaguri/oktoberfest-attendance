/**
 * Components Showcase Screen (Dev-Only)
 *
 * A development-only screen for testing and previewing UI components.
 * This tab is only visible when __DEV__ is true.
 */
import { useState } from "react";
import { ScrollView, Pressable, ActionSheetIOS, Platform } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import {
  Button,
  ButtonText,
  Card,
  Badge,
  BadgeText,
  Avatar,
  AvatarFallbackText,
  AvatarBadge,
  Input,
  InputField,
  Switch,
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
  VStack,
  HStack,
  Box,
  Text,
  Heading,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Textarea,
  TextareaInput,
  Progress,
  ProgressFilledTrack,
  Select,
  SelectTrigger,
  SelectInput,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectItem,
  SelectScrollView,
  Divider,
  CheckIconWhite,
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  Fab,
  FabIcon,
  FabLabel,
  Skeleton,
  SkeletonText,
  AddIcon,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription,
} from "@/components/ui";
import { ChevronDown } from "lucide-react-native";

type ComponentType =
  | "buttons"
  | "badges"
  | "avatars"
  | "form-controls"
  | "typography"
  | "modal"
  | "cards"
  | "textarea"
  | "progress"
  | "select"
  | "divider"
  | "actionsheet"
  | "fab"
  | "skeleton"
  | "toast";

const COMPONENT_OPTIONS: { label: string; value: ComponentType }[] = [
  { label: "Buttons", value: "buttons" },
  { label: "Badges", value: "badges" },
  { label: "Avatars", value: "avatars" },
  { label: "Form Controls", value: "form-controls" },
  { label: "Typography", value: "typography" },
  { label: "Modal", value: "modal" },
  { label: "Cards", value: "cards" },
  { label: "Textarea", value: "textarea" },
  { label: "Progress", value: "progress" },
  { label: "Select", value: "select" },
  { label: "Divider", value: "divider" },
  { label: "ActionSheet", value: "actionsheet" },
  { label: "Fab", value: "fab" },
  { label: "Skeleton", value: "skeleton" },
  { label: "Toast", value: "toast" },
];

// Section wrapper component (replaces CardHeader/CardTitle/CardContent)
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="p-4">
    <VStack space="md">
      <Heading size="md">{title}</Heading>
      {children}
    </VStack>
  </Card>
);

// Component Showcases
const ButtonsShowcase = () => (
  <Section title="Buttons">
    <VStack space="md">
      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">
          Solid
        </Text>
        <HStack space="sm" className="flex-wrap">
          <Button action="primary" size="sm">
            <ButtonText>Primary</ButtonText>
          </Button>
          <Button action="secondary" size="sm">
            <ButtonText>Secondary</ButtonText>
          </Button>
        </HStack>
        <HStack space="sm" className="flex-wrap">
          <Button action="positive" size="sm">
            <ButtonText>Positive</ButtonText>
          </Button>
          <Button action="negative" size="sm">
            <ButtonText>Negative</ButtonText>
          </Button>
        </HStack>
      </VStack>

      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">
          Outline
        </Text>
        <HStack space="sm" className="flex-wrap">
          <Button action="primary" variant="outline" size="sm">
            <ButtonText>Primary</ButtonText>
          </Button>
          <Button action="secondary" variant="outline" size="sm">
            <ButtonText>Secondary</ButtonText>
          </Button>
          <Button action="negative" variant="outline" size="sm">
            <ButtonText>Negative</ButtonText>
          </Button>
        </HStack>
      </VStack>

      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">
          Link
        </Text>
        <HStack space="sm" className="flex-wrap">
          <Button action="primary" variant="link" size="sm">
            <ButtonText>Link</ButtonText>
          </Button>
        </HStack>
      </VStack>

      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">
          Sizes
        </Text>
        <HStack space="sm" className="flex-wrap items-center">
          <Button action="primary" size="xs">
            <ButtonText>XS</ButtonText>
          </Button>
          <Button action="primary" size="sm">
            <ButtonText>SM</ButtonText>
          </Button>
          <Button action="primary" size="md">
            <ButtonText>MD</ButtonText>
          </Button>
          <Button action="primary" size="lg">
            <ButtonText>LG</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </VStack>
  </Section>
);

const BadgesShowcase = () => (
  <Section title="Badges">
    <VStack space="sm">
      <Text bold className="text-gray-600 text-xs uppercase">
        Solid
      </Text>
      <HStack space="sm" className="flex-wrap">
        <Badge action="success">
          <BadgeText>Success</BadgeText>
        </Badge>
        <Badge action="error">
          <BadgeText>Error</BadgeText>
        </Badge>
        <Badge action="warning">
          <BadgeText>Warning</BadgeText>
        </Badge>
      </HStack>
      <HStack space="sm" className="flex-wrap">
        <Badge action="info">
          <BadgeText>Info</BadgeText>
        </Badge>
        <Badge action="muted">
          <BadgeText>Muted</BadgeText>
        </Badge>
      </HStack>
      <Text bold className="text-gray-600 text-xs uppercase mt-2">
        Outline
      </Text>
      <HStack space="sm" className="flex-wrap">
        <Badge action="success" variant="outline">
          <BadgeText>Outline</BadgeText>
        </Badge>
        <Badge action="error" variant="outline">
          <BadgeText>Outline</BadgeText>
        </Badge>
      </HStack>
    </VStack>
  </Section>
);

const AvatarsShowcase = () => (
  <Section title="Avatars">
    <VStack space="sm">
      <Text bold className="text-gray-600 text-xs uppercase">
        Sizes
      </Text>
      <HStack space="md" className="items-end">
        <Avatar size="xs">
          <AvatarFallbackText>XS</AvatarFallbackText>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallbackText>SM</AvatarFallbackText>
        </Avatar>
        <Avatar size="md">
          <AvatarFallbackText>MD</AvatarFallbackText>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallbackText>LG</AvatarFallbackText>
        </Avatar>
        <Avatar size="xl">
          <AvatarFallbackText>XL</AvatarFallbackText>
        </Avatar>
      </HStack>
      <Text bold className="text-gray-600 text-xs uppercase mt-2">
        With Badge
      </Text>
      <HStack space="md">
        <Avatar size="lg">
          <AvatarFallbackText>JD</AvatarFallbackText>
          <AvatarBadge />
        </Avatar>
        <Avatar size="xl">
          <AvatarFallbackText>AB</AvatarFallbackText>
          <AvatarBadge />
        </Avatar>
      </HStack>
    </VStack>
  </Section>
);

const FormControlsShowcase = () => {
  const [switchValue, setSwitchValue] = useState(true);
  const [checkboxValue, setCheckboxValue] = useState(false);

  return (
    <Section title="Form Controls">
      <VStack space="lg">
        <VStack space="xs">
          <Text bold className="text-gray-600 text-xs uppercase">
            Input
          </Text>
          <Input variant="outline" size="md">
            <InputField placeholder="Outline input..." />
          </Input>
          <Input variant="rounded" size="md">
            <InputField placeholder="Rounded input..." />
          </Input>
        </VStack>

        <HStack className="items-center justify-between">
          <Text className="text-gray-700">Enable notifications</Text>
          <Switch
            value={switchValue}
            onValueChange={setSwitchValue}
            size="md"
          />
        </HStack>

        <Checkbox
          value="terms"
          isChecked={checkboxValue}
          onChange={setCheckboxValue}
          size="md"
        >
          <CheckboxIndicator>
            <CheckboxIcon as={CheckIconWhite} />
          </CheckboxIndicator>
          <CheckboxLabel>Accept terms and conditions</CheckboxLabel>
        </Checkbox>
      </VStack>
    </Section>
  );
};

const TypographyShowcase = () => (
  <Section title="Typography">
    <VStack space="sm">
      <Heading size="2xl">Heading 2XL</Heading>
      <Heading size="xl">Heading XL</Heading>
      <Heading size="lg">Heading LG</Heading>
      <Heading size="md">Heading MD</Heading>
      <Text size="lg">Text Large</Text>
      <Text size="md">Text Medium (default)</Text>
      <Text size="sm">Text Small</Text>
      <Text size="xs">Text Extra Small</Text>
      <Text bold>Bold Text</Text>
      <Text italic>Italic Text</Text>
    </VStack>
  </Section>
);

const ModalShowcase = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Section title="Modal">
      <VStack space="md">
        <Text className="text-gray-600 text-sm">
          Tap the button below to open a modal dialog.
        </Text>
        <Button action="primary" onPress={() => setModalOpen(true)}>
          <ButtonText>Open Modal</ButtonText>
        </Button>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          size="md"
        >
          <ModalBackdrop />
          <ModalContent>
            <ModalHeader>
              <Heading size="md" className="text-gray-900">
                Example Modal
              </Heading>
              <ModalCloseButton>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </ModalCloseButton>
            </ModalHeader>
            <ModalBody>
              <Text>
                This is an example modal dialog. It can contain any content
                you need to display to the user.
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button
                action="secondary"
                variant="outline"
                size="sm"
                onPress={() => setModalOpen(false)}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                action="primary"
                size="sm"
                onPress={() => setModalOpen(false)}
              >
                <ButtonText>Confirm</ButtonText>
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Section>
  );
};

const CardsShowcase = () => (
  <Section title="Card Variants">
    <VStack space="md">
      <Card variant="elevated" size="sm" className="p-3">
        <Text>Elevated Card</Text>
      </Card>
      <Card variant="outline" size="sm" className="p-3">
        <Text>Outline Card</Text>
      </Card>
      <Card variant="filled" size="sm" className="p-3">
        <Text>Filled Card</Text>
      </Card>
    </VStack>
  </Section>
);

const TextareaShowcase = () => (
  <Section title="Textarea">
    <VStack space="md">
      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">Default</Text>
        <Textarea size="md">
          <TextareaInput placeholder="Enter your message here..." />
        </Textarea>
      </VStack>
      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">Small Size</Text>
        <Textarea size="sm">
          <TextareaInput placeholder="Small textarea" />
        </Textarea>
      </VStack>
    </VStack>
  </Section>
);

const ProgressShowcase = () => (
  <Section title="Progress">
    <VStack space="md">
      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">25% Progress</Text>
        <Progress value={25} size="md">
          <ProgressFilledTrack />
        </Progress>
      </VStack>
      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">50% Progress</Text>
        <Progress value={50} size="md">
          <ProgressFilledTrack />
        </Progress>
      </VStack>
      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">75% Progress (Large)</Text>
        <Progress value={75} size="lg">
          <ProgressFilledTrack />
        </Progress>
      </VStack>
      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">Complete (XL)</Text>
        <Progress value={100} size="xl">
          <ProgressFilledTrack />
        </Progress>
      </VStack>
    </VStack>
  </Section>
);

const SelectShowcase = () => {
  const [selectedValue, setSelectedValue] = useState("");

  return (
    <Section title="Select">
      <VStack space="md">
        <VStack space="xs">
          <Text bold className="text-gray-600 text-xs uppercase">Choose a tent</Text>
          <Select
            selectedValue={selectedValue}
            onValueChange={setSelectedValue}
          >
            <SelectTrigger variant="outline" size="md">
              <SelectInput placeholder="Select tent..." />
              <ChevronDown size={20} color="#6B7280" style={{ marginRight: 12 }} />
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent>
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>
                <SelectScrollView>
                  <SelectItem label="Hofbräu" value="hofbrau" />
                  <SelectItem label="Augustiner" value="augustiner" />
                  <SelectItem label="Paulaner" value="paulaner" />
                  <SelectItem label="Spaten" value="spaten" />
                  <SelectItem label="Löwenbräu" value="lowenbrau" />
                </SelectScrollView>
              </SelectContent>
            </SelectPortal>
          </Select>
        </VStack>
        {selectedValue && (
          <Text className="text-gray-600">Selected: {selectedValue}</Text>
        )}
      </VStack>
    </Section>
  );
};

const DividerShowcase = () => (
  <Section title="Divider">
    <VStack space="md">
      <Text bold className="text-gray-600 text-xs uppercase">
        Horizontal
      </Text>
      <Text>Content above divider</Text>
      <Divider orientation="horizontal" />
      <Text>Content below divider</Text>
      <Text bold className="text-gray-600 text-xs uppercase mt-2">
        Vertical
      </Text>
      <HStack space="md" className="items-center h-8">
        <Text>Left</Text>
        <Divider orientation="vertical" />
        <Text>Middle</Text>
        <Divider orientation="vertical" />
        <Text>Right</Text>
      </HStack>
    </VStack>
  </Section>
);

const ActionsheetShowcase = () => {
  const [showActionsheet, setShowActionsheet] = useState(false);

  return (
    <Section title="ActionSheet">
      <VStack space="md">
        <Text className="text-gray-600 text-sm">
          Bottom sheet with multiple action options.
        </Text>
        <Button action="primary" onPress={() => setShowActionsheet(true)}>
          <ButtonText>Open ActionSheet</ButtonText>
        </Button>

        <Actionsheet isOpen={showActionsheet} onClose={() => setShowActionsheet(false)}>
          <ActionsheetBackdrop />
          <ActionsheetContent>
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator />
            </ActionsheetDragIndicatorWrapper>
            <ActionsheetItem onPress={() => setShowActionsheet(false)}>
              <ActionsheetItemText>Edit</ActionsheetItemText>
            </ActionsheetItem>
            <ActionsheetItem onPress={() => setShowActionsheet(false)}>
              <ActionsheetItemText>Share</ActionsheetItemText>
            </ActionsheetItem>
            <ActionsheetItem onPress={() => setShowActionsheet(false)}>
              <ActionsheetItemText>Delete</ActionsheetItemText>
            </ActionsheetItem>
            <ActionsheetItem onPress={() => setShowActionsheet(false)}>
              <ActionsheetItemText>Cancel</ActionsheetItemText>
            </ActionsheetItem>
          </ActionsheetContent>
        </Actionsheet>
      </VStack>
    </Section>
  );
};

const FabShowcase = () => (
  <Section title="Floating Action Button (FAB)">
    <VStack space="md">
      <Text className="text-gray-600 text-sm">
        Floating action buttons for primary actions.
      </Text>
      <Box className="h-48 bg-gray-100 rounded-lg relative">
        <Fab size="md" placement="bottom right">
          <FabIcon as={AddIcon} />
        </Fab>
        <Fab size="sm" placement="bottom left">
          <FabIcon as={AddIcon} />
        </Fab>
        <Fab size="lg" placement="top right">
          <FabIcon as={AddIcon} />
          <FabLabel>Add</FabLabel>
        </Fab>
      </Box>
      <VStack space="xs">
        <Text bold className="text-gray-600 text-xs uppercase">
          Sizes
        </Text>
        <HStack space="md" className="items-center">
          <Box className="h-16 w-16 bg-gray-100 rounded-lg relative">
            <Fab size="sm" placement="bottom right">
              <FabIcon as={AddIcon} />
            </Fab>
          </Box>
          <Box className="h-16 w-16 bg-gray-100 rounded-lg relative">
            <Fab size="md" placement="bottom right">
              <FabIcon as={AddIcon} />
            </Fab>
          </Box>
          <Box className="h-16 w-16 bg-gray-100 rounded-lg relative">
            <Fab size="lg" placement="bottom right">
              <FabIcon as={AddIcon} />
            </Fab>
          </Box>
        </HStack>
      </VStack>
    </VStack>
  </Section>
);

const SkeletonShowcase = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <Section title="Skeleton">
      <VStack space="md">
        <Text className="text-gray-600 text-sm">
          Loading placeholders for content.
        </Text>
        <Button action="secondary" variant="outline" onPress={() => setIsLoaded(!isLoaded)}>
          <ButtonText>{isLoaded ? "Show Skeleton" : "Load Content"}</ButtonText>
        </Button>

        <VStack space="xs">
          <Text bold className="text-gray-600 text-xs uppercase">
            Card Skeleton
          </Text>
          <Skeleton variant="rounded" isLoaded={isLoaded} className="h-24 w-full">
            <Card className="p-4">
              <Text>Loaded card content!</Text>
            </Card>
          </Skeleton>
        </VStack>

        <VStack space="xs">
          <Text bold className="text-gray-600 text-xs uppercase">
            Text Lines
          </Text>
          <SkeletonText _lines={3} isLoaded={isLoaded} gap={2} className="h-3 w-full">
            <VStack space="sm">
              <Text>First line of text</Text>
              <Text>Second line of text</Text>
              <Text>Third line of text</Text>
            </VStack>
          </SkeletonText>
        </VStack>

        <VStack space="xs">
          <Text bold className="text-gray-600 text-xs uppercase">
            Avatar Skeleton
          </Text>
          <Skeleton variant="circular" isLoaded={isLoaded} className="h-16 w-16">
            <Avatar size="xl">
              <AvatarFallbackText>AB</AvatarFallbackText>
            </Avatar>
          </Skeleton>
        </VStack>

        <VStack space="xs">
          <Text bold className="text-gray-600 text-xs uppercase">
            Combined Layout
          </Text>
          <HStack space="md" className="items-center">
            <Skeleton variant="circular" isLoaded={isLoaded} className="h-12 w-12">
              <Avatar size="lg">
                <AvatarFallbackText>JD</AvatarFallbackText>
              </Avatar>
            </Skeleton>
            <VStack className="flex-1">
              <Skeleton variant="rounded" isLoaded={isLoaded} className="h-4 w-3/4 mb-2">
                <Text bold>John Doe</Text>
              </Skeleton>
              <Skeleton variant="rounded" isLoaded={isLoaded} className="h-3 w-1/2">
                <Text size="sm" className="text-gray-500">@johndoe</Text>
              </Skeleton>
            </VStack>
          </HStack>
        </VStack>
      </VStack>
    </Section>
  );
};

const ToastShowcase = () => {
  const toast = useToast();

  const showToast = (action: "success" | "error" | "warning" | "info" | "muted", variant: "solid" | "outline" = "solid") => {
    const titles: Record<string, string> = {
      success: "Success!",
      error: "Error!",
      warning: "Warning!",
      info: "Information",
      muted: "Notification",
    };
    const descriptions: Record<string, string> = {
      success: "Your action was completed successfully.",
      error: "Something went wrong. Please try again.",
      warning: "Please review before proceeding.",
      info: "Here's some helpful information.",
      muted: "You have a new notification.",
    };

    toast.show({
      placement: "top",
      duration: 3000,
      render: ({ id }) => (
        <Toast nativeID={`toast-${id}`} action={action} variant={variant}>
          <ToastTitle>{titles[action]}</ToastTitle>
          <ToastDescription>{descriptions[action]}</ToastDescription>
        </Toast>
      ),
    });
  };

  return (
    <Section title="Toast">
      <VStack space="md">
        <Text className="text-gray-600 text-sm">
          Toast notifications for user feedback.
        </Text>

        <VStack space="xs">
          <Text bold className="text-gray-600 text-xs uppercase">
            Solid Variants
          </Text>
          <HStack space="sm" className="flex-wrap">
            <Button action="positive" size="sm" onPress={() => showToast("success")}>
              <ButtonText>Success</ButtonText>
            </Button>
            <Button action="negative" size="sm" onPress={() => showToast("error")}>
              <ButtonText>Error</ButtonText>
            </Button>
          </HStack>
          <HStack space="sm" className="flex-wrap">
            <Button action="primary" size="sm" onPress={() => showToast("warning")}>
              <ButtonText>Warning</ButtonText>
            </Button>
            <Button action="secondary" size="sm" onPress={() => showToast("info")}>
              <ButtonText>Info</ButtonText>
            </Button>
          </HStack>
          <HStack space="sm" className="flex-wrap">
            <Button action="secondary" variant="outline" size="sm" onPress={() => showToast("muted")}>
              <ButtonText>Muted</ButtonText>
            </Button>
          </HStack>
        </VStack>

        <VStack space="xs">
          <Text bold className="text-gray-600 text-xs uppercase">
            Outline Variants
          </Text>
          <HStack space="sm" className="flex-wrap">
            <Button action="positive" variant="outline" size="sm" onPress={() => showToast("success", "outline")}>
              <ButtonText>Success</ButtonText>
            </Button>
            <Button action="negative" variant="outline" size="sm" onPress={() => showToast("error", "outline")}>
              <ButtonText>Error</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </VStack>
    </Section>
  );
};

// Component renderer
const renderComponent = (component: ComponentType) => {
  switch (component) {
    case "buttons":
      return <ButtonsShowcase />;
    case "badges":
      return <BadgesShowcase />;
    case "avatars":
      return <AvatarsShowcase />;
    case "form-controls":
      return <FormControlsShowcase />;
    case "typography":
      return <TypographyShowcase />;
    case "modal":
      return <ModalShowcase />;
    case "cards":
      return <CardsShowcase />;
    case "textarea":
      return <TextareaShowcase />;
    case "progress":
      return <ProgressShowcase />;
    case "select":
      return <SelectShowcase />;
    case "divider":
      return <DividerShowcase />;
    case "actionsheet":
      return <ActionsheetShowcase />;
    case "fab":
      return <FabShowcase />;
    case "skeleton":
      return <SkeletonShowcase />;
    case "toast":
      return <ToastShowcase />;
    default:
      return null;
  }
};

export default function ComponentsScreen() {
  const [selectedComponent, setSelectedComponent] = useState<ComponentType>("buttons");

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <VStack space="md" className="p-4 pb-8">
        {/* Header */}
        <Box className="items-center py-2">
          <MaterialCommunityIcons name="puzzle" size={40} color="#F59E0B" />
          <Heading size="lg" className="mt-1">
            UI Components
          </Heading>
          <Text size="sm" className="text-gray-500">Development Preview</Text>
        </Box>

        {/* Component Selector */}
        <Pressable
          onPress={() => {
            if (Platform.OS === "ios") {
              ActionSheetIOS.showActionSheetWithOptions(
                {
                  options: ["Cancel", ...COMPONENT_OPTIONS.map((o) => o.label)],
                  cancelButtonIndex: 0,
                  title: "Select Component",
                },
                (buttonIndex) => {
                  if (buttonIndex > 0) {
                    setSelectedComponent(COMPONENT_OPTIONS[buttonIndex - 1].value);
                  }
                }
              );
            }
          }}
          className="bg-white rounded-xl border border-gray-300 px-4 py-3 flex-row items-center justify-between active:bg-gray-50"
        >
          <Text className="text-gray-900 text-base">
            {COMPONENT_OPTIONS.find((o) => o.value === selectedComponent)?.label}
          </Text>
          <ChevronDown size={20} color="#6B7280" />
        </Pressable>

        {/* Selected Component Showcase */}
        {renderComponent(selectedComponent)}
      </VStack>
    </ScrollView>
  );
}
