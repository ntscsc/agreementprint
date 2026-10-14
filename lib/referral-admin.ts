import { randomBytes } from 'crypto';
import { type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { DEFAULT_REFERRAL_REWARD_AMOUNT } from '@/lib/referral-utils';
import { isTrustedPaymentAttempt } from '@/lib/payment-attempt';
import { assertCheckoutLock } from '@/lib/checkout-lock';

export interface ReferralAccount {
  uid: string;
  code: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export function getReferralRewardAmount(data: DocumentData | undefined) {
  const amount = data?.rewardAmount;
  return typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0 && amount <= 100_000
    ? amount
    : DEFAULT_REFERRAL_REWARD_AMOUNT;
}

export async function getOrCreateReferralAccount(
  uid: string,
  db: Firestore = getAdminDb(),
): Promise<ReferralAccount> {
  const accountRef = db.collection('referralAccounts').doc(uid);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(6).toString('hex').toUpperCase();
    const codeRef = db.collection('referralCodes').doc(code);
    const now = new Date().toISOString();

    const account = await db.runTransaction(async (transaction) => {
      const existingAccount = await transaction.get(accountRef);
      if (existingAccount.exists) return existingAccount.data() as ReferralAccount;

      const existingCode = await transaction.get(codeRef);
      if (existingCode.exists) return null;

      const newAccount: ReferralAccount = {
        uid,
        code,
        balance: 0,
        createdAt: now,
        updatedAt: now,
      };
      transaction.create(accountRef, newAccount);
      transaction.create(codeRef, { uid, createdAt: now });
      return newAccount;
    });

    if (account) return account;
  }

  throw new Error('Could not generate a unique referral code after several attempts.');
}

export async function confirmPaidOrderAndGrantReferral(
  orderId: string,
  paymentDetails: {
    transactionId?: string;
    merchantOrderId?: string;
    reservationKey?: string;
    paymentUpdates?: Record<string, unknown>;
  } = {},
) {
  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);
  const now = new Date().toISOString();
  const preflightOrder = await orderRef.get();
  if (!preflightOrder.exists) throw new Error(`Order ${orderId} was not found.`);
  const preflightUid = preflightOrder.data()?.ownerUid;
  if (typeof preflightUid !== 'string' || !preflightUid) {
    throw new Error(`Order ${orderId} is missing its customer account reference.`);
  }
  const firstPaidOrderRef = db.collection('referralFirstPaidOrders').doc(preflightUid);
  const preflightFirstPaid = await firstPaidOrderRef.get();
  const historicalPaidOrders = preflightFirstPaid.exists
    ? null
    : await db.collection('orders').where('ownerUid', '==', preflightUid).get();
  const hasHistoricalPaidOrder = historicalPaidOrders?.docs.some(
    (snapshot) => snapshot.id !== orderId && snapshot.data().payment?.status === 'Paid',
  ) ?? false;

  return db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) throw new Error(`Order ${orderId} was not found.`);

    const order = orderSnapshot.data()!;
    if (order.payment?.status === 'Paid') return { alreadyPaid: true, rewardAmount: 0 };

    let trustedAttempt: DocumentData | undefined;
    if (paymentDetails.merchantOrderId) {
      const attemptSnapshot = await transaction.get(
        db.collection('phonepePaymentAttempts').doc(paymentDetails.merchantOrderId),
      );
      if (!isTrustedPaymentAttempt(attemptSnapshot.data(), orderId, order.ownerUid, paymentDetails.merchantOrderId)) {
        throw new Error('Payment attempt is not owned by this order.');
      }
      trustedAttempt = attemptSnapshot.data()!;
      if (['FAILED', 'EXPIRED'].includes(trustedAttempt.state) || order.payment?.phonepeMerchantOrderId !== paymentDetails.merchantOrderId) {
        throw new Error('A superseded or released payment requires vendor reconciliation.');
      }
    }

    const firstPaidSnapshot = await transaction.get(firstPaidOrderRef);
    const referralCode = typeof order.referralCode === 'string' ? order.referralCode : '';
    const referralCodeRef = referralCode
      ? db.collection('referralCodes').doc(referralCode)
      : null;
    const referralCodeSnapshot = referralCodeRef
      ? await transaction.get(referralCodeRef)
      : null;
    const referralSettingsRef = db.collection('settings').doc('referrals');
    const referralSettingsSnapshot = referralCodeSnapshot?.exists
      ? await transaction.get(referralSettingsRef)
      : null;
    const referrerUid = referralCodeSnapshot?.data()?.uid;
    const referrerAccountRef =
      typeof referrerUid === 'string' && referrerUid !== order.ownerUid
        ? db.collection('referralAccounts').doc(referrerUid)
        : null;
    const referrerAccountSnapshot = referrerAccountRef
      ? await transaction.get(referrerAccountRef)
      : null;
    const rewardRef = db.collection('referralRewards').doc(order.ownerUid);
    const rewardSnapshot = referrerAccountSnapshot?.exists
      ? await transaction.get(rewardRef)
      : null;
    const reservationRef = db.collection('referralReservations').doc(orderId);
    const reservationSnapshot = await transaction.get(reservationRef);
    const expectedCredit = trustedAttempt?.creditApplied ?? paymentDetails.paymentUpdates?.['payment.referralCreditApplied'] ?? 0;
    const expectedReservationKey = paymentDetails.merchantOrderId ?? paymentDetails.reservationKey;
    if (Number(expectedCredit) > 0 && (
      reservationSnapshot.data()?.status !== 'reserved' ||
      reservationSnapshot.data()?.merchantOrderId !== expectedReservationKey ||
      reservationSnapshot.data()?.amount !== expectedCredit ||
      reservationSnapshot.data()?.ownerUid !== order.ownerUid
    )) throw new Error('Payment credit reservation does not match this attempt.');
    if (reservationSnapshot.data()?.status === 'reserved' && Number(expectedCredit) === 0) {
      throw new Error('An unrelated credit reservation cannot be consumed by this payment.');
    }

    const paidOrderUpdate: Record<string, unknown> = {
      'payment.status': 'Paid',
      'payment.paidAt': order.payment?.paidAt || now,
      status: 'Under verification',
      updatedAt: now,
      ...paymentDetails.paymentUpdates,
      ...(trustedAttempt ? {
        'payment.amount': trustedAttempt.amount,
        'payment.referralCreditApplied': trustedAttempt.creditApplied,
        'payment.totalBeforeCredits': trustedAttempt.totalBeforeCredits ?? trustedAttempt.amount + trustedAttempt.creditApplied,
      } : {}),
    };
    if (paymentDetails.transactionId) {
      paidOrderUpdate['payment.phonepeTransactionId'] = paymentDetails.transactionId;
    }
    if (paymentDetails.merchantOrderId) {
      paidOrderUpdate['payment.phonepeMerchantOrderId'] = paymentDetails.merchantOrderId;
    }
    transaction.update(orderRef, paidOrderUpdate);
    if (paymentDetails.merchantOrderId) transaction.update(db.collection('phonepePaymentAttempts').doc(paymentDetails.merchantOrderId), { state: 'COMPLETED', updatedAt: now });

    let rewardAmount = 0;
    if (!firstPaidSnapshot.exists) {
      transaction.create(firstPaidOrderRef, {
        uid: order.ownerUid,
        orderId,
        createdAt: now,
      });

      if (
        !hasHistoricalPaidOrder &&
        referralCodeSnapshot?.exists &&
        typeof referrerUid === 'string' &&
        referrerUid !== order.ownerUid &&
        !referrerAccountSnapshot?.exists
      ) {
        throw new Error('Referral account is missing for an active referral code.');
      }

      if (
        !hasHistoricalPaidOrder &&
        !rewardSnapshot?.exists &&
        referrerAccountRef &&
        referrerAccountSnapshot?.exists &&
        typeof referrerUid === 'string' &&
        referrerUid !== order.ownerUid
      ) {
        rewardAmount = getReferralRewardAmount(referralSettingsSnapshot?.data());
        if (rewardAmount > 0) {
          const currentBalance = Number(referrerAccountSnapshot.data()?.balance || 0);
          const updatedBalance = currentBalance + rewardAmount;
          if (!Number.isSafeInteger(currentBalance) || currentBalance < 0 || !Number.isSafeInteger(updatedBalance)) {
            throw new Error('Referrer credit balance is invalid and cannot be updated safely.');
          }
          transaction.update(referrerAccountRef, { balance: updatedBalance, updatedAt: now });
          transaction.create(rewardRef, {
            referredUid: order.ownerUid,
            referrerUid,
            orderId,
            amount: rewardAmount,
            createdAt: now,
          });
          transaction.create(db.collection('referralLedger').doc(`reward_${order.ownerUid}`), {
            ownerUid: referrerUid,
            type: 'reward',
            amount: rewardAmount,
            referredUid: order.ownerUid,
            orderId,
            createdAt: now,
          });
        }
      }
    }

    if (reservationSnapshot.exists && reservationSnapshot.data()?.status === 'reserved') {
      transaction.update(reservationRef, { status: 'consumed', updatedAt: now });
      transaction.create(db.collection('referralLedger').doc(`redeem_${orderId}`), {
        ownerUid: order.ownerUid,
        type: 'redeem',
        amount: reservationSnapshot.data()?.amount || 0,
        orderId,
        createdAt: now,
      });
    }

    return { alreadyPaid: false, rewardAmount };
  });
}

