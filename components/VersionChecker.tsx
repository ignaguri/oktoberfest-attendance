"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, X } from "lucide-react";
import { useEffect } from "react";
import { useAppUpdate } from "@/hooks/use-app-update";

export function VersionChecker() {
  const { hasUpdate, changelog, isChecking, applyUpdate, skipUpdate } = useAppUpdate();
  const { toast } = useToast();

  useEffect(() => {
    if (hasUpdate) {
      toast({
        title: "New Version Available! 🚀",
        description: (
          <div className="space-y-2">
            <p className="text-sm">
              A new version of the app is available with the following improvements:
            </p>
            {changelog.length > 0 && (
              <ul className="text-xs space-y-1 text-muted-foreground">
                {changelog.map((item: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ),
        action: (
          <div className="flex gap-2">
            <Button size="sm" onClick={applyUpdate} className="bg-green-600 hover:bg-green-700">
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
  }, [hasUpdate, changelog, toast, applyUpdate, skipUpdate]);

  // Show loading state while checking
  useEffect(() => {
    if (isChecking) {
      toast({
        title: "Checking for Updates",
        description: "Looking for the latest version...",
        variant: "default",
        duration: 3000,
      });
    }
  }, [isChecking, toast]);

  return null;
}
