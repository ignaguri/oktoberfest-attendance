"use client";

import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/use-app-update";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Info } from "lucide-react";
import { useEffect } from "react";

export function VersionChecker() {
  const { updateAvailable, newVersion, changelog, applyUpdate, error } =
    useAppUpdate();
  const { toast } = useToast();

  useEffect(() => {
    if (updateAvailable) {
      // Show persistent notification until user updates
      toast({
        title: `Update Available - v${newVersion}`,
        description: (
          <div className="space-y-2">
            <span className="text-sm">
              A new version of the app is available with the latest features and
              improvements.
            </span>
            {changelog.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Info size={14} />
                  What&apos;s new:
                </div>
                <ul className="mt-1 space-y-1 text-xs">
                  {changelog.slice(0, 3).map((change, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span className="line-clamp-2">{change}</span>
                    </li>
                  ))}
                  {changelog.length > 3 && (
                    <li className="text-xs text-muted-foreground italic">
                      +{changelog.length - 3} more changes
                    </li>
                  )}
                </ul>
              </div>
            )}
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
          </div>
        ),
        variant: "default",
        duration: Infinity, // Persistent until dismissed
        className: "border-green-200 bg-green-50",
      });
    }
  }, [updateAvailable, newVersion, changelog, applyUpdate, toast]);

  // Show error toast if update check fails
  useEffect(() => {
    if (error) {
      toast({
        title: "Update Check Failed",
        description: error,
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [error, toast]);

  return null;
}
