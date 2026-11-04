import { z } from 'zod';
import { aiModel, AI_MODELS } from './ai-models.ts';
import { storedAiModelSchema } from './ai-contract.ts';

export const aiModelStatusSchema = z.object({
  available: z.boolean(), configured: z.boolean(), enabled: z.boolean(), model: storedAiModelSchema,
  priceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  models: z.array(z.object({
    id: storedAiModelSchema, label: z.string().min(1).max(80), enabled: z.boolean(),
    inputUsdPerMillion: z.number().finite().min(0).max(10000), outputUsdPerMillion: z.number().finite().min(0).max(10000),
  }).strict()).length(AI_MODELS.length).refine(models => new Set(models.map(m => m.id)).size === AI_MODELS.length && models.every(m => !!aiModel(m.id))),
}).strict();
export type AiModelStatus = z.infer<typeof aiModelStatusSchema>;
