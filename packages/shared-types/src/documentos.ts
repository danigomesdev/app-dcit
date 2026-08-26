import { z } from "zod";

export const AdmissionDocumentInputSchema = z.object({
  title: z.string().min(1),
  photoUri: z.string().optional(),
});
export type AdmissionDocumentInput = z.infer<typeof AdmissionDocumentInputSchema>;

// The mobile form collects this as a plain "DD/MM/AAAA" text field, not a
// date picker — validate the shape here and let the service parse it.
const DATE_BR_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

export const CertificationInputSchema = z.object({
  name: z.string().min(1),
  institution: z.string().min(1),
  validUntil: z.string().regex(DATE_BR_PATTERN, "Use o formato DD/MM/AAAA"),
});
export type CertificationInput = z.infer<typeof CertificationInputSchema>;
