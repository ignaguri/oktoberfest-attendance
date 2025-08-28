"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const CacheManagement = () => {
  const { toast } = useToast();

  const handleClearServiceWorkerCache = async () => {
    try {
      if ("serviceWorker" in navigator && "caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );

        // Update service worker
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.update()),
        );

        toast({
          title: "Success",
          variant: "success",
          description: "Service worker caches cleared successfully",
        });
      } else {
        toast({
          title: "Warning",
          variant: "destructive",
          description: "Service worker or caches not supported",
        });
      }
    } catch (error) {
      console.error("Error clearing service worker cache:", error);
      toast({
        title: "Error",
        description: "Failed to clear service worker caches",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Cache Management</h2>
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            New Caching System
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            The old NodeCache system has been replaced with modern HTTP caching
            headers and Next.js unstable_cache for better performance and
            serverless compatibility.
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Images: HTTP headers with ETags and 30-day cache</li>
            <li>• Service Worker: Optimized PWA caching strategies</li>
            <li>• Database queries: Next.js unstable_cache for metadata</li>
          </ul>
        </div>

        <div>
          <Button
            variant="outline"
            onClick={handleClearServiceWorkerCache}
            className="w-full sm:w-auto"
          >
            Clear Service Worker Caches
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            This will clear all PWA service worker caches and update the service
            worker.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CacheManagement;
