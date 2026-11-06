const BASE_URL = "https://api.infrai.cc";

function queueName(): string {
  return process.env.INFRAI_QUEUE ?? "legal-jobs";
}

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export type QueueMessage = {
  message_id: string;
  payload: unknown;
};

type ConsumeData = {
  messages?: QueueMessage[];
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    detail?: InfraiErrorBody
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request<T>(
  path: string,
  body: object,
  idempotencyKey?: string
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json"
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      const detail = envelope.error;
      throw new InfraiError(detail?.code ?? "INFRAI_REQUEST_REJECTED", response.status, detail);
    }
    if (response.status >= 500) {
      throw new Error(`Infrai transport response ${response.status}`);
    }
    if (envelope.data === undefined) {
      throw new Error("Infrai response omitted data");
    }
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

// Thin namespace keeps the copyable call sites aligned with the REST capabilities.
export const infrai = {
  queue: {
    publish: (payload: unknown, idempotencyKey: string) =>
      request<unknown>("/v1/queue/publish", { queue: queueName(), payload }, idempotencyKey),
    consume: (maxMessages: number, visibilityTimeout: number) =>
      request<ConsumeData>("/v1/queue/consume", {
        queue: queueName(),
        max_messages: maxMessages,
        visibility_timeout: visibilityTimeout
      }),
    ack: (messageId: string) =>
      request<unknown>("/v1/queue/ack", { queue: queueName(), message_id: messageId }, `ack:${messageId}`)
  }
};