export async function reserveReferralCreditForOrder(
  orderId: string,
  uid: string,
  amount: number,
  options?: { merchantOrderId: string; lockToken: string; totalBeforeCredits: number; paymentAttempt?: DocumentData },
) {
  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);
  const accountRef = db.collection('referralAccounts').doc(uid);
  const reservationRef = db.collection('referralReservations').doc(orderId);
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, accountSnapshot, reservationSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(accountRef),
      transaction.get(reservationRef),
    ]);
    if (options) await assertCheckoutLock(db, transaction, orderId, options.lockToken);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid referral credit amount.');
    if (!orderSnapshot.exists) throw new Error('Order not found.');
    if (orderSnapshot.data()?.ownerUid !== uid) throw new Error('Order access denied.');
    if (orderSnapshot.data()?.payment?.status === 'Paid') throw new Error('This order is already paid.');

    if (reservationSnapshot.exists && reservationSnapshot.data()?.status === 'reserved') {
      const existingAmount = Number(reservationSnapshot.data()?.amount);
      if (existingAmount !== amount || (options && reservationSnapshot.data()?.merchantOrderId !== options.merchantOrderId)) {
        throw new Error('A different referral credit amount is already reserved for this order.');
      }
      return { balance: Number(accountSnapshot.data()?.balance || 0), reserved: existingAmount };
    }
    if (amount > 0 && !accountSnapshot.exists) throw new Error('No referral credit balance was found for this account.');
    if (reservationSnapshot.exists && reservationSnapshot.data()?.status === 'consumed') {
      throw new Error('Referral credit has already been used for this order.');
    }

    const currentBalance = Number(accountSnapshot.data()?.balance || 0);
    if (!Number.isSafeInteger(currentBalance) || amount > currentBalance) {
      throw new Error('Your available referral credit changed. Refresh the balance and try again.');
    }

    if (options?.paymentAttempt) {
      transaction.create(db.collection('phonepePaymentAttempts').doc(options.merchantOrderId), options.paymentAttempt);
      transaction.update(orderRef, {
        'payment.gateway': 'PhonePe', 'payment.status': 'Pending',
        'payment.phonepeMerchantOrderId': options.merchantOrderId,
        'payment.amount': options.paymentAttempt.amount,
        'payment.referralCreditApplied': amount,
        'payment.totalBeforeCredits': options.paymentAttempt.totalBeforeCredits,
        'payment.phonepeInitiatedAt': options.paymentAttempt.initiatedAt,
        'payment.phonepeReturnUrl': options.paymentAttempt.returnUrl,
        'payment.phonepeRedirectUrl': '', updatedAt: now,
      });
    } else if (options && amount > 0) {
      transaction.update(orderRef, {
        'payment.gateway': 'ReferralCredit', 'payment.status': 'Pending',
        'payment.reservationKey': options.merchantOrderId,
        'payment.amount': 0, 'payment.referralCreditApplied': amount,
        'payment.totalBeforeCredits': options.totalBeforeCredits, updatedAt: now,
      });
    }
    if (amount === 0) return { balance: currentBalance, reserved: 0 };
    transaction.update(accountRef, { balance: currentBalance - amount, updatedAt: now });
    const attempt = Number(reservationSnapshot.data()?.attempt || 0) + 1;
    transaction.set(reservationRef, {
      ownerUid: uid,
      orderId,
      amount,
      attempt,
      ...(options ? { merchantOrderId: options.merchantOrderId } : {}),
      status: 'reserved',
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(db.collection('referralLedger').doc(`reserve_${orderId}_${attempt}`), {
      ownerUid: uid,
      type: 'reserve',
      amount,
      orderId,
      createdAt: now,
    });
    return { balance: currentBalance - amount, reserved: amount };
  });
}

