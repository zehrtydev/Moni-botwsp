export const greetingMessages = [
  "¡Hola! 👋 Soy Moni, tu asistente de gastos 💜\n\nPuedes escribirme algo como:\n\n💸 Gasté 20 lucas en almuerzo\n📊 ¿Cuánto llevo gastado este mes?\n🎯 Presupuesto alimentación 500 mil",
  "¡Holaa! 😊 Qué gusto leerte. Soy Moni y estoy lista para ayudarte con tus gastos 💜\n\nPuedes decirme, por ejemplo:\n💸 Gasté 20 mil en transporte\n📊 ¿Cuánto he gastado este mes?",
  "¡Hola! ✨ Soy Moni. Vamos a tener tus gastos bajo control 💜\n\nCuéntame algo como:\n💸 Compré un almuerzo por 15 mil\n🎯 Presupuesto de alimentación 500 mil",
] as const;

export const welcomeMessage = "¡Bienvenido a tu espacio financiero! 👋💜\n\nYa puedes registrar tu primer gasto escribiéndome algo como:\n💸 Gasté 20 lucas en almuerzo\n\nYo lo reviso contigo antes de guardarlo 😊";

export function buildPairingMessage(code: string) {
  return `¡Bienvenido a tu espacio financiero! 👋💜\n\nPara conectar este chat con tu cuenta, responde con este código:\n🔐 *${code}*\n\nDespués podrás registrar gastos normalmente, por ejemplo:\n💸 Gasté 20 lucas en almuerzo`;
}

export const correctionSuccessMessages = [
  "¡Listo! ✨ Corregí tu último gasto correctamente.",
  "¡Hecho! 🛠️ Actualicé ese gasto por ti.",
  "Corrección aplicada ✅ Tu último gasto ya quedó actualizado.",
] as const;

export const correctionHelpMessages = [
  "No entendí la corrección 🤔\n\nPrueba: *Corrige el último gasto, eran 45000* o *cambia la categoría a Alimentación*.",
  "Puedo ayudarte a corregirlo 😊\n\nEscribe: *Corrige el último gasto, eran 20 mil* o indica la nueva categoría.",
  "Hmm, no logré interpretar esa corrección 😅\n\nEjemplo: *Corrige el último gasto, eran 45 lucas*.",
] as const;

export const expenseNotUnderstoodMessages = [
  "No logré identificar un gasto 🤔\n\nPrueba escribiendo algo como: *Gasté 20 mil en una hamburguesa* 💸",
  "No encontré el monto de ese gasto 😅\n\nPuedes decirme: *Almuerzo 15 mil* o *pagué 30 lucas de gasolina*.",
  "Quiero ayudarte, pero me faltó entender el gasto 💜\n\nEscríbeme el valor y en qué lo gastaste, por ejemplo: *20k en transporte*.",
] as const;

export const thanksMessages = [
  "¡Con gusto! 😊 Aquí estoy para ayudarte a organizar tus gastos 💜",
  "¡Para eso estoy! ✨ Cuando quieras, seguimos registrando tus gastos.",
  "¡De nada! 💜 Moni queda atenta para tu próximo gasto.",
] as const;

export function pickMessage<T>(messages: readonly T[]) {
  return messages[Math.floor(Math.random() * messages.length)]!;
}

export function buildExpenseProposal(monto: number, categoria: string, descripcion: string) {
  const amount = `$${monto.toLocaleString("es-CO")} COP`;
  return pickMessage([
    `Te propongo registrar este gasto 💸\n\n${amount} en ${categoria}\n📝 ${descripcion}\n\n¿Lo guardo? Responde *sí* o *no* 😊`,
    `Esto es lo que entendí 👀\n\n💸 ${amount}\n🏷️ ${categoria}\n📝 ${descripcion}\n\n¿Está correcto? Respóndeme *sí* o *no*.`,
    `¡Listo, revisemos este gasto! ✨\n\n${amount} · ${categoria}\n📝 ${descripcion}\n\nConfírmame con *sí* para guardarlo o *no* para descartarlo.`,
  ]);
}
