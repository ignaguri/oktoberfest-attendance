import { useState, useEffect } from "react";
import { fetchTents } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  useEffect(() => {
    const loadTents = async () => {
      try {
        setIsLoading(true);
        const fetchedTents = await fetchTents();
        const groupedTents = fetchedTents.reduce((acc, tent) => {
          const category = tent.category
            ? tent.category.charAt(0).toUpperCase() + tent.category.slice(1)
            : "Uncategorized";
          const existingCategory = acc.find((g) => g.category === category);
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
        }, [] as TentGroup[]);
        setTents(groupedTents);
        setError(null);
      } catch (err) {
        setError("Failed to load tents. Please try again later.");
        toast({
          title: "Error loading tents",
          description: "Please try again later",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTents();
  }, [toast]);

  return { tents, isLoading, error };
}
