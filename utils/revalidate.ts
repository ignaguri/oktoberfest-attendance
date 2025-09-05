"use server";

import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

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
