import { assertEquals, assertRejects } from "@std/assert";
import {
  createEvolutionClient,
  isAmbiguousEvolutionError,
  isRejectedEvolutionError,
  isRetryableEvolutionError,
} from "./evolution-client.ts";

const placeholderApiKey = ["test", "api", "key"].join("-");

Deno.test("Evolution sends a minimal text request without the E.164 plus", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetcher: typeof fetch = (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return Promise.resolve(new Response("{}", { status: 201 }));
  };
  const client = createEvolutionClient(
    {
      apiKey: placeholderApiKey,
      baseUrl: "https://evolution.example/",
      instance: "moni principal",
      timeoutMs: 100,
    },
    fetcher,
  );

  await client.sendText({
    phone: "+573001234567",
    text: "Tu codigo de Moni es 123456.",
  });

  assertEquals(
    capturedUrl,
    "https://evolution.example/message/sendText/moni%20principal",
  );
  const headers = new Headers(capturedInit?.headers);
  assertEquals(headers.get("apikey"), placeholderApiKey);
  assertEquals(headers.get("content-type"), "application/json");
  assertEquals(JSON.parse(String(capturedInit?.body)), {
    number: "573001234567",
    text: "Tu codigo de Moni es 123456.",
  });
});

Deno.test("Evolution failures remain generic", async () => {
  const client = createEvolutionClient(
    {
      apiKey: placeholderApiKey,
      baseUrl: "https://evolution.example",
      instance: "moni",
      timeoutMs: 100,
    },
    () => Promise.resolve(new Response("private detail", { status: 503 })),
  );

  await assertRejects(
    () =>
      client.sendText({
        phone: "+573001234567",
        text: "Tu codigo de Moni es 123456.",
      }),
    Error,
    "Evolution no pudo entregar el mensaje.",
  );
});

Deno.test("Evolution classifies permanent 4xx rejections", async () => {
  const client = createEvolutionClient(
    {
      apiKey: placeholderApiKey,
      baseUrl: "https://evolution.example",
      instance: "moni",
      timeoutMs: 100,
    },
    () => Promise.resolve(new Response("private detail", { status: 422 })),
  );

  try {
    await client.sendText({
      phone: "+573001234567",
      text: "Respuesta de Moni",
    });
    throw new Error("Expected sendText to reject");
  } catch (error) {
    assertEquals(isRejectedEvolutionError(error), true);
    assertEquals(isAmbiguousEvolutionError(error), false);
  }
});

Deno.test("Evolution classifies transient HTTP statuses for retry", async () => {
  for (const status of [408, 425, 429]) {
    const client = createEvolutionClient(
      {
        apiKey: placeholderApiKey,
        baseUrl: "https://evolution.example",
        instance: "moni",
        timeoutMs: 100,
      },
      () => Promise.resolve(new Response("private detail", { status })),
    );

    try {
      await client.sendText({
        phone: "+573001234567",
        text: "Respuesta de Moni",
      });
      throw new Error("Expected sendText to reject");
    } catch (error) {
      assertEquals(isRetryableEvolutionError(error), true);
      assertEquals(isRejectedEvolutionError(error), false);
      assertEquals(isAmbiguousEvolutionError(error), false);
    }
  }
});

Deno.test("Evolution requests stop before the Supabase hook deadline", async () => {
  const client = createEvolutionClient(
    {
      apiKey: placeholderApiKey,
      baseUrl: "https://evolution.example",
      instance: "moni",
      timeoutMs: 10,
    },
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      }),
  );

  await assertRejects(
    () =>
      client.sendText({
        phone: "+573001234567",
        text: "Tu codigo de Moni es 123456.",
      }),
    Error,
    "Evolution no pudo entregar el mensaje.",
  );
});