export async function releaseReferralReservation(orderId: string, merchantOrderId?: string, terminalState: 'FAILED' | 'EXPIRED' = 'FAILED') {
  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);
  const reservationRef = db.collection('referralReservations').doc(orderId);
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!orderSnapshot.exists) return false;
    const order = orderSnapshot.data()!;
    if (order.payment?.status === 'Paid') return false;
    const attemptRef = merchantOrderId ? db.collection('phonepePaymentAttempts').doc(merchantOrderId) : null;
    const attemptSnapshot = attemptRef ? await transaction.get(attemptRef) : null;
    if (merchantOrderId && (
      !isTrustedPaymentAttempt(attemptSnapshot?.data(), orderId, order.ownerUid, merchantOrderId) ||
      order.payment?.phonepeMerchantOrderId !== merchantOrderId ||
      attemptSnapshot?.data()?.state === 'COMPLETED'
    )) return false;
    const reservation = reservationSnapshot.data();
    const shouldRelease = reservation?.status === 'reserved';
    if (shouldRelease && merchantOrderId && reservation?.merchantOrderId !== merchantOrderId) {
      throw new Error('Cannot release credits reserved for a different payment attempt.');
    }
    const accountRef = db.collection('referralAccounts').doc(order.ownerUid);
    const accountSnapshot = shouldRelease ? await transaction.get(accountRef) : null;
    if (shouldRelease && !accountSnapshot?.exists) throw new Error('Referral account is missing for a reserved credit.');

    if (attemptRef) {
      transaction.update(attemptRef, { state: terminalState, updatedAt: now });
      transaction.update(orderRef, { 'payment.status': 'Failed', updatedAt: now });
    }
    if (!shouldRelease) return false;

    const amount = Number(reservationSnapshot.data()?.amount);
    const balance = Number(accountSnapshot?.data()?.balance || 0);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(balance + amount)) throw new Error('Invalid referral balance.');
    transaction.update(accountRef, {
      balance: balance + amount,
      updatedAt: now,
    });
    transaction.update(reservationRef, { status: 'released', updatedAt: now });
    transaction.create(db.collection('referralLedger').doc(`release_${orderId}_${reservation?.attempt || 1}`), {
      ownerUid: order.ownerUid,
      type: 'release',
      amount,
      orderId,
      createdAt: now,
    });
    return true;
  });
}
