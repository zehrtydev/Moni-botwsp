import type { LucideIcon } from "lucide-react";
import { CarFront, CircleHelp, CreditCard, GraduationCap, Gift, HeartPulse, House, PawPrint, Plane, ReceiptText, Scissors, ShoppingBag, Smartphone, Sparkles, Utensils, Wrench } from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  Alimentación: Utensils, Transporte: CarFront, Vivienda: House, Hogar: Wrench,
  Servicios: Smartphone, Compras: ShoppingBag, Salud: HeartPulse, "Cuidado personal": Scissors,
  Educación: GraduationCap, Ocio: Sparkles, Viajes: Plane, Deudas: CreditCard,
  Mascotas: PawPrint, "Familia y regalos": Gift, Otros: CircleHelp,
};

export function CategoryIcon({ category, size = 18 }: { category: string; size?: number }) {
  const Icon = categoryIcons[category] ?? ReceiptText;
  return <Icon size={size} strokeWidth={2.1} aria-hidden="true" />;
}
