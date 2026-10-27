/** Layout travels with the paginator, including in already-open admin sessions. */
export const AGREEMENT_LAYOUT_CSS = `/* Shared A4 metrics for the visible preview and native PDF export. */
@font-face { font-family: 'Agreement English'; src: url('/fonts/NotoSans-Regular.ttf'); }
      section.agreement-export-page.agreement-page { box-sizing:border-box !important; position:relative !important; display:flex !important; flex:none !important; width:210mm !important; max-width:210mm !important; height:297mm !important; min-height:297mm !important; max-height:297mm !important; padding:15mm 15mm 18mm !important; gap:0 !important; justify-content:flex-start !important; font-size:14px !important; line-height:1.65 !important; font-family:'Agreement English',sans-serif !important; }
      section.agreement-export-page.tamil-agreement-page { font-family:'Agreement Tamil','Agreement English',sans-serif !important; }
      .tamil-agreement-page strong { font-weight:700; }
      .tamil-agreement-page .agreement-signatures p { font-weight:700; }
      .agreement-export-page.agreement-page:has(.stamp-paper-allowance) { padding-top:6in !important; }
      .agreement-export-body { flex:none; width:100%; overflow-wrap:anywhere; text-align:justify; text-justify:inter-word; }
      .agreement-export-body h1 { text-align:center; }
      .agreement-export-body > * { margin:0 0 3mm !important; line-height:1.65 !important; }
      [data-agreement-introductions] { break-inside:avoid; }
      [data-agreement-introductions] p { margin:0 0 2mm !important; line-height:1.65 !important; }
      [data-agreement-closing], [data-agreement-final-section] { break-inside:avoid; }
      [data-agreement-final-section] > p { margin:0 0 3mm !important; line-height:1.65 !important; }
      .agreement-export-body > .stamp-paper-allowance { margin:0 !important; }
      .agreement-export-page > .agreement-signatures { position:absolute !important; bottom:18mm !important; left:15mm; right:15mm; margin:0 !important; min-height:30mm !important; }
      .agreement-export-page > .agreement-page-number { position:absolute; bottom:7mm; left:15mm; right:15mm; margin:0 !important; padding:0 !important; border:0 !important; display:block !important; }
`;
