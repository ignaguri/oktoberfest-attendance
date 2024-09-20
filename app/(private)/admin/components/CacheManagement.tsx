"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { listCacheKeys, deleteCacheKey, deleteAllCaches } from "../actions";
import LoadingSpinner from "@/components/LoadingSpinner";

const CacheManagement = () => {
  const { toast } = useToast();
  const [cacheKeys, setCacheKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchCacheKeys() {
    try {
      setIsLoading(true);
      const keys = await listCacheKeys();
      setCacheKeys(keys);
    } catch (error) {
      console.error("Error fetching cache keys:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteCacheKey(key: string) {
    try {
      await deleteCacheKey(key);
      fetchCacheKeys(); // Refresh cache keys
      toast({
        title: "Success",
        variant: "success",
        description: "Cache key deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting cache key:", error);
      toast({
        title: "Error",
        description: "Failed to delete cache key",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteAllCaches() {
    try {
      await deleteAllCaches();
      fetchCacheKeys(); // Refresh cache keys
      toast({
        title: "Success",
        variant: "success",
        description: "All caches deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting all caches:", error);
      toast({
        title: "Error",
        description: "Failed to delete all caches",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    fetchCacheKeys();
  }, []);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-2">Cache Management</h2>
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Cache Management</h2>
      <Button variant="destructive" onClick={handleDeleteAllCaches}>
        Delete All Caches
      </Button>
      <ul>
        {cacheKeys.map((key) => (
          <li key={key} className="mb-2">
            {key}
            <Button
              onClick={() => handleDeleteCacheKey(key)}
              variant="destructive"
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CacheManagement;
