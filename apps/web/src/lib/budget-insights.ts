export type BudgetLevel = "baja" | "media" | "alta";

export function getBudgetLevel(spent: number, budget: number): BudgetLevel {
  if (budget <= 0 || spent <= 0) return "baja";
  const ratio = spent / budget;
  if (ratio > 1) return "alta";
  if (ratio >= 0.7) return "media";
  return "baja";
}

export function getBudgetLevelLabel(level: BudgetLevel) {
  return { baja: "Dentro del límite", media: "Cerca del límite", alta: "Límite superado" }[level];
}
