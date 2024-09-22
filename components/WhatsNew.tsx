"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { changelog } from "@/changelog";
import { APP_VERSION } from "@/version";

export function WhatsNew() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem("lastSeenVersion");
    const currentVersion = localStorage.getItem("appVersion");

    if (currentVersion !== APP_VERSION || lastSeenVersion !== APP_VERSION) {
      setIsOpen(true);
      localStorage.setItem("lastSeenVersion", APP_VERSION);
      localStorage.setItem("appVersion", APP_VERSION);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What&apos;s New in v{APP_VERSION}</DialogTitle>
          <DialogDescription>
            Check out the latest updates and improvements!
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="mt-4 max-h-[60vh]">
          <ul className="space-y-2">
            {changelog[APP_VERSION]?.map((change, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
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
