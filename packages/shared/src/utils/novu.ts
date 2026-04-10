/**
 * @novu/api client-side response validation drifts from the live API shape
 * (SDK v3.14.x). When the SDK throws ResponseValidationError, the write has
 * already succeeded server-side — we only need to tolerate the post-hoc
 * client-side check.
 */
export function isNovuResponseValidationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: string }).name === "ResponseValidationError";
}

/**
 * Runs a Novu SDK write and swallows ResponseValidationError as success.
 * All other errors propagate to the caller.
 */
export async function runNovuWriteTolerantly(
  op: () => Promise<unknown>,
  onRecover?: () => void,
): Promise<void> {
  try {
    await op();
  } catch (error) {
    if (isNovuResponseValidationError(error)) {
      onRecover?.();
      return;
    }
    throw error;
  }
}
