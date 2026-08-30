export type CategoryLevel = "baja" | "media" | "alta";

export function getCategoryLevel(amount: number, total: number): CategoryLevel {
  if (total <= 0 || amount <= 0) return "baja";
  const share = amount / total;
  if (share > 0.5) return "alta";
  if (share > 0.25) return "media";
  return "baja";
}

export function getCategoryLevelLabel(level: CategoryLevel) {
  return { baja: "Baja participación", media: "Participación media", alta: "Alta participación" }[level];
}
