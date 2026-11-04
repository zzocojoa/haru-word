import {z} from 'zod';
export const FEEDBACK_RESPONSE_TTL=24*60*60*1000;
export const FEEDBACK_RECEIPT_TTL=7*24*60*60*1000;
export const FEEDBACK_PENDING_WINDOW=2*60*1000;
export const receiptRequestFields={requestId:z.string().uuid().optional(),requestStartedAt:z.number().int().nonnegative().optional()};
export type ReceiptRequest={requestId?:string;requestStartedAt?:number};
export const pairedReceiptFields=(v:ReceiptRequest)=>(v.requestId===undefined)===(v.requestStartedAt===undefined);
export const receiptMetadataSchema=z.object({requestId:z.string().uuid(),state:z.enum(['pending','unknown','completed','failed','expired','invalidated']),persisted:z.boolean()});
export type FeedbackReceipt=z.infer<typeof receiptMetadataSchema>;
