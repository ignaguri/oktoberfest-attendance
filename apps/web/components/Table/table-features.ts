import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

export type DataTableFeatures = typeof dataTableFeatures;
