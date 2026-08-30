import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { extractExpenseDraft } from "@/lib/expense-parser";
import { extractIncomeDraft } from "@/lib/income-parser";
import { interpretExpenseWithAI } from "@/lib/ai-expense-interpreter";
import { isBudgetCommand, parseBudgetCommand } from "@/lib/budget-parser";
import { isCorrectionCommand, isGreeting, isThanks, parseCorrectionCommand, parseExpenseQuery } from "@/lib/whatsapp-commands";
import { sendEvolutionButtons, sendEvolutionText } from "@/lib/evolution";
import { incomingMessageSchema, normalizeEvolutionPayload, verifyWebhookSecretHeader, verifyWebhookSignature } from "@/lib/whatsapp";
import { buildExpenseProposal, buildIncomeProposal, correctionHelpMessages, correctionSuccessMessages, expenseNotUnderstoodMessages, greetingMessages, pickMessage, thanksMessages } from "@/lib/whatsapp-messages";
import { hashPairingCode, isPairingCode } from "@/lib/whatsapp-pairing";

export const runtime = "nodejs";

async function reply(number: string, text: string) {
  try { await sendEvolutionText(number, text); }
  catch (error) { console.error("whatsapp_reply_failed", error); }
}

async function replyWithConfirmationButtons(number: string, text: string, title = "Confirmar movimiento") {
  try {
    await sendEvolutionButtons(number, title, text, "También puedes escribir sí o no.", [
      { id: "confirm_expense", title: "✅ Sí, guardar", displayText: "✅ Sí, guardar" },
      { id: "reject_expense", title: "❌ No, descartar", displayText: "❌ No, descartar" },
    ]);
  } catch (error) {
    console.warn("whatsapp_buttons_unavailable", error instanceof Error ? error.message : "unknown_error");
    await reply(number, `${text}\n\n1️⃣ Sí, guardar\n2️⃣ No, descartar`);
  }
}

async function processIncomeMessage(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, number: string, message: { mensaje_origen_id: string; contenido: string; timestamp: string }) {
  const { data: active } = await supabase.from("ingresos").select("id, monto, estado").eq("usuario_id", userId).eq("estado", "pendiente_confirmacion").maybeSingle();
  const command = message.contenido.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (active) {
    if (["si", "sí", "confirmar", "confirmado", "1", "confirm_expense"].includes(command)) {
      const { error } = await supabase.from("ingresos").update({ estado: "confirmado", confirmado_en: new Date().toISOString() }).eq("id", active.id).eq("usuario_id", userId);
      if (error) throw error;
      await reply(number, `¡Ingreso confirmado! ✅\n$${Number(active.monto).toLocaleString("es-CO")} COP sumados a tu balance 💜`);
      return true;
    }
    if (["no", "cancelar", "descartar", "2", "reject_expense"].includes(command)) {
      const { error } = await supabase.from("ingresos").update({ estado: "rechazado" }).eq("id", active.id).eq("usuario_id", userId);
      if (error) throw error;
      await reply(number, "Listo, descarté ese ingreso 🗑️");
      return true;
    }
    await reply(number, "Casi listo 😊 Responde *sí* para sumar el ingreso o *no* para descartarlo.");
    return true;
  }

  const draft = extractIncomeDraft(message.contenido, new Date(message.timestamp));
  if (!draft) return false;
  const { data: category } = await supabase.from("categorias_ingreso").select("id").eq("nombre", draft.categoria).maybeSingle();
  if (!category) throw new Error(`Categoría de ingreso no configurada: ${draft.categoria}`);
  const { error } = await supabase.from("ingresos").insert({
    usuario_id: userId,
    fecha_ingreso: draft.fecha_ingreso,
    monto: draft.monto,
    categoria_id: category.id,
    descripcion: draft.descripcion,
    estado: "pendiente_confirmacion",
    origen: "texto",
    texto_original: message.contenido,
    mensaje_origen_id: message.mensaje_origen_id,
  });
  if (error) throw error;
  await replyWithConfirmationButtons(number, buildIncomeProposal(draft.monto, draft.categoria, draft.descripcion), "Confirmar ingreso");
  return true;
}

