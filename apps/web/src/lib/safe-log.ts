export function safeErrorCode(error: unknown) {
  return error instanceof Error ? error.name : "unknown_error";
}
