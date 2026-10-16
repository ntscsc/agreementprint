export interface AgentReferralSummaryRecord {
  hasPaidOrder: boolean;
  rewardStatus: string;
  rewardAmount?: number;
  rewardPaidAmount?: number;
}

export function summarizeAgentReferrals(referrals: AgentReferralSummaryRecord[]) {
  return {
    paidCustomers: referrals.filter(referral => referral.hasPaidOrder).length,
    awaitingCustomerPayment: referrals.filter(referral => !referral.hasPaidOrder).length,
    paymentsDue: referrals.filter(referral => referral.hasPaidOrder && referral.rewardStatus !== 'Rewarded' && (referral.rewardAmount ?? 0) > 0).length,
    recordedPaymentTotal: referrals.reduce((total, referral) => total + (referral.rewardStatus === 'Rewarded' ? referral.rewardPaidAmount ?? 0 : 0), 0),
  };
}
