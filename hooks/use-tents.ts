import { fetchTents } from "@/lib/sharedActions";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export interface TentOption {
  value: string;
  label: string;
}

export interface TentGroup {
  category: string;
  options: TentOption[];
}

export function useTents() {
  const [tents, setTents] = useState<TentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTents = async () => {
      try {
        setIsLoading(true);
        const fetchedTents = await fetchTents();
        const groupedTents = fetchedTents.reduce(
          (acc: TentGroup[], tent: any) => {
            const category = tent.category
              ? tent.category.charAt(0).toUpperCase() + tent.category.slice(1)
              : "Uncategorized";
            const existingCategory = acc.find(
              (g: TentGroup) => g.category === category,
            );
            if (existingCategory) {
              existingCategory.options.push({
                value: tent.id,
                label: tent.name,
              });
            } else {
              acc.push({
                category,
                options: [{ value: tent.id, label: tent.name }],
              });
            }
            return acc;
          },
          [] as TentGroup[],
        );
        setTents(groupedTents);
        setError(null);
      } catch {
        setError("Failed to load tents. Please try again later.");
        toast.error("Error loading tents", {
          description: "Please try again later",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTents();
  }, []);

  return { tents, isLoading, error };
}
