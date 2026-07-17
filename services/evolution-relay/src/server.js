import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { toInboundRelayEvent } from "./evolution-event.js";
import { forwardSignedPayload } from "./forward.js";
import { signRelayPayload } from "./signature.js";

const maximumBodyBytes = 65_536;
const maximumConcurrentRequests = 16;
let activeRequests = 0;

function requiredEnvironment(name, minimumLength = 1) {
  const value = process.env[name]?.trim();

  if (!value || value.length < minimumLength) {
    throw new Error(`Falta la configuracion ${name}.`);
  }

  return value;
}

function authorized(actual, expected) {
  if (typeof actual !== "string") return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes);
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;

  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maximumBodyBytes) throw new Error("too-large");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const ingressSecret = requiredEnvironment("EVOLUTION_RELAY_INGRESS_SECRET", 32);
const signingSecret = requiredEnvironment("MONI_INBOUND_WEBHOOK_SECRET", 32);
const destination = new URL(requiredEnvironment("MONI_INBOUND_WEBHOOK_URL"));
const port = Number(process.env.PORT ?? "8090");

if (
  destination.protocol !== "https:" ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65_535
) {
  throw new Error("La configuracion del relay no es valida.");
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/webhooks/evolution") {
    response.writeHead(404).end();
    return;
  }

  if (!authorized(request.headers["x-moni-ingress-secret"], ingressSecret)) {
    response.writeHead(401).end();
    return;
  }

  if (activeRequests >= maximumConcurrentRequests) {
    response.writeHead(503, { "retry-after": "1" }).end();
    return;
  }

  activeRequests += 1;

  try {
    try {
      const normalized = toInboundRelayEvent(await readJson(request));

      if (!normalized) {
        response.writeHead(204).end();
        return;
      }

      const payload = JSON.stringify(normalized);
      const signed = signRelayPayload(
        payload,
        signingSecret,
        Math.floor(Date.now() / 1_000),
      );
      const delivered = await forwardSignedPayload({
        destination,
        payload,
        signature: signed.signature,
        timestamp: signed.timestamp,
      });

      response.writeHead(delivered ? 202 : 502).end();
    } catch (error) {
      response.writeHead(error?.message === "too-large" ? 413 : 400).end();
    }
  } finally {
    activeRequests -= 1;
  }
});

server.requestTimeout = 10_000;
server.headersTimeout = 5_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;
server.listen(port, "0.0.0.0", () => {
  console.log(`Evolution relay escuchando en el puerto ${port}.`);
});
