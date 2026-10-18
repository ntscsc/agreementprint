interface EnvelopeAddress { name: string; address: string; phone: string; }
export interface EnvelopeLayout { to: EnvelopeAddress; from: EnvelopeAddress; width: number; height: number; assetBase?: string; }
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export function envelopeHtml({ to, from, width, height, assetBase = '' }: EnvelopeLayout): string {
  const block = (label: string, value: EnvelopeAddress) => `<h2>${label}:</h2><strong>${escapeHtml(value.name)}</strong><p>${escapeHtml(value.address)}</p>${value.phone.trim() ? `<p class="phone">Phone: ${escapeHtml(value.phone)}</p>` : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>AgreementPrint Envelope</title><style>
    @font-face{font-family:EnvelopeTamil;src:url('${assetBase}/fonts/NotoSansTamil.ttf')}
    @page{size:${width}mm ${height}mm;margin:0}
    *{box-sizing:border-box}html,body{margin:0;padding:0;color:#172a39;background:#fff;font-family:Arial,EnvelopeTamil,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .envelope{position:relative;width:${width}mm;height:${height}mm;overflow:hidden;background:#fff}
    .frame{position:absolute;inset:5mm;border:.45mm solid #0b4f86;border-radius:2mm;pointer-events:none}
    .frame:after{content:'';position:absolute;inset:1.2mm;border:.15mm solid #d6e3ec;border-radius:1mm}
    .corner{position:absolute;left:5mm;top:5mm;width:3mm;height:19mm;background:#0b4f86;border-radius:2mm 0 2mm 0}
    .gold{position:absolute;right:5mm;bottom:5mm;width:25mm;height:2mm;background:#b78b35;transform:skewX(-25deg);transform-origin:right bottom}
    header{position:absolute;left:12mm;top:10mm;display:flex;align-items:center;gap:4mm}
    .logo{width:28mm;height:15mm;object-fit:contain}
    .brand{font-size:16pt;font-weight:800;letter-spacing:-.4pt;color:#0b4f86}
    .tagline{margin-top:1.5mm;font-size:8pt;letter-spacing:1pt;text-transform:uppercase;color:#4c7188}
    .rule{position:absolute;top:29mm;left:12mm;width:28mm;height:.6mm;background:#b78b35}
    .to{position:absolute;left:43%;top:33%;width:49%;height:54%;padding-left:5mm;border-left:.6mm solid #b78b35;font-size:14pt;line-height:1.45}
    .from{position:absolute;left:12mm;top:36%;width:30%;height:49%;padding-right:4mm;font-size:10pt;line-height:1.45}
    h2{margin:0 0 3mm;font-size:9pt;letter-spacing:1.5pt;color:#0b4f86}p{margin:1.5mm 0;white-space:pre-wrap;overflow-wrap:anywhere}strong{font-weight:700;overflow-wrap:anywhere}.phone{margin-top:2.5mm}
    footer{position:absolute;bottom:9mm;left:12mm;font-size:8pt;letter-spacing:.6pt;color:#4c7188}
  </style></head><body><main class="envelope"><div class="frame"></div><div class="corner"></div><div class="gold"></div><header><img class="logo" src="${assetBase}/nts-logo.jpeg" alt="Net Time Systems logo"><div><div class="brand">AgreementPrint</div><div class="tagline">Prepared. Printed. Delivered.</div></div></header><div class="rule"></div><section class="from">${block('FROM', from)}</section><section class="to">${block('TO', to)}</section><footer>agreementprint.in</footer></main></body></html>`;
}

export function fitEnvelopeAddresses(document: Document): boolean {
  for (const [selector, minimum] of [['.to', 10], ['.from', 8]] as const) {
    const address = document.querySelector<HTMLElement>(selector);
    if (!address) return false;
    let points = selector === '.to' ? 14 : 10;
    while (address.scrollHeight > address.clientHeight + 1 && points > minimum) {
      points -= 0.5;
      address.style.fontSize = `${points}pt`;
    }
    if (address.scrollHeight > address.clientHeight + 1) return false;
  }
  return true;
}
