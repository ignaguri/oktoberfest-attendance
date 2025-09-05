"use client";

import { logger } from "@/lib/logger";
import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          logger.info(
            "Service worker registered successfully",
            logger.clientComponent("ServiceWorkerRegistration", {
              scope: registration.scope,
            }),
          );
        })
        .catch((registrationError) => {
          logger.error(
            "Service worker registration failed",
            logger.clientComponent("ServiceWorkerRegistration"),
            registrationError,
          );
        });
    }
  }, []);

  return null;
}
