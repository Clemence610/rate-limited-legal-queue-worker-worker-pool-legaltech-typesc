import assert from "node:assert/strict";
import test from "node:test";
import { executeLegalJob, legalJobSchema } from "../src/legal_job.js";

test("a signed document job produces the delivery state", async () => {
  const job = legalJobSchema.parse({
    kind: "signed_document_delivery",
    matterId: "MAT-204",
    documentId: "DOC-88",
    recipientEmail: "counsel@example.test"
  });

  assert.deepEqual(await executeLegalJob(job), {
    matterId: "MAT-204",
    state: "signed_document_delivered",
    detail: "DOC-88 -> counsel@example.test"
  });
});

test("a malformed deadline is rejected at the request boundary", () => {
  const result = legalJobSchema.safeParse({
    kind: "deadline_follow_up",
    matterId: "MAT-205",
    deadline: "next Tuesday",
    ownerEmail: "owner@example.test"
  });

  assert.equal(result.success, false);
});
