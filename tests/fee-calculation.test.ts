import test from 'node:test';
import assert from 'node:assert/strict';

interface VendorFeesMock {
  stampDuty: { amount: number | null };
  serviceFee: { amount: number | null };
  courierFee: { amount: number | null };
}

function calculateFeeMock(
  monthlyRent: number,
  securityDeposit: number,
  tenureMonths: number,
  vendorFees: VendorFeesMock
) {
  const isServiceFeeSet = typeof vendorFees.serviceFee.amount === 'number';
  const isCourierFeeSet = typeof vendorFees.courierFee.amount === 'number';

  if (!isServiceFeeSet || !isCourierFeeSet) {
    return {
      feesConfigured: false,
      totalPayable: null,
      paymentAllowed: false,
      statusMessage: 'Official fee schedule is awaiting vendor confirmation.',
    };
  }

  let stampDuty = vendorFees.stampDuty.amount;
  if (stampDuty === null && monthlyRent > 0) {
    const totalRentOverTenure = monthlyRent * tenureMonths;
    stampDuty = Math.max(100, Math.ceil((totalRentOverTenure * 0.01) / 50) * 50);
  }

  const service = vendorFees.serviceFee.amount || 0;
  const courier = vendorFees.courierFee.amount || 0;
  const duty = stampDuty || 0;

  return {
    feesConfigured: true,
    stampDuty: duty,
    serviceFee: service,
    courierFee: courier,
    totalPayable: duty + service + courier,
    paymentAllowed: true,
  };
}

test('Fee Calculation: Unavailable when vendor fees are placeholders', () => {
  const placeholderFees: VendorFeesMock = {
    stampDuty: { amount: null },
    serviceFee: { amount: null },
    courierFee: { amount: null },
  };

  const result = calculateFeeMock(15000, 100000, 11, placeholderFees);
  assert.equal(result.feesConfigured, false, 'Fees marked as not configured');
  assert.equal(result.paymentAllowed, false, 'Payment must NOT be simulated or allowed');
  assert.equal(result.totalPayable, null, 'Total payable is null');
});

test('Fee Calculation: Computes transparent total when vendor fees are configured', () => {
  const configuredFees: VendorFeesMock = {
    stampDuty: { amount: 300 },
    serviceFee: { amount: 500 },
    courierFee: { amount: 150 },
  };

  const result = calculateFeeMock(15000, 100000, 11, configuredFees);
  assert.equal(result.feesConfigured, true, 'Fees configured');
  assert.equal(result.paymentAllowed, true, 'Payment allowed');
  assert.equal(result.stampDuty, 300, 'Stamp duty matches');
  assert.equal(result.serviceFee, 500, 'Service fee matches');
  assert.equal(result.courierFee, 150, 'Courier fee matches');
  assert.equal(result.totalPayable, 950, 'Total equals 300 + 500 + 150');
});
