import { infrai, type QueueMessage } from "./infrai_queue.js";
import { executeLegalJob, legalJobSchema, type JobResult } from "./legal_job.js";

const CONCURRENCY = 3;
const STARTS_PER_SECOND = 2;

class StartRateLimiter {
  private nextStart = 0;
  private chain = Promise.resolve();

  schedule(): Promise<void> {
    const turn = this.chain.then(async () => {
      const now = Date.now();
      const delay = Math.max(0, this.nextStart - now);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      this.nextStart = Date.now() + 1_000 / STARTS_PER_SECOND;
    });
    this.chain = turn.catch(() => undefined);
    return turn;
  }
}

async function handle(message: QueueMessage, limiter: StartRateLimiter): Promise<JobResult> {
  await limiter.schedule();
  const job = legalJobSchema.parse(message.payload);
  const result = await executeLegalJob(job);
  await infrai.queue.ack(message.message_id);
  return result;
}

export async function runWorkerOnce(): Promise<JobResult[]> {
  const batch = await infrai.queue.consume(CONCURRENCY, 60);
  const messages = batch.messages ?? [];
  const limiter = new StartRateLimiter();
  return Promise.all(messages.slice(0, CONCURRENCY).map((message) => handle(message, limiter)));
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const results = await runWorkerOnce();
  for (const result of results) console.log(JSON.stringify(result));
}
