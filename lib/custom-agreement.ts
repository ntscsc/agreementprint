export const CUSTOM_STATUSES = ['Submitted', 'Under Review', 'Clarification Required', 'Quote Sent', 'Quoted / Awaiting Payment', 'Accepted', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched', 'Completed', 'Declined', 'Cancelled'] as const;
export type CustomStatus = typeof CUSTOM_STATUSES[number];
export const MAX_SAMPLE_SIZE = 10 * 1024 * 1024;
export const SAMPLE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};
export interface CustomInput {
  agreementType: string; purpose: string; language: string; instructions: string;
  preferredDate: string; name: string; phone: string; email: string;
  extraCopies?: number; stampPaperDenomination?: 100 | 200;
  contactConsent: boolean; includeNotary?: boolean;
}
export interface SampleDescriptor { id: string; name: string; size: number; contentType: string; path: string; }
export interface CustomRequest extends CustomInput {
  courier?: { courierName: string; trackingNumber: string; dispatchedAt: string };
  deliveredAt?: string;
  publicReference?: string;
  acceptedAt?: string;
  quoteValidUntil?: string; quoteBreakdown?: QuoteBreakdown | null; quoteHistory?: QuoteRevision[];
  deadlineHistory?: { date: string; previousDate: string; reason: string; at: string }[];
  documents?: CustomDocument[];
  customerApproval?: { status: 'Pending' | 'Approved' | 'Changes requested'; documentId: string; at: string; message?: string };
  requestId: string; status: CustomStatus | 'Uploading'; createdAt: string; updatedAt: string;
  files: Record<string, SampleDescriptor>; quoteAmount?: number; quoteBaseAmount?: number; extraCopyFee?: number; expectedDate?: string;
  payment?: { status: 'Pending' | 'Paid' | 'Failed'; amount: number; merchantOrderId: string; startedAt?: string; checkoutClosed?: boolean; retryAvailable?: boolean; reviewRequired?: boolean; lastCheckedAt?: string };
  customerMessage?: string; customerReply?: string; internalNotes?: string; assignedTo?: string;
}
export interface QuoteBreakdown { drafting: number; stampPaper: number; notary: number; delivery: number; }
export interface QuoteRevision { at: string; amount: number; baseAmount: number; extraCopyFee: number; validUntil: string; breakdown?: QuoteBreakdown; }
export interface CustomDocument extends SampleDescriptor { kind: 'draft' | 'final'; uploadedAt: string; version: number; publishedAt?: string; }

// Older reviews could save a quote while leaving the request Submitted.
export function customQuoteStatus(request: { status?: string; quoteAmount?: number; quoteBaseAmount?: number; extraCopyFee?: number; payment?: { status?: string } }): string | undefined {
  if (request.payment?.status === 'Paid' && ['Submitted', 'Under Review', 'Quote Sent', 'Quoted / Awaiting Payment'].includes(request.status ?? '')) return 'Accepted';
  if (request.status === 'Submitted' && Number.isSafeInteger(request.quoteAmount) && request.quoteAmount! >= 1 && request.quoteAmount! <= 1_000_000) return 'Quoted / Awaiting Payment';
  return request.status;
}
function bounded(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateCustomInput(value: unknown): CustomInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request details are required.');
  const d = value as Record<string, unknown>;
  if (d.includeNotary !== undefined && typeof d.includeNotary !== 'boolean') throw new Error('Choose whether you need notary service.');
  const extraCopies = d.extraCopies === undefined ? 0 : d.extraCopies;
  if (typeof extraCopies !== 'number' || !Number.isSafeInteger(extraCopies) || extraCopies < 0 || extraCopies > 100) throw new Error('Choose a whole number of extra copies between 0 and 100.');
  const stampPaperDenomination = d.stampPaperDenomination === undefined ? 100 : d.stampPaperDenomination;
  if (stampPaperDenomination !== 100 && stampPaperDenomination !== 200) throw new Error('Choose a valid stamp denomination.');
  const result: CustomInput = {
    extraCopies, stampPaperDenomination,
    agreementType: bounded(d.agreementType, 'Agreement type', 2, 100), purpose: bounded(d.purpose, 'Purpose', 5, 1000),
    instructions: bounded(d.instructions, 'Customisation instructions', 10, 5000),
    language: bounded(d.language, 'Language', 2, 30), name: bounded(d.name, 'Name', 2, 100),
    phone: bounded(d.phone, 'Mobile number', 10, 10), email: bounded(d.email ?? '', 'Email', 0, 254),
    preferredDate: bounded(d.preferredDate ?? '', 'Preferred date', 0, 10), contactConsent: d.contactConsent === true, includeNotary: d.includeNotary === true,
  };
  if (!['English', 'Tamil'].includes(result.language)) throw new Error('Select a preferred language.');
  if (!/^[6-9]\d{9}$/.test(result.phone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Enter a valid email address.');
  if (result.preferredDate && !validDate(result.preferredDate)) throw new Error('Enter a valid preferred date.');
  if (!result.contactConsent) throw new Error('Please agree to contact about this request.');
  return result;
}
export function validateSample(value: unknown): { name: string; size: number; contentType: string } {
  if (!value || typeof value !== 'object') throw new Error('Invalid sample file.');
  const d = value as Record<string, unknown>;
  const name = bounded(d.name, 'File name', 1, 120);
  if (/[\\/\x00-\x1f\x7f]/.test(name)) throw new Error('Invalid file name.');
  const type = SAMPLE_TYPES[name.split('.').pop()!.toLowerCase()];
  if (!type || d.contentType !== type) throw new Error('Samples must be PDF, DOCX, JPG or PNG files.');
  if (typeof d.size !== 'number' || !Number.isSafeInteger(d.size) || d.size < 1 || d.size > MAX_SAMPLE_SIZE) throw new Error('Each sample must be between 1 byte and 10 MB.');
  return { name, size: d.size, contentType: type };
}
const transitions: Record<CustomStatus, readonly CustomStatus[]> = {
  Submitted: ['Under Review', 'Quoted / Awaiting Payment', 'Declined', 'Cancelled'],
  'Under Review': ['Clarification Required', 'Quote Sent', 'Quoted / Awaiting Payment', 'Declined', 'Cancelled'],
  'Clarification Required': ['Under Review', 'Declined', 'Cancelled'],
  'Quote Sent': ['Accepted', 'Quoted / Awaiting Payment', 'Under Review', 'Declined', 'Cancelled'],
  'Quoted / Awaiting Payment': ['Accepted', 'Under Review', 'Declined', 'Cancelled'],
  Accepted: ['In Progress', 'Cancelled'], 'In Progress': ['Awaiting Approval', 'Cancelled'],
  'Awaiting Approval': ['In Progress', 'Ready', 'Cancelled'], Ready: ['Dispatched', 'Cancelled'], Dispatched: ['Completed'],
  Completed: [], Declined: [], Cancelled: [],
};
export function canTransition(from: CustomStatus, to: CustomStatus) { return from === to || transitions[from]?.includes(to) === true; }
