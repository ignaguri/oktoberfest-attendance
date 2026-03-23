import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import type {
  Control,
  ControllerRenderProps,
  FieldValues,
  Path,
} from "react-hook-form";
import { Controller } from "react-hook-form";
import { Pressable, View } from "react-native";

import { Input, InputField, InputSlot } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

interface FormInputProps<T extends FieldValues> {
  /** React Hook Form control */
  control: Control<T>;
  /** Field name in the form */
  name: Path<T>;
  /** Label text displayed above the input */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether this is a password field (enables toggle) */
  secureTextEntry?: boolean;
  /** Error message to display */
  error?: string;
  /** Input type for keyboard optimization */
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  /** Auto-capitalize behavior */
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  /** Auto-complete hint */
  autoComplete?:
    | "email"
    | "password"
    | "password-new"
    | "name"
    | "username"
    | "off";
  /** Whether to auto-focus this input */
  autoFocus?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Form Input Component
 *
 * A reusable form input that integrates with React Hook Form.
 * Includes label, error display, and password visibility toggle.
 */
export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  secureTextEntry = false,
  error,
  keyboardType = "default",
  autoCapitalize = "none",
  autoComplete = "off",
  autoFocus = false,
  disabled = false,
}: FormInputProps<T>) {
  const [showPassword, setShowPassword] = useState(false);

  const renderInput = ({
    field,
  }: {
    field: ControllerRenderProps<T, Path<T>>;
  }) => (
    <Input
      variant="outline"
      size="lg"
      isDisabled={disabled}
      isInvalid={!!error}
    >
      <InputField
        placeholder={placeholder}
        value={field.value}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        secureTextEntry={secureTextEntry && !showPassword}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
      {secureTextEntry && (
        <InputSlot className="pr-3">
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            {showPassword ? (
              <EyeOff size={20} className="text-typography-400" />
            ) : (
              <Eye size={20} className="text-typography-400" />
            )}
          </Pressable>
        </InputSlot>
      )}
    </Input>
  );

  return (
    <View className="mb-4 w-full">
      <Text className="mb-1.5 font-medium text-typography-700">{label}</Text>
      <Controller control={control} name={name} render={renderInput} />
      {error && <Text className="mt-1 text-sm text-error-600">{error}</Text>}
    </View>
  );
}
