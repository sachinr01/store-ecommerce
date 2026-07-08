'use strict';

/**
 * invoiceTemplate.js
 *
 * Border strategy — one rule, applied everywhere:
 *   td, th  →  border: 1px solid #000  (all four sides, always)
 *   table   →  border-collapse: collapse
 * Collapse deduplicates shared edges automatically.
 * No :last-child hacks. No inline border overrides. No margin tricks.
 */

// ── number-to-Indian-words ────────────────────────────────────────────────

const _ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
  'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
  'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const _TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
  'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function _twoDigits(n) {
  if (n < 20) return _ONES[n];
  return (_TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + _ONES[n % 10] : '')).trim();
}
function _threeDigits(n) {
  if (n === 0) return '';
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? _ONES[h] + ' Hundred' : '') + (r ? (h ? ' ' : '') + _twoDigits(r) : '');
}
function amountToWords(amount) {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10_000_000);
  const lakh  = Math.floor((n % 10_000_000) / 100_000);
  const thou  = Math.floor((n % 100_000) / 1_000);
  const rem   = n % 1_000;
  const parts = [];
  if (crore) parts.push(_threeDigits(crore) + ' Crore');
  if (lakh)  parts.push(_twoDigits(lakh)    + ' Lakh');
  if (thou)  parts.push(_twoDigits(thou)    + ' Thousand');
  if (rem)   parts.push(_threeDigits(rem));
  return parts.join(' ');
}

// ── renderer ─────────────────────────────────────────────────────────────

