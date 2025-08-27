"use client";

import { changelog } from "@/changelog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/contexts/NotificationContext";
import { APP_VERSION } from "@/version";
import { useState, useEffect } from "react";

export function WhatsNew() {
  const { setWhatsNewVisible, canShowWhatsNew } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<string[]>([]);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem("lastSeenVersion");
    const currentVersion = localStorage.getItem("appVersion");

    if (currentVersion !== APP_VERSION || lastSeenVersion !== APP_VERSION) {
      // Add a small delay to give InstallPWA priority on initial load
      const timer = setTimeout(() => {
        // Only show if we can show WhatsNew (not conflicting with InstallPWA)
        if (canShowWhatsNew) {
          setIsOpen(true);
          setWhatsNewVisible(true);
          localStorage.setItem("lastSeenVersion", APP_VERSION);
          localStorage.setItem("appVersion", APP_VERSION);
        } else {
          // If we can't show now, set up a retry mechanism
          const retryTimer = setInterval(() => {
            if (canShowWhatsNew) {
              setIsOpen(true);
              setWhatsNewVisible(true);
              localStorage.setItem("lastSeenVersion", APP_VERSION);
              localStorage.setItem("appVersion", APP_VERSION);
              clearInterval(retryTimer);
            }
          }, 500); // Check every 500ms

          // Clean up retry timer after 10 seconds
          setTimeout(() => clearInterval(retryTimer), 10000);
        }
      }, 1000); // 1 second delay

      return () => clearTimeout(timer);
    }
  }, [canShowWhatsNew, setWhatsNewVisible]);

  const handleClose = () => {
    setIsOpen(false);
    setWhatsNewVisible(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setWhatsNewVisible(open);
  };

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) =>
      prev.includes(version)
        ? prev.filter((v) => v !== version)
        : [...prev, version],
    );
  };

  const sortedVersions = Object.keys(changelog).sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }),
  );

  const currentVersionChanges = changelog[APP_VERSION] || [];
  const previousVersions = sortedVersions
    .filter((v) => v !== APP_VERSION)
    .slice(0, 2); // Only take the two versions before the current one

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>What&apos;s New in v{APP_VERSION}</DialogTitle>
          <DialogDescription>
            Check out the latest updates and improvements!
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="mt-4 max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Current Version:</h3>
              <ul className="space-y-2 list-disc pl-5">
                {currentVersionChanges.map((change, index) => (
                  <li key={index}>{change}</li>
                ))}
              </ul>
            </div>
            <Accordion
              type="multiple"
              value={expandedVersions}
              className="w-full"
            >
              {previousVersions.map((version) => (
                <AccordionItem
                  key={version}
                  value={version}
                  className="ring-transparent"
                >
                  <AccordionTrigger onClick={() => toggleVersion(version)}>
                    Version {version}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 list-disc pl-5">
                      {changelog[version].map((change, index) => (
                        <li key={index}>{change}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </ScrollArea>
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleClose}
            className="mt-4 w-fit self-center"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
