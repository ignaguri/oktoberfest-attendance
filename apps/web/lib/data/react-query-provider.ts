"use client";

/**
 * React Query provider for Next.js (client components)
 *
 * Re-exports from @prostcounter/shared/data with "use client" directive
 * for Next.js App Router compatibility.
 */

export {
  useDataProvider,
  useGetQueryData,
  useInvalidateQueries,
  useMutation,
  useQuery,
  useSetQueryData,
} from "@prostcounter/shared/data";