function renderInvoice(data) {
  const { store, order, billing, totals, items } = data;

  // helpers
  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toAmt(v) { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : 0; }
  function inr(n) {
    const [int, dec] = toAmt(n).toFixed(2).split('.');
    const l = int.slice(-3), r = int.slice(0, -3);
    return (r ? r.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + l : l) + '.' + dec;
  }

  // Default GST rate used when a product has no tax_percent stored.
  // Prices are always tax-inclusive, so we can always extract GST at this rate.
  const DEFAULT_GST_RATE = toAmt(data.defaultGstRate ?? 18);

  // tax groups
  const taxGroups = new Map();
  for (const item of items) {
    const lt  = toAmt(item.line_total);
    // Use stored tax_percent; fall back to DEFAULT_GST_RATE so tax is always shown
    const r   = toAmt(item.tax_percent) || DEFAULT_GST_RATE;
    // If line_tax is stored use it directly, otherwise back-calculate from inclusive price
    const itemTax = (item.line_tax != null && toAmt(item.line_tax) > 0)
      ? toAmt(item.line_tax)
      : (r > 0 ? (lt * r) / (100 + r) : 0);
    const hsn = String(item.hsn_code || '').trim();
    const k   = `${hsn}|${r}`;
    // taxable = price before tax (exclusive base)
    const tv  = lt - itemTax;
    if (!taxGroups.has(k)) taxGroups.set(k, { hsn, rate: r, taxable: 0, taxAmt: 0 });
    const g = taxGroups.get(k);
    g.taxable += tv;
    g.taxAmt  += itemTax;
  }
  const taxRows  = [...taxGroups.values()];
  const hasTax   = taxRows.some(g => g.rate > 0);
  const totalQty = items.reduce((s, i) => s + Number(i.qty || 1), 0);
  const totalTax = hasTax ? taxRows.reduce((s, g) => s + g.taxAmt, 0) : 0;

  // address helpers
  const billAddr = [billing.addr1, billing.addr2].filter(Boolean).map(esc).join(', ');
  const billCity = [billing.city, billing.state].filter(Boolean).map(esc).join(', ')
                 + (billing.pin ? ' - ' + esc(billing.pin) : '');

  // Supplier's Ref: sr_cart_id if available, else the numeric order id
  // Never show a bare dash — we always have at least the orderId
  const supplierRef = esc(order.supplierRef || '');

  // Other Reference(s): AWB / tracking number if available, else blank
  const otherRef = order.otherRef ? esc(order.otherRef) : '';

  // line-item rows
  const itemRows = items.map((item, i) => {
    const qty     = Number(item.qty || 1);
    const lt      = toAmt(item.line_total);
    const taxRate = toAmt(item.tax_percent) || DEFAULT_GST_RATE;
    const itemTax = (item.line_tax != null && toAmt(item.line_tax) > 0)
      ? toAmt(item.line_tax)
      : (taxRate > 0 ? (lt * taxRate) / (100 + taxRate) : 0);
    // taxable = amount before tax (exclusive base)
    const taxable = lt - itemTax;
    const up      = qty > 0 ? taxable / qty : taxable;
    return `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(item.order_item_name || 'Item')}</td>
        <td class="c">${item.hsn_code ? esc(item.hsn_code) : ''}</td>
        <td class="r">${qty}&nbsp;NOS</td>
        <td class="r">${inr(up)}</td>
        <td class="c">NOS</td>
        <td class="r">${inr(taxable)}</td>
      </tr>`;
  }).join('');

  const taxableTotal = hasTax
    ? taxRows.reduce((sum, group) => sum + group.taxable, 0)
    : toAmt(totals.subtotal);

  const taxSummaryRows = hasTax ? `
      <tr>
        <td></td>
        <td class="r">CGST</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td class="r">${inr(totalTax / 2)}</td>
      </tr>
      <tr>
        <td></td>
        <td class="r">SGST</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td class="r">${inr(totalTax / 2)}</td>
      </tr>` : '';

  const discountRow = totals.discount > 0 ? `
      <tr>
        <td colspan="6" class="r">Discount${totals.couponCode ? ' (' + esc(totals.couponCode) + ')' : ''}</td>
        <td class="r">-${inr(totals.discount)}</td>
      </tr>` : '';

  const shippingRow = totals.shipping > 0 ? `
      <tr>
        <td colspan="6" class="r">Shipping Charges</td>
        <td class="r">${inr(totals.shipping)}</td>
      </tr>` : '';

  // tax breakdown — only built when hasTax
  const taxBlock = hasTax ? (() => {
    const dataRows = taxRows.map(g => {
      const hr = g.rate / 2, ht = g.taxAmt / 2;
      return `
        <tr>
          <td>${g.hsn ? esc(g.hsn) : '-'}</td>
          <td class="r">${inr(g.taxable)}</td>
          <td class="c">${hr}%</td>
          <td class="r">${inr(ht)}</td>
          <td class="c">${hr}%</td>
          <td class="r">${inr(ht)}</td>
          <td class="r">${inr(g.taxAmt)}</td>
        </tr>`;
    }).join('');

    const totalRow = `
        <tr class="bold">
          <td>Total</td>
          <td class="r">${inr(taxRows.reduce((s, g) => s + g.taxable, 0))}</td>
          <td></td>
          <td class="r">${inr(taxRows.reduce((s, g) => s + g.taxAmt / 2, 0))}</td>
          <td></td>
          <td class="r">${inr(taxRows.reduce((s, g) => s + g.taxAmt / 2, 0))}</td>
          <td class="r">${inr(totalTax)}</td>
        </tr>`;

    return `
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="w15">HSN/SAC</th>
          <th rowspan="2" class="r w18">Taxable Value</th>
          <th colspan="2">Central Tax</th>
          <th colspan="2">State Tax</th>
          <th rowspan="2" class="r w14">Total Tax Amt</th>
        </tr>
        <tr>
          <th class="c w8">Rate</th><th class="r w11">Amount</th>
          <th class="c w8">Rate</th><th class="r w11">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${dataRows}
        ${totalRow}
      </tbody>
    </table>
    <table>
      <tr>
        <td class="words-cell">
          <span class="lbl">Tax Amount (in words)</span>
          <strong>Indian Rupee ${esc(amountToWords(totalTax))} Only</strong>
        </td>
      </tr>
    </table>`;
  })() : '';

  const codNote = order.isCOD
    ? '<br><span style="font-size:10.5px;">Payment Mode: Cash on Delivery</span>' : '';

  // ── document ─────────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tax Invoice - ${esc(String(order.invoiceNo))}</title>
<style>
/* reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; background: #fff; padding: 20px; }

/* toolbar — screen only */
.toolbar { max-width: 800px; margin: 0 auto 10px; text-align: right; }
.toolbar button { font-size: 12px; padding: 5px 16px; border: 1px solid #666; background: #f2f2f2; cursor: pointer; border-radius: 3px; }
.toolbar button:hover { background: #e2e2e2; }

/* sheet wrapper */
.sheet { max-width: 800px; margin: 0 auto; }

/* title */
.inv-title { font-size: 17px; font-weight: 500; text-align: center; letter-spacing: 0; padding: 14px 0 22px; }

/*
 * THE ONE BORDER RULE
 * Every td/th gets all 4 borders. border-collapse:collapse merges shared edges.
 * Result: uniform 1px grid everywhere, zero gaps, zero doubles.
 * table-layout:auto (default) so inner nested tables size themselves correctly.
 */
table { width: 100%; border-collapse: collapse; }
td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }

/* helpers */
.c   { text-align: center; }
.r   { text-align: right; }
.lbl { font-size: 10.5px; color: #222; display: block; margin-bottom: 1px; }
.bold td { font-weight: bold; }

/* seller section */
.seller-cell { width: 55%; }
.meta-cell   { width: 45%; padding: 0; } /* padding:0 so inner table is flush */
.seller-name { font-weight: normal; font-size: 13px; }
.meta-cell table { height: 100%; }
.meta-cell td { width: 50%; height: 36px; }
.strong-value { display: block; font-size: 13px; font-weight: bold; }

/* buyer section */
.buyer-cell { width: 55%; }
.buyer-name { font-weight: normal; font-size: 13px; text-transform: uppercase; }
.sect-lbl   { font-size: 10.5px; color: #222; margin-bottom: 2px; }
.address-lines { line-height: 1.25; min-height: 140px; }

/* items table — fixed layout with explicit col widths */
.items-table { table-layout: fixed; }
.col-sr   { width: 6%;  }
.col-desc { width: 30%; }
.col-hsn  { width: 14%; }
.col-qty  { width: 13%; }
.col-rate { width: 11%; }
.col-per  { width: 9%;  }
.col-amt  { width: 16%; }

/* spacer pushes subtotal to the bottom of the items block */
.spacer td { height: 70px; vertical-align: bottom; }
.grand-total td { font-weight: bold; }

/* words */
.words-cell { padding: 5px 6px; line-height: 1.6; }

/* tax table widths */
.w8  { width: 8%;  }
.w11 { width: 11%; }
.w14 { width: 14%; }
.w15 { width: 15%; }
.w18 { width: 18%; }

/* footer */
.decl-cell { width: 60%; }
.sign-cell { width: 40%; text-align: center; }
.sign-space { height: 54px; }

/* print */
@media print {
  @page { size: A4; margin: 12mm; }
  body  { padding: 0; }
  .toolbar { display: none; }
  .sheet { max-width: 100%; }
  tr { page-break-inside: avoid; }
}
</style>
</head>
<body>

<div class="toolbar">
  <button onclick="window.print()">Print / Save as PDF</button>
</div>

<div class="sheet">

  <div class="inv-title">TAX INVOICE</div>

  <!-- Seller / buyer (left) + invoice meta grid (right) -->
  <table>
    <tr>
      <td class="seller-cell">
        <div class="seller-name">${esc(store.name)}</div>
        ${store.address1     ? `<div>${esc(store.address1)}</div>`                                    : ''}
        ${store.address2     ? `<div>${esc(store.address2)}</div>`                                    : ''}
        ${store.phone        ? `<div>Phone no. : ${esc(store.phone)}</div>`         : ''}
        ${store.cityStatePin ? `<div>Pin code : ${esc(store.cityStatePin)}</div>`                                : ''}
        ${store.gstin        ? `<div>GSTIN : ${esc(store.gstin)}</div>`         : ''}
        ${store.email        ? `<div>E-Mail : ${esc(store.email)}</div>`        : ''}
      </td>
      <td class="meta-cell">
        <table>
          <tr>
            <td><span class="lbl">Invoice No.</span><span class="strong-value">${esc(String(order.invoiceNo))}</span></td>
            <td><span class="lbl">Dated</span><span class="strong-value">${esc(order.dateStr)}</span></td>
          </tr>
          <tr>
            <td><span class="lbl">Delivery Note</span></td>
            <td><span class="lbl">Mode/Terms of Payment</span>${order.isCOD ? 'Cash on Delivery' : ''}</td>
          </tr>
          <tr>
            <td><span class="lbl">Supplier's Ref</span></td>
            <td><span class="lbl">Other Reference(s)</span></td>
          </tr>
          <tr>
            <td><span class="lbl">Buyer's Order No.</span>${esc(String(order.orderId))}</td>
            <td><span class="lbl">Dated</span>${esc(order.dateStr)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="buyer-cell">
        <div class="address-lines">
          <div class="sect-lbl">Buyer</div>
          <div class="buyer-name">${esc(billing.name)}</div>
          ${billAddr      ? `<div>${billAddr}</div>`                                                : ''}
          ${billCity      ? `<div>${billCity}</div>`                                                : ''}
          ${billing.gstin ? `<div>GSTIN/UIN : ${esc(billing.gstin)}</div>`   : ''}
          ${billing.state ? `<div>State Name : ${esc(billing.state)}</div>`  : ''}
          ${billing.phone ? `<div>Mobile no. : ${esc(billing.phone)}</div>`  : ''}
          ${billing.email ? `<div>E-mail : ${esc(billing.email)}</div>`      : ''}
        </div>
      </td>
      <td class="meta-cell">
        <table>
          <tr>
            <td><span class="lbl">Despatch Doc No.</span>${order.awbCode ? esc(order.awbCode) : ''}</td>
            <td><span class="lbl">Delivery Note Date</span><span class="strong-value">${esc(order.dateStr)}</span></td>
          </tr>
          <tr>
            <td><span class="lbl">Despatched through</span><strong>${order.courierName ? esc(order.courierName) : ''}</strong></td>
            <td><span class="lbl">Destination</span><strong>${billing.city ? esc(billing.city) : ''}</strong></td>
          </tr>
          <tr>
            <td colspan="2"><span class="lbl">Terms of Delivery</span></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ③ Line items -->
  <table class="items-table">
    <colgroup>
      <col class="col-sr"><col class="col-desc"><col class="col-hsn">
      <col class="col-qty"><col class="col-rate"><col class="col-per"><col class="col-amt">
    </colgroup>
    <thead>
      <tr>
        <th class="c">Sr.<br>No.</th>
        <th>Description of Goods</th>
        <th class="c">HSN/SAC</th>
        <th class="c">Quantity</th>
        <th class="r">Rate</th>
        <th class="c">per</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="spacer">
        <td colspan="6"></td>
        <td class="r"><strong>${inr(taxableTotal)}</strong></td>
      </tr>
      ${taxSummaryRows}
      ${discountRow}
      ${shippingRow}
      <tr class="grand-total">
        <td colspan="5" class="r">Total</td>
        <td class="c">${totalQty}</td>
        <td class="r">&#8377;&nbsp;${inr(totals.total)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ④ Amount Chargeable (in words) -->
  <table>
    <tr>
      <td class="words-cell">
        <span class="lbl">Amount Chargeable (in words)</span>
        <strong>Indian Rupee ${esc(amountToWords(totals.total))} Only</strong>
      </td>
    </tr>
  </table>

  <!-- ⑤ Tax breakdown + Tax Amount in words (only when at least one item has tax) -->
  ${taxBlock}

  <!-- ⑦ Declaration / Authorised Signatory / Company's GSTIN / Company's PAN -->
  <table>
    <tr>
      <td class="decl-cell">
        <div>Company's GSTIN : ${esc(store.gstin || '-')}</div>
        <br/>
        <div>Company's PAN : ${esc(store.pan || '-')}</div>
        <br/>
        <strong>Declaration</strong>
        <p style="font-size:11px; line-height:1.5; margin-top:4px;">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.${codNote}</p>
      </td>
      <td class="sign-cell">
        <div>for <strong>${esc(store.name)}</strong></div>
        <div class="sign-space"></div>
        <div>Authorised Signatory</div>
        <div style="font-size:10px; margin-top:6px; color:#555;">This is a Computer Generated Invoice</div>
      </td>
    </tr>
  </table>

</div>
</body>
</html>`;
}

module.exports = { renderInvoice };
