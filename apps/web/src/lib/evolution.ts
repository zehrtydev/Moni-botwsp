export async function sendEvolutionText(number: string, text: string) {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;
  if (!baseUrl || !apiKey || !instance) throw new Error("Falta la configuración de Evolution API.");
  const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: number.replace(/^\+/, ""), text }),
  });
  if (!response.ok) throw new Error(`Evolution API respondió ${response.status}.`);
}

type EvolutionButton = { id: string; title: string; displayText: string };

export async function sendEvolutionButtons(number: string, title: string, description: string, footer: string, buttons: EvolutionButton[]) {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;
  if (!baseUrl || !apiKey || !instance) throw new Error("Falta la configuración de Evolution API.");
  const response = await fetch(`${baseUrl}/message/sendButtons/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: number.replace(/^\+/, ""), title, description, footer, buttons }),
  });
  if (!response.ok) throw new Error(`Evolution API respondió ${response.status} al enviar botones.`);
}
