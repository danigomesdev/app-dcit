import { z } from "zod";

export const MuralPostInputSchema = z.object({
  glyph: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});
export type MuralPostInput = z.infer<typeof MuralPostInputSchema>;
