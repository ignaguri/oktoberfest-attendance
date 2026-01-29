"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { RefreshCw, X } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/use-app-update";

export function VersionChecker() {
  const { t } = useTranslation();
  const { hasUpdate, applyUpdate, skipUpdate } = useAppUpdate();

  useEffect(() => {
    if (hasUpdate) {
      toast.info(t("common.updates.available"), {
        description: (
          <div className="space-y-2">
            <p className="text-sm">{t("common.updates.description")}</p>
          </div>
        ),
        action: (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={applyUpdate}
              className="bg-green-600 hover:bg-green-700"
            >
              <RefreshCw size={16} className="mr-1" />
              {t("common.updates.updateNow")}
            </Button>
            <Button size="sm" variant="outline" onClick={skipUpdate}>
              <X size={16} />
            </Button>
          </div>
        ),
        duration: Infinity, // Persistent until user acts
      });
    }
  }, [hasUpdate, applyUpdate, skipUpdate, t]);

  return null;
}
