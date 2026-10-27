export interface AgentDashboardReferral {
  hasPaidOrder: boolean;
  rewardStatus: string;
  rewardAmount?: number;
  rewardPaidAmount?: number;
}

export function agentReferralStage(referral: AgentDashboardReferral) {
  if (referral.rewardStatus === 'Rewarded') return 'Commission paid';
  if (referral.hasPaidOrder && (referral.rewardAmount ?? 0) > 0) return 'Commission due';
  if (referral.hasPaidOrder) return 'First order paid';
  return 'Signed up';
}

export function agentDashboardTotals(referrals: AgentDashboardReferral[]) {
  return {
    signedUp: referrals.length,
    firstOrderPaid: referrals.filter(row => row.hasPaidOrder).length,
    dueCount: referrals.filter(row => agentReferralStage(row) === 'Commission due').length,
    dueAmount: referrals.reduce((sum, row) => sum + (agentReferralStage(row) === 'Commission due' ? row.rewardAmount ?? 0 : 0), 0),
    paidAmount: referrals.reduce((sum, row) => sum + (row.rewardStatus === 'Rewarded' ? row.rewardPaidAmount ?? 0 : 0), 0),
    unknownPayments: referrals.filter(row => row.rewardStatus === 'Rewarded' && row.rewardPaidAmount === undefined).length,
  };
}
