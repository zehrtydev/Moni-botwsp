const e164Pattern = /^\+[1-9][0-9]{7,14}$/;

export function normalizeE164(value: string): string {
  if (!e164Pattern.test(value)) {
    throw new Error("El número debe estar en formato E.164.");
  }

  return value;
}
