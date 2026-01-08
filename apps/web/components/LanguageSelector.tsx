"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n/client";
import { detectBrowserLanguage } from "@/lib/utils/detectLanguage";
import { SUPPORTED_LANGUAGES } from "@prostcounter/shared/i18n";
import { useState, useEffect } from "react";

interface LanguageSelectorProps {
  currentLanguage: string | null; // null = auto-detect
  onLanguageChange: (language: string | null) => Promise<void>;
  disabled?: boolean;
}

export function LanguageSelector({
  currentLanguage,
  onLanguageChange,
  disabled = false,
}: LanguageSelectorProps) {
  const { t } = useTranslation();
  const [isChanging, setIsChanging] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("en");

  useEffect(() => {
    // Detect browser language for display purposes
    setDetectedLanguage(
      detectBrowserLanguage([...SUPPORTED_LANGUAGES] as string[]),
    );
  }, []);

  const handleChange = async (value: string) => {
    setIsChanging(true);
    try {
      // Convert "auto" to null
      const langValue = value === "auto" ? null : value;
      await onLanguageChange(langValue);
    } finally {
      setIsChanging(false);
    }
  };

  const getDisplayValue = () => {
    if (currentLanguage === null) {
      // Auto-detect mode
      return "auto";
    }
    return currentLanguage;
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="language-selector" className="font-semibold">
        {t("profile.language.title")}
      </Label>
      <p className="mb-2 text-sm text-gray-600">
        {t("profile.language.description")}
      </p>
      <Select
        value={getDisplayValue()}
        onValueChange={handleChange}
        disabled={disabled || isChanging}
      >
        <SelectTrigger id="language-selector" className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">
            {currentLanguage === null
              ? t("profile.language.autoDetectCurrent", {
                  language: t(
                    `profile.language.languages.${detectedLanguage}` as const,
                  ),
                })
              : t("profile.language.autoDetect")}
          </SelectItem>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {t(`profile.language.languages.${lang}` as const)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
