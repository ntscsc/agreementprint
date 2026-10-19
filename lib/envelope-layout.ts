interface EnvelopeAddress { name: string; address: string; phone: string; }
export interface EnvelopeLayout { to: EnvelopeAddress; from: EnvelopeAddress; assetBase?: string; }
export const A4_PAGE = { width: 297, height: 210 } as const;
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export function envelopeHtml({ to, from, assetBase = '' }: EnvelopeLayout): string {
  const { width, height } = A4_PAGE;
  const block = (label: string, value: EnvelopeAddress) => `<h2>${label}:</h2><strong>${escapeHtml(value.name)}</strong><p>${escapeHtml(value.address)}</p>${value.phone.trim() ? `<p class="phone">Phone: ${escapeHtml(value.phone)}</p>` : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>AgreementPrint Envelope</title><style>
    @font-face{font-family:EnvelopeTamil;src:url('${assetBase}/fonts/NotoSansTamil.ttf')}
    @page{size:A4 landscape;margin:0}
    *{box-sizing:border-box}html,body{margin:0;padding:0;color:#172a39;background:#fff;font-family:Arial,EnvelopeTamil,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .envelope{position:relative;width:${width}mm;height:${height}mm;overflow:hidden;background:#fff}
    .frame{position:absolute;inset:5mm;border:.45mm solid #0b4f86;border-radius:2mm;pointer-events:none}
    .frame:after{content:'';position:absolute;inset:1.2mm;border:.15mm solid #d6e3ec;border-radius:1mm}
    .corner{position:absolute;left:5mm;top:5mm;width:4mm;height:38mm;background:#0b4f86;border-radius:2mm 0 2mm 0}
    .gold{position:absolute;right:5mm;bottom:5mm;width:60mm;height:3mm;background:#b78b35;transform:skewX(-25deg);transform-origin:right bottom}
    header{position:absolute;left:15mm;right:55mm;top:12mm;display:flex;align-items:center;gap:7mm}
    .website-qr{position:absolute;top:10mm;right:15mm;width:32mm;text-align:center}
    .website-qr img{display:block;width:30mm;height:30mm;margin:0 auto}
    .website-qr span{display:block;position:relative;left:50%;width:max-content;transform:translateX(-50%);margin-top:1mm;white-space:nowrap;font-size:9pt;font-weight:600;color:#0b4f86}
    .logo{width:52mm;height:30mm;object-fit:contain}
    .brand{font-size:36pt;font-weight:800;letter-spacing:-.6pt;color:#0b4f86}
    .tagline{margin-top:2.5mm;font-size:14pt;letter-spacing:1pt;text-transform:uppercase;color:#4c7188}
    .rule{position:absolute;top:48mm;left:15mm;right:15mm;height:.8mm;background:#b78b35}
    .to{position:absolute;left:43%;top:59mm;width:49%;height:117mm;padding-left:7mm;border-left:.8mm solid #b78b35;font-size:28pt;line-height:1.4}
    .from{position:absolute;left:15mm;top:59mm;width:35%;height:117mm;padding-right:5mm;font-size:22pt;line-height:1.4}
    h2{margin:0 0 4mm;font-size:16pt;letter-spacing:1.5pt;color:#0b4f86}p{margin:2.5mm 0;white-space:pre-wrap;overflow-wrap:anywhere}strong{font-weight:700;overflow-wrap:anywhere}.phone{margin-top:4mm}
    footer{position:absolute;bottom:13mm;left:15mm;right:15mm;border-top:.4mm solid #d6e3ec;padding-top:4mm;font-size:16pt;font-weight:600;letter-spacing:.8pt;color:#4c7188}
  </style></head><body><main class="envelope"><div class="frame"></div><div class="corner"></div><div class="gold"></div><header><img class="logo" src="${assetBase}/nts-logo.jpeg" alt="Net Time Systems logo"><div><div class="brand">AgreementPrint</div><div class="tagline">Prepared. Printed. Delivered.</div></div></header><a class="website-qr" href="https://agreementprint.in"><img src="${assetBase}/images/website-qr.svg" alt="QR code to open https://agreementprint.in"><span>Scan to visit AgreementPrint</span></a><div class="rule"></div><section class="from">${block('FROM', from)}</section><section class="to">${block('TO', to)}</section><footer>agreementprint.in</footer></main></body></html>`;
}

export function fitEnvelopeAddresses(document: Document): boolean {
  for (const [selector, minimum] of [['.to', 14], ['.from', 12]] as const) {
    const address = document.querySelector<HTMLElement>(selector);
    if (!address) return false;
    let points = selector === '.to' ? 28 : 22;
    address.style.fontSize = `${points}pt`;
    while ((address.scrollHeight > address.clientHeight + 1 || address.scrollWidth > address.clientWidth + 1) && points > minimum) {
      points -= 0.5;
      address.style.fontSize = `${points}pt`;
    }
    if (address.scrollHeight > address.clientHeight + 1 || address.scrollWidth > address.clientWidth + 1) return false;
  }
  return true;
}