function currentMonthStart() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-01`;
}

async function processBudgetCommand(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, number: string, text: string) {
  if (!isBudgetCommand(text)) return false;
  const command = parseBudgetCommand(text);
  if (!command) {
    await reply(number, "No alcancé a entender ese presupuesto 🤔\n\nPrueba así: *Presupuesto alimentación 500 mil* 🎯");
    return true;
  }
  const { data: category } = await supabase.from("categorias").select("id, nombre").eq("nombre", command.categoria).maybeSingle();
  if (!category) {
    await reply(number, "Esa categoría todavía no está disponible 😅 Revisa las categorías configuradas en Moni.");
    return true;
  }
  const { error } = await supabase.from("presupuestos_mensuales").upsert({ usuario_id: userId, categoria_id: category.id, mes: currentMonthStart(), monto_limite: command.monto, actualizado_en: new Date().toISOString() }, { onConflict: "usuario_id,categoria_id,mes" });
  if (error) throw error;
  await reply(number, `¡Listo! 🎯 Dejé ${category.nombre} con un presupuesto de $${command.monto.toLocaleString("es-CO")} COP para este mes.`);
  return true;
}

async function processCorrectionCommand(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, number: string, text: string) {
  if (!isCorrectionCommand(text)) return false;
  const correction = parseCorrectionCommand(text);
  if (!correction || "invalid" in correction) {
    await reply(number, pickMessage(correctionHelpMessages));
    return true;
  }
  const { data: expense, error: expenseError } = await supabase.from("gastos").select("id, monto, descripcion").eq("usuario_id", userId).eq("estado", "confirmado").order("creado_en", { ascending: false }).limit(1).maybeSingle();
  if (expenseError) throw expenseError;
  if (!expense) { await reply(number, "Todavía no tienes gastos confirmados para corregir 😊"); return true; }
  const update: { monto?: number; categoria_id?: string } = {};
  if ("monto" in correction) update.monto = correction.monto;
  if ("categoria" in correction) {
    const { data: category } = await supabase.from("categorias").select("id").eq("nombre", correction.categoria).maybeSingle();
    if (!category) { await reply(number, "No encontré esa categoría 😕 Revisa las categorías disponibles en Moni."); return true; }
    update.categoria_id = category.id;
  }
  const { data: updatedExpense, error } = await supabase.from("gastos").update(update).eq("id", expense.id).eq("usuario_id", userId).select("id").maybeSingle();
  if (error) throw error;
  if (!updatedExpense) throw new Error("No se pudo actualizar el gasto seleccionado");
  await reply(number, pickMessage(correctionSuccessMessages));
  return true;
}

async function processExpenseQuery(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, number: string, text: string) {
  const query = parseExpenseQuery(text);
  if (!query) return false;
  if (query.kind === "invalid") { await reply(number, "No reconocí esa categoría 😕 Usa una de las categorías configuradas en Moni."); return true; }
  const month = currentMonthStart();
  const { data: category } = query.categoria ? await supabase.from("categorias").select("id, nombre").eq("nombre", query.categoria).maybeSingle() : { data: null };
  if (query.categoria && !category) { await reply(number, "No encontré esa categoría 😕 Revisa cómo aparece en Moni."); return true; }
  let expenseQuery = supabase.from("gastos").select("monto").eq("usuario_id", userId).eq("estado", "confirmado").gte("fecha_gasto", month);
  if (category) expenseQuery = expenseQuery.eq("categoria_id", category.id);
  const { data: expenses, error } = await expenseQuery;
  if (error) throw error;
  const spent = (expenses ?? []).reduce((sum, expense) => sum + Number(expense.monto ?? 0), 0);
  if (query.kind === "spent") {
    await reply(number, query.categoria ? `Este mes llevas $${spent.toLocaleString("es-CO")} COP en ${query.categoria} 💸` : `Este mes llevas $${spent.toLocaleString("es-CO")} COP gastados 💸`);
    return true;
  }
  if (!category) { await reply(number, "Indícame la categoría 😊\nEjemplo: *¿Cuánto presupuesto me queda para transporte?*"); return true; }
  const { data: budget } = await supabase.from("presupuestos_mensuales").select("monto_limite").eq("usuario_id", userId).eq("categoria_id", category.id).eq("mes", month).maybeSingle();
  if (!budget) { await reply(number, `Aún no tienes presupuesto para ${category.nombre} este mes 🎯`); return true; }
  const remaining = Number(budget.monto_limite) - spent;
  await reply(number, remaining >= 0 ? `Te quedan $${remaining.toLocaleString("es-CO")} COP para ${category.nombre} este mes 💚` : `Te pasaste del presupuesto de ${category.nombre} por $${Math.abs(remaining).toLocaleString("es-CO")} COP 🔥`);
  return true;
}

async function processExpenseMessage(supabase: ReturnType<typeof createSupabaseAdminClient>, message: { mensaje_origen_id: string; numero_whatsapp: string; contenido: string; tipo: string; timestamp: string }) {
  const { data: user } = await supabase.from("usuarios").select("id").eq("numero_whatsapp", message.numero_whatsapp).maybeSingle();
  if (!user) {
    await reply(message.numero_whatsapp, "¡Hola! 👋 Tu número todavía no está vinculado a Moni. Regístralo desde el dashboard para comenzar 💜");
    return null;
  }
  if (await processIncomeMessage(supabase, user.id, message.numero_whatsapp, message)) return null;
  if (await processBudgetCommand(supabase, user.id, message.numero_whatsapp, message.contenido.trim())) return null;
  if (await processCorrectionCommand(supabase, user.id, message.numero_whatsapp, message.contenido.trim())) return null;
  if (await processExpenseQuery(supabase, user.id, message.numero_whatsapp, message.contenido.trim())) return null;

  const { data: active } = await supabase.from("gastos").select("id, estado, monto, fecha_gasto, categoria_id, descripcion").eq("usuario_id", user.id).in("estado", ["incompleto", "pendiente_confirmacion"]).maybeSingle();
  const command = message.contenido.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (active?.estado === "pendiente_confirmacion") {
    if (["si", "sí", "confirmar", "confirmado", "1", "confirm_expense"].includes(command)) {
      const { data, error } = await supabase.rpc("transicionar_gasto", { p_gasto_id: active.id, p_actor_usuario_id: user.id, p_estado_destino: "confirmado", p_actualizacion: {} });
      if (error) throw error;
      await reply(message.numero_whatsapp, `¡Gasto confirmado! ✅\n$${Number(data?.monto ?? active.monto).toLocaleString("es-CO")} COP guardados en Moni 💜`);
      return active.id;
    }
    if (["no", "cancelar", "descartar", "2", "reject_expense"].includes(command)) {
      const { error } = await supabase.rpc("transicionar_gasto", { p_gasto_id: active.id, p_actor_usuario_id: user.id, p_estado_destino: "rechazado", p_actualizacion: {} });
      if (error) throw error;
      await reply(message.numero_whatsapp, "Listo, descarté ese gasto 🗑️");
      return active.id;
    }
    await reply(message.numero_whatsapp, "Casi listo 😊 Responde *sí* para confirmar o *no* para descartar el gasto.");
    return active.id;
  }

  if (isGreeting(message.contenido)) {
    await reply(message.numero_whatsapp, pickMessage(greetingMessages));
    return null;
  }

  if (isThanks(message.contenido)) {
    await reply(message.numero_whatsapp, pickMessage(thanksMessages));
    return null;
  }

  if (message.tipo === "imagen") {
    if (active?.estado === "incompleto") {
      await reply(message.numero_whatsapp, "Ya tengo un comprobante pendiente 📎 Envíame el monto para completarlo, por ejemplo: *35000 en alimentación*.");
      return active.id;
    }
    const { data: expense, error } = await supabase.from("gastos").insert({ usuario_id: user.id, estado: "incompleto", origen: "imagen", texto_original: message.contenido || "Comprobante recibido por WhatsApp", mensaje_origen_id: message.mensaje_origen_id }).select("id").single();
    if (error) throw error;
    await reply(message.numero_whatsapp, "¡Recibí tu comprobante! 📎 Envíame el monto para completar el gasto, por ejemplo: *35000 en alimentación*.");
    return expense.id;
  }

  const receivedAt = new Date(message.timestamp);
  const deterministicDraft = extractExpenseDraft(message.contenido, receivedAt);
  let draft = deterministicDraft;
  if (!draft || draft.categoria === "Otros") {
    const aiResult = await interpretExpenseWithAI(message.contenido, receivedAt);
    if (aiResult && aiResult.confianza >= 0.78) draft = aiResult.draft;
  }
  if (!draft) {
    if (active) await reply(message.numero_whatsapp, "Me falta el monto 😊 Envíamelo así: *20000* o *20 mil*.");
    else await reply(message.numero_whatsapp, pickMessage(expenseNotUnderstoodMessages));
    return active?.id ?? null;
  }

  const { data: category } = await supabase.from("categorias").select("id").eq("nombre", draft.categoria).maybeSingle();
  const update = { monto: draft.monto, fecha_gasto: draft.fecha_gasto, categoria_id: category?.id, descripcion: draft.descripcion };
  let expenseId = active?.id;
  if (active) {
    const { error } = await supabase.rpc("transicionar_gasto", { p_gasto_id: active.id, p_actor_usuario_id: user.id, p_estado_destino: "pendiente_confirmacion", p_actualizacion: update });
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("gastos").insert({ usuario_id: user.id, ...update, estado: "pendiente_confirmacion", origen: message.tipo, texto_original: message.contenido, mensaje_origen_id: message.mensaje_origen_id }).select("id").single();
    if (error) throw error;
    expenseId = data.id;
  }
  await replyWithConfirmationButtons(message.numero_whatsapp, buildExpenseProposal(draft.monto, draft.categoria, draft.descripcion));
  return expenseId;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return NextResponse.json({ success: false, error: "Payload demasiado grande" }, { status: 413 });
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const isPlaceholderSecret = !secret || secret.startsWith("replace-with-");
  const signed = verifyWebhookSignature(rawBody, request.headers.get("x-webhook-signature"), secret ?? "");
  const headerSecret = verifyWebhookSecretHeader(request.headers.get("x-webhook-secret"), secret ?? "");
  if (process.env.NODE_ENV === "production" && isPlaceholderSecret) {
    return NextResponse.json({ success: false, error: "Webhook no configurado" }, { status: 503 });
  }
  if (!secret || (!signed && !headerSecret)) {
    return NextResponse.json({ success: false, error: "Firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 }); }

  const evolution = normalizeEvolutionPayload(payload);
  if (evolution.kind === "ignored") return NextResponse.json({ success: true, ignored: true });
  if (evolution.kind === "lid") {
    const admin = createSupabaseAdminClient();
    const instance = request.headers.get("x-whatsapp-instance") ?? evolution.instance;

    if (isPairingCode(evolution.message.contenido)) {
      const { data: pendingPairing, error: pairingError } = await admin
        .from("whatsapp_vinculaciones_pendientes")
        .select("id, usuario_id, numero_whatsapp")
        .eq("codigo_hash", hashPairingCode(evolution.message.contenido))
        .is("usado_en", null)
        .gt("expira_en", new Date().toISOString())
        .maybeSingle();
      if (pairingError) return NextResponse.json({ success: false, error: "No se pudo validar el código" }, { status: 500 });
      if (pendingPairing) {
        const { error: mappingError } = await admin.from("whatsapp_contactos_lid").upsert({
          instancia: instance,
          lid: evolution.lid,
          numero_whatsapp: pendingPairing.numero_whatsapp,
          actualizado_en: new Date().toISOString(),
        }, { onConflict: "instancia,lid" });
        if (mappingError) return NextResponse.json({ success: false, error: "No se pudo asociar el contacto" }, { status: 500 });
        const { error: usedError } = await admin.from("whatsapp_vinculaciones_pendientes").update({ usado_en: new Date().toISOString() }).eq("id", pendingPairing.id);
        if (usedError) return NextResponse.json({ success: false, error: "No se pudo completar la vinculación" }, { status: 500 });
        await reply(pendingPairing.numero_whatsapp, "¡Listo! ✅ Este chat ya está conectado con tu cuenta de Moni 💜\n\nAhora puedes enviarme tu primer gasto, por ejemplo: *Gasté 20 lucas en almuerzo*.");
        return NextResponse.json({ success: true, paired: true }, { status: 202 });
      }
    }

    const { data: knownContact, error: knownContactError } = await admin.from("whatsapp_contactos_lid").select("numero_whatsapp").eq("instancia", instance).eq("lid", evolution.lid).maybeSingle();
    if (knownContactError) return NextResponse.json({ success: false, error: "No se pudo resolver el contacto" }, { status: 500 });
    let resolvedNumber = knownContact?.numero_whatsapp;
    if (!resolvedNumber) {
      const { data: linkedUsers, error } = await admin.from("usuarios").select("numero_whatsapp").not("numero_whatsapp", "is", null);
      if (error) return NextResponse.json({ success: false, error: "No se pudo resolver el contacto" }, { status: 500 });
      const uniqueNumbers = [...new Set((linkedUsers ?? []).map((entry) => entry.numero_whatsapp).filter((number): number is string => Boolean(number)))];
      if (uniqueNumbers.length !== 1) return NextResponse.json({ success: true, ignored: true, reason: "contact_lid_requires_contact_mapping" });
      resolvedNumber = uniqueNumbers[0];
      await admin.from("whatsapp_contactos_lid").upsert({ instancia: instance, lid: evolution.lid, numero_whatsapp: resolvedNumber, actualizado_en: new Date().toISOString() }, { onConflict: "instancia,lid" });
    }
    const candidate = { ...evolution.message, numero_whatsapp: resolvedNumber };
    const parsed = incomingMessageSchema.safeParse(candidate);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Payload no válido" }, { status: 400 });
    try {
      const { error: insertError } = await admin.from("mensajes_entrantes").insert({
        proveedor: "evolution", instancia: instance, mensaje_origen_id: parsed.data.mensaje_origen_id,
        numero_whatsapp: parsed.data.numero_whatsapp, tipo: parsed.data.tipo,
        recibido_en: parsed.data.timestamp, estado_procesamiento: "recibido",
        media_url: parsed.data.media,
      });
      if (insertError?.code === "23505") return NextResponse.json({ success: true, duplicate: true });
      if (insertError) throw insertError;
      const gastoId = await processExpenseMessage(admin, parsed.data);
      await admin.from("mensajes_entrantes").update({ estado_procesamiento: "procesado", procesado_en: new Date().toISOString(), gasto_id: gastoId }).eq("instancia", instance).eq("mensaje_origen_id", parsed.data.mensaje_origen_id);
      return NextResponse.json({ success: true, accepted: true, gastoId }, { status: 202 });
    } catch (error) {
      console.error("whatsapp_lid_webhook_failed", error);
      return NextResponse.json({ success: false, error: "No se pudo registrar el mensaje" }, { status: 500 });
    }
  }
  const candidate = evolution.kind === "message" ? evolution.message : payload;
  const parsed = incomingMessageSchema.safeParse(candidate);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Payload no válido" }, { status: 400 });

  const instance = request.headers.get("x-whatsapp-instance") ?? (evolution.kind === "message" ? evolution.instance : null);
  if (!instance) return NextResponse.json({ success: false, error: "Falta la instancia" }, { status: 400 });

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("mensajes_entrantes").insert({
      proveedor: request.headers.get("x-whatsapp-provider") ?? "evolution",
      instancia: instance,
      mensaje_origen_id: parsed.data.mensaje_origen_id,
      numero_whatsapp: parsed.data.numero_whatsapp,
      tipo: parsed.data.tipo,
      recibido_en: parsed.data.timestamp,
      estado_procesamiento: "recibido",
      media_url: parsed.data.media,
    });
    if (error?.code === "23505") return NextResponse.json({ success: true, duplicate: true });
    if (error) throw error;
    const gastoId = await processExpenseMessage(admin, parsed.data);
    await admin.from("mensajes_entrantes").update({ estado_procesamiento: "procesado", procesado_en: new Date().toISOString(), gasto_id: gastoId }).eq("proveedor", request.headers.get("x-whatsapp-provider") ?? "evolution").eq("instancia", instance).eq("mensaje_origen_id", parsed.data.mensaje_origen_id);
    return NextResponse.json({ success: true, accepted: true, gastoId }, { status: 202 });
  } catch (error) {
    console.error("whatsapp_webhook_failed", error);
    return NextResponse.json({ success: false, error: "No se pudo registrar el mensaje" }, { status: 500 });
  }
}
