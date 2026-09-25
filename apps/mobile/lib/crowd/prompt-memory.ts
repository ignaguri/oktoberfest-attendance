/**
 * Remembers which tents the post-save crowd prompt already asked about today,
 * so logging another drink in the same tent does not reopen it.
 *
 * Only the latest festival day is kept: a record from an earlier day reads as
 * empty, which keeps the stored value from growing. Showing the prompt counts,
 * whether the user reports or skips; the crowd FAB is there to report again.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/lib/logger";

const PROMPTED_KEY = "@prostcounter/crowd-prompt/prompted";

interface PromptedRecord {
  date: string;
  tentIds: string[];
}

async function readPromptedTents(date: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PROMPTED_KEY);
    if (!raw) {
      return [];
    }
    const record = JSON.parse(raw) as PromptedRecord;
    if (record.date !== date || !Array.isArray(record.tentIds)) {
      return [];
    }
    return record.tentIds;
  } catch (error) {
    logger.warn("Failed to read crowd prompt memory:", { error });
    return [];
  }
}

export async function filterUnpromptedTents(tentIds: string[], date: string): Promise<string[]> {
  const prompted = await readPromptedTents(date);
  return tentIds.filter((id) => !prompted.includes(id));
}

export async function recordCrowdPrompted(tentIds: string[], date: string): Promise<void> {
  const prompted = await readPromptedTents(date);
  const record: PromptedRecord = {
    date,
    tentIds: Array.from(new Set([...prompted, ...tentIds])),
  };
  try {
    await AsyncStorage.setItem(PROMPTED_KEY, JSON.stringify(record));
  } catch (error) {
    logger.warn("Failed to record crowd prompt:", { error });
  }
}
