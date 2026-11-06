import { z } from "zod";

const matterIntake = z.object({
  kind: z.literal("matter_intake"),
  matterId: z.string().min(1),
  clientName: z.string().min(1),
  practiceArea: z.string().min(1)
});

const signedDocumentDelivery = z.object({
  kind: z.literal("signed_document_delivery"),
  matterId: z.string().min(1),
  documentId: z.string().min(1),
  recipientEmail: z.string().email()
});

const deadlineFollowUp = z.object({
  kind: z.literal("deadline_follow_up"),
  matterId: z.string().min(1),
  deadline: z.string().datetime(),
  ownerEmail: z.string().email()
});

export const legalJobSchema = z.discriminatedUnion("kind", [
  matterIntake,
  signedDocumentDelivery,
  deadlineFollowUp
]);

export type LegalJob = z.infer<typeof legalJobSchema>;

export type JobResult = {
  matterId: string;
  state: "intake_recorded" | "signed_document_delivered" | "follow_up_scheduled";
  detail: string;
};

export async function executeLegalJob(job: LegalJob): Promise<JobResult> {
  switch (job.kind) {
    case "matter_intake":
      return {
        matterId: job.matterId,
        state: "intake_recorded",
        detail: `${job.clientName} / ${job.practiceArea}`
      };
    case "signed_document_delivery":
      return {
        matterId: job.matterId,
        state: "signed_document_delivered",
        detail: `${job.documentId} -> ${job.recipientEmail}`
      };
    case "deadline_follow_up":
      return {
        matterId: job.matterId,
        state: "follow_up_scheduled",
        detail: `${job.deadline} -> ${job.ownerEmail}`
      };
  }
}
