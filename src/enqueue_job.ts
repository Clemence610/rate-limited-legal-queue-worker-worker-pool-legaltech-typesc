import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { infrai } from "./infrai_queue.js";
import { legalJobSchema } from "./legal_job.js";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("usage: npm run enqueue -- path/to/job.json");

  const source = await readFile(inputPath, "utf8");
  const job = legalJobSchema.parse(JSON.parse(source));
  const idempotencyKey = createHash("sha256")
    .update(`${job.kind}:${job.matterId}:${source}`)
    .digest("hex");

  await infrai.queue.publish(job, idempotencyKey);
  console.log(JSON.stringify({ accepted: true, matterId: job.matterId, kind: job.kind }));
}

await main();
