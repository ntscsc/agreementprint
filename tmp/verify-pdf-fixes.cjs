const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const {chromium}=require(process.env.TEMP+'/stamp-layout-qa/node_modules/playwright');
const cache=new Map();function load(name){if(!name.startsWith('@/'))return require(name);if(cache.has(name))return cache.get(name);let file=path.resolve(name.slice(2));if(name.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));file+=fs.existsSync(file+'.tsx')?'.tsx':'.ts';const target={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,{module:target,exports:target.exports,require:load,Date,console});cache.set(name,target.exports);return target.exports;}
(async()=>{
fs.mkdirSync('tmp/pdfs/review-fixes',{recursive:true});fs.mkdirSync('output/pdf',{recursive:true});
const html=await(await fetch('http://localhost:3000/rent-receipt')).text();const styles=[...html.matchAll(/href="([^"]+\.css[^\"]*)"/g)].map(m=>m[1].replaceAll('&amp;','&'));const css=(await Promise.all(styles.map(async u=>await(await fetch('http://localhost:3000'+u)).text()))).join('\n');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),Doc=load('@/components/agreement/RentalAgreementDocument').RentalAgreementDocument;
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const page=await b.newPage({viewport:{width:1000,height:1400}});await page.route('**/pdf-qa',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto('http://localhost:3000/pdf-qa',{waitUntil:'domcontentloaded'});await page.emulateMedia({media:'print'});
const owner={fullName:'Arun Kumar',relativeName:'R. Kumar',relationship:'Son of',age:42,address:'Door No.12, Sample Street, Adyar, Chennai',pincode:'600020',phone:'9876543210',pan:'ABCDE1234F'};
const tenant={fullName:'Priya Raman',relativeName:'S. Raman',relationship:'Daughter of',age:30,address:'Flat No.4, Example Avenue, Velachery, Chennai',pincode:'600042',phone:'9876543211'};
const base={agreementType:'Rental',language:'English',monthlyRent:15000,securityDeposit:75000,maintenanceCharges:1500,rentIncreasePct:5,paymentDueDay:5,tenureMonths:11,noticePeriodDays:30,startDate:'2026-10-26',paintingDeduction:2500,deliveryRecipient:'Owner',deliveryLocation:'Within Chennai',includeNotary:false,extraCopies:0};
const manifest=[];
const exporter=ts.transpileModule(fs.readFileSync('lib/agreement-pdf-client.ts','utf8').replace('win.print();','/* intercepted for automated QA */'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;

for(const [kind,label]of [['english-house','English residential rental'],['english-shop','English shop rental'],['tamil-house','Tamil residential rental'],['tamil-shop','Tamil shop rental'],['lease','English residential lease'],['lease-shop','English shop lease'],['tamil-lease','Tamil residential lease'],['tamil-lease-shop','Tamil shop lease']])for(const stamp of [100,200]){
 const terms={...base,stampPaperDenomination:stamp,language:kind.startsWith('tamil')?'Tamil':'English',...(kind.includes('lease')?{agreementType:'Lease',monthlyRent:0,rentIncreasePct:0,securityDeposit:150000}:{})};
 const data={ownerDetails:owner,tenantDetails:tenant,propertyDetails:{fullAddress:'Door No.25, Model Road, Mylapore',city:'Chennai',pincode:'600004',propertyType:kind.endsWith('shop')?'Commercial Shop':'Flat',furnishing:'Unfurnished',businessName:'Sample Stores'},agreementTerms:terms};
 const body=renderToStaticMarkup(React.createElement(Doc,{data,blankStampSpace:true}));
 await page.setContent(`<html><head><base href="http://localhost:3000/"><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>{const doc=document.getElementById('printable-agreement-doc');document.body.replaceChildren(doc);});
 await page.addScriptTag({content:'var exports = {};'+exporter});
 await page.evaluate(async()=>{await exports.downloadAgreementPdf(document.getElementById('printable-agreement-doc'),'QA');const f=document.querySelector('iframe');if(!f)throw Error('No export frame');const d=f.contentDocument;document.head.innerHTML=d.head.innerHTML;document.body.innerHTML=d.body.innerHTML;f.remove();});
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(stamp=>{
 const pages=[...document.querySelectorAll('.agreement-export-page')];
 const stamped=pages.flatMap((p,i)=>p.querySelector('.stamp-paper-allowance')?[i+1]:[]);
 if(JSON.stringify(stamped)!==JSON.stringify(stamp===200?[1,2]:[1]))throw Error('Wrong physical stamp pages '+stamped);
 const intros=document.querySelector('[data-agreement-introductions]');
 if(!intros||!intros.textContent.includes('Arun Kumar')||!intros.textContent.includes('Priya Raman'))throw Error('Introductions separated');
 if(intros.closest('.agreement-export-page')!==pages[0])throw Error('Introductions not on first page');
 for(const p of pages){const sign=p.querySelector('.agreement-signatures');if(sign.getBoundingClientRect().bottom>p.getBoundingClientRect().bottom-40)throw Error('Signature overflow');}
 },stamp);
 const layout=await page.locator('.agreement-page').evaluateAll(ps=>ps.map(p=>{const s=p.querySelector('.agreement-signatures'),body=p.querySelector('.agreement-export-body');return {height:p.getBoundingClientRect().height,font:getComputedStyle(p).fontSize,space:s.getBoundingClientRect().top-body.getBoundingClientRect().bottom,signing:s.getBoundingClientRect().height};}));
 if(layout.some(p=>p.space<15||p.signing<110))throw Error('Bad signing space '+JSON.stringify(layout));
 const file='tmp/pdfs/review-fixes/'+kind+'-'+stamp+'.pdf';
 await page.pdf({path:file,format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
 if(kind==='tamil-lease-shop'&&stamp===100)await page.screenshot({path:'tmp/pdfs/review-fixes/tamil-shop-100.png',fullPage:true});
 console.log(kind,stamp,JSON.stringify(layout));
}
await b.close();})();

