
const toFloat = (v, def = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
};

const defaultCodFee = () => toFloat(process.env.SHIPROCKET_COD_FEE, 49);

const maxReasonableCodFee = () => toFloat(process.env.SHIPROCKET_COD_FEE_MAX, 199);

/** Reject deltas that match the coupon discount or look like a cart total, not a COD fee. */
const isReasonableCodFee = (delta, discount) => {
  if (delta <= 0) return false;
  if (delta > maxReasonableCodFee()) return false;
  if (discount > 0 && Math.abs(delta - discount) <= 0.02) return false;
  return true;
};

/** True when SR's reported total equals raw subtotal despite a discount being applied. */
const srTotalLooksPreDiscount = (srReportedTotal, subtotal, discount) =>
  discount > 0 && srReportedTotal > 0 && Math.abs(srReportedTotal - subtotal) <= 0.02;

/**
 * @returns {{ codCharge: number, orderTotal: number, computedNetTotal: number }}
 */
const resolveOrderFinancials = ({
  subtotal = 0,
  discount = 0,
  shippingCost = 0,
  tax = 0,
  paymentMethod = "prepaid",
  srReportedTotal = 0,
  paymentAmount = 0,
  explicitCodCharge = 0,
}) => {
  const computedNetTotal = Math.max(
    0,
    +(subtotal - discount + shippingCost + tax).toFixed(2),
  );
  const isCod = String(paymentMethod || "").toLowerCase() === "cod";

  let codCharge = 0;
  let orderTotal = computedNetTotal;

  if (isCod) {
    if (explicitCodCharge > 0) {
      codCharge = explicitCodCharge;
      orderTotal = +(computedNetTotal + codCharge).toFixed(2);
    } else if (paymentAmount > computedNetTotal + 0.01) {
      const delta = +(paymentAmount - computedNetTotal).toFixed(2);
      codCharge = isReasonableCodFee(delta, discount) ? delta : defaultCodFee();
      orderTotal = paymentAmount;
    } else if (srReportedTotal > computedNetTotal + 0.01) {
      const delta = +(srReportedTotal - computedNetTotal).toFixed(2);
      const preDiscount = srTotalLooksPreDiscount(srReportedTotal, subtotal, discount);

      if (!preDiscount && isReasonableCodFee(delta, discount)) {
        codCharge = delta;
        orderTotal = srReportedTotal;
      } else {
        codCharge = defaultCodFee();
        orderTotal = +(computedNetTotal + codCharge).toFixed(2);
      }
    } else {
      codCharge = defaultCodFee();
      orderTotal = +(computedNetTotal + codCharge).toFixed(2);
    }
  } else if (paymentAmount > 0) {
    orderTotal = paymentAmount;
  } else if (srReportedTotal > 0) {
    orderTotal = srTotalLooksPreDiscount(srReportedTotal, subtotal, discount)
      ? computedNetTotal
      : srReportedTotal;
  }

  return {
    codCharge: +codCharge.toFixed(2),
    orderTotal: +orderTotal.toFixed(2),
    computedNetTotal,
  };
};

module.exports = {
  resolveOrderFinancials,
  defaultCodFee,
  isReasonableCodFee,
  srTotalLooksPreDiscount,
};