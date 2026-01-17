"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";

const clearCachesByServerAction = async (path: string) => {
  try {
    if (path) {
      revalidatePath(path);
    } else {
      revalidatePath("/");
    }
  } catch (error) {
    logger.error(
      "Error in clearCachesByServerAction",
      logger.serverAction("clearCachesByServerAction", { path }),
      error as Error,
    );
  }
};

export default clearCachesByServerAction;
