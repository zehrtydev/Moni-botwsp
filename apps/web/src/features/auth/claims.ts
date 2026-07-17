interface ClaimsResult {
  data: { claims?: Record<string, unknown> } | null;
  error: unknown;
}

export function getAuthenticatedUserId(result: ClaimsResult) {
  if (result.error) {
    return null;
  }

  const subject = result.data?.claims?.sub;

  return typeof subject === "string" && subject.length > 0
    ? subject
    : null;
}
