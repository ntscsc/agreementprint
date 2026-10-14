export const CUSTOM_STATUSES = ['Submitted', 'Under Review', 'Clarification Required', 'Quote Sent', 'Accepted', 'In Progress', 'Completed', 'Declined', 'Cancelled'] as const;
export type CustomStatus = typeof CUSTOM_STATUSES[number];
export const MAX_SAMPLE_SIZE = 10 * 1024 * 1024;
export const SAMPLE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};
export interface CustomInput {
  agreementType: string; purpose: string; language: string; instructions: string;
  preferredDate: string; name: string; phone: string; email: string;
  contactMethod: string; contactConsent: boolean;
}
export interface SampleDescriptor { id: string; name: string; size: number; contentType: string; path: string; }
export interface CustomRequest extends CustomInput {
  requestId: string; status: CustomStatus | 'Uploading'; createdAt: string; updatedAt: string;
  files: Record<string, SampleDescriptor>; quoteAmount?: number; expectedDate?: string;
  customerMessage?: string; customerReply?: string; internalNotes?: string; assignedTo?: string;
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
  const result = {
    agreementType: bounded(d.agreementType, 'Agreement type', 2, 100), purpose: bounded(d.purpose, 'Purpose', 5, 1000),
    instructions: bounded(d.instructions, 'Customisation instructions', 10, 5000),
    language: bounded(d.language, 'Language', 2, 30), name: bounded(d.name, 'Name', 2, 100),
    phone: bounded(d.phone, 'Mobile number', 10, 10), email: bounded(d.email ?? '', 'Email', 0, 254),
    preferredDate: bounded(d.preferredDate ?? '', 'Preferred date', 0, 10), contactMethod: bounded(d.contactMethod, 'Contact method', 2, 20), contactConsent: d.contactConsent === true,
  };
  if (!['English', 'Tamil', 'Both', 'Other'].includes(result.language)) throw new Error('Select a preferred language.');
  if (!/^[6-9]\d{9}$/.test(result.phone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Enter a valid email address.');
  if (result.preferredDate && !validDate(result.preferredDate)) throw new Error('Enter a valid preferred date.');
  if (!['Call', 'WhatsApp', 'Email'].includes(result.contactMethod) || (result.contactMethod === 'Email' && !result.email)) throw new Error('Select a contact method and supply its contact details.');
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
  Submitted: ['Under Review', 'Declined', 'Cancelled'],
  'Under Review': ['Clarification Required', 'Quote Sent', 'Declined', 'Cancelled'],
  'Clarification Required': ['Under Review', 'Declined', 'Cancelled'],
  'Quote Sent': ['Accepted', 'Under Review', 'Declined', 'Cancelled'],
  Accepted: ['In Progress', 'Cancelled'], 'In Progress': ['Completed', 'Cancelled'],
  Completed: [], Declined: [], Cancelled: [],
};
export function canTransition(from: CustomStatus, to: CustomStatus) { return from === to || transitions[from]?.includes(to) === true; }
