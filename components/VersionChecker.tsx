"use client";

import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/use-app-update";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, X } from "lucide-react";
import { useEffect } from "react";

export function VersionChecker() {
  const { hasUpdate, applyUpdate, skipUpdate } = useAppUpdate();
  const { toast } = useToast();

  useEffect(() => {
    if (hasUpdate) {
      toast({
        title: "New Version Available! 🚀",
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
        variant: "default",
        duration: Infinity, // Persistent until user acts
      });
    }
  }, [hasUpdate, toast, applyUpdate, skipUpdate]);

  return null;
}
