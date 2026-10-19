import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError } from '@/lib/api-input';
import { buildAdminReportSheets, type ReportData } from '@/lib/admin-reports';
import { buildReportsXlsx } from '@/lib/admin-report-xlsx';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const sources = ['orders', 'customAgreementRequests', 'customerProfiles', 'phonepePaymentAttempts', 'customPhonepeAttempts', 'orderReplacements', 'creditRefundRequests', 'orderRefundHistory', 'referralAccounts', 'referralCodes', 'agentReferralCustomers', 'referralRewards', 'referralLedger', 'adminLogs', 'customAgreementAudit', 'customerReviews'] as const;

export async function GET(req: NextRequest) {
  try {
    if (!(await customIdentity(req)).admin) throw new ApiInputError('Administrator access required.', 403);
    const db = getAdminDb(), data: ReportData = {}, generatedAt = new Date();
    // Fail explicitly rather than silently delivering truncated reports.
    for (let offset = 0; offset < sources.length; offset += 4) {
      await Promise.all(sources.slice(offset, offset + 4).map(async name => {
        const snapshot = await db.collection(name).limit(25001).get();
        if (snapshot.size > 25000) throw new ApiInputError(`The ${name} report exceeds this export's 25,000-record limit. A larger export is needed; no partial workbook was downloaded.`, 409);
        data[name] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      }));
    }
    if (Object.values(data).reduce((total, records) => total + records.length, 0) > 100000) throw new ApiInputError('This export exceeds 100,000 records in total. A larger export is needed; no partial workbook was downloaded.', 409);
    const buffer = buildReportsXlsx(buildAdminReportSheets(data, generatedAt));
    const indiaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(generatedAt);
    return new NextResponse(new Uint8Array(buffer), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="AgreementPrint-Analytics-v2-${indiaDate}.xlsx"`,
      'X-Report-Version': 'analytics-v2',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return customError(error); }
}
