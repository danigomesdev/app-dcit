import { z } from "zod";
import { statusUpdateSchema } from "./status-update";

// A device-local file:// path is never reachable outside that device, so
// the mobile app now sends the actual image as a data: URL instead — this
// pattern match rejects the old (now-meaningless) local-path shape early.
const PHOTO_DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,/;

export const AtestadoInputSchema = z.object({
  cid: z.string().min(1),
  crm: z.string().min(1),
  medico: z.string().min(1),
  dias: z.number().int().positive(),
  photoDataUrl: z.string().regex(PHOTO_DATA_URL_PATTERN).optional(),
});
export type AtestadoInput = z.infer<typeof AtestadoInputSchema>;

export const AtestadoStatusUpdateSchema = statusUpdateSchema();
export type AtestadoStatusUpdate = z.infer<typeof AtestadoStatusUpdateSchema>;
