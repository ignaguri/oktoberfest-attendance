"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { APP_VERSION } from "../version";

// TODO: evaluate, because it's not working as expected
export function VersionChecker() {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkVersion = () => {
      const currentVersion = localStorage.getItem("appVersion");
      if (currentVersion && currentVersion !== APP_VERSION) {
        setNewVersionAvailable(true);
      }
    };

    checkVersion();
    window.addEventListener("focus", checkVersion);

    return () => {
      window.removeEventListener("focus", checkVersion);
    };
  }, []);

  const handleUpdate = () => {
    localStorage.setItem("appVersion", APP_VERSION);
    window.location.reload();
  };

  useEffect(() => {
    if (newVersionAvailable) {
      toast({
        title: "New Version Available",
        description: (
          <span className="text-sm line-clamp-3">
            A new version of the app is available. Please update to get the
            latest features and improvements.
          </span>
        ),
        action: (
          <Button size="sm" onClick={handleUpdate}>
            <RefreshCw size={20} />
          </Button>
        ),
        variant: "info",
        duration: 20000,
      });
    }
  }, [newVersionAvailable, toast]);

  return null;
}
