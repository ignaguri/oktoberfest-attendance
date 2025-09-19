"use client";

import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/use-app-update";
import { RefreshCw, X } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export function VersionChecker() {
  const { hasUpdate, applyUpdate, skipUpdate } = useAppUpdate();

  useEffect(() => {
    if (hasUpdate) {
      toast.info("New Version Available! 🚀", {
        description: (
          <div className="space-y-2">
            <p className="text-sm">
              A new version of the app is available. Please update to get the
              latest features and improvements.
            </p>
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
              Update Now
            </Button>
            <Button size="sm" variant="outline" onClick={skipUpdate}>
              <X size={16} />
            </Button>
          </div>
        ),
        duration: Infinity, // Persistent until user acts
      });
    }
  }, [hasUpdate, applyUpdate, skipUpdate]);

  return null;
}
