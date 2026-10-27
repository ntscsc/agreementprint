const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {build}=require(process.env.ESBUILD_MODULE || 'esbuild');
const cache=new Map();function load(name){if(!name.startsWith('@/'))return require(name);if(cache.has(name))return cache.get(name);let file=path.resolve(name.slice(2));if(name.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));file+=fs.existsSync(file+'.tsx')?'.tsx':'.ts';const target={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,{module:target,exports:target.exports,require:load,Date,console});cache.set(name,target.exports);return target.exports;}
(async()=>{
// Run against the local dev server with Playwright installed (or PLAYWRIGHT_MODULE set).
const origin=process.env.AGREEMENT_QA_ORIGIN || 'http://localhost:3000';
const html=await(await fetch(origin+'/rent-receipt')).text();const styles=[...html.matchAll(/href="([^"]+\.css[^\"]*)"/g)].map(m=>m[1].replaceAll('&amp;','&'));const css=(await Promise.all(styles.map(async u=>await(await fetch(origin+u)).text()))).join('\n');
const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {RentalAgreementDocument} from './components/agreement/RentalAgreementDocument';const root=createRoot(document.getElementById('root'));window.renderAgreement=(data)=>root.render(<RentalAgreementDocument data={data} blankStampSpace/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'intercept-native-print',setup(b){b.onLoad({filter:/agreement-pdf-client\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace('win.print();','win.__qaPrintRequested = true;'),loader:'ts'}));}}]});

const b=await chromium.launch({...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {}),headless:true});const page=await b.newPage({viewport:{width:1000,height:1400}});page.on('pageerror',error=>console.error(error.message));await page.route('**/pdf-qa',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto(origin+'/pdf-qa',{waitUntil:'domcontentloaded'});await page.emulateMedia({media:'screen'});
const owner={fullName:'Arun Kumar',relativeName:'R. Kumar',relationship:'Son of',age:42,address:'Door No.12, Sample Street, Adyar, Chennai',pincode:'600020',phone:'9876543210',pan:'ABCDE1234F'};
const tenant={fullName:'Priya Raman',relativeName:'S. Raman',relationship:'Daughter of',age:30,address:'Flat No.4, Example Avenue, Velachery, Chennai',pincode:'600042',phone:'9876543211'};
const base={agreementType:'Rental',language:'English',monthlyRent:15000,securityDeposit:75000,maintenanceCharges:1500,rentIncreasePct:5,paymentDueDay:5,tenureMonths:11,noticePeriodDays:30,startDate:'2026-10-26',paintingDeduction:2500,deliveryRecipient:'Owner',deliveryLocation:'Within Chennai',includeNotary:false,extraCopies:0};
const manifest=[];
const exporter=ts.transpileModule(fs.readFileSync('lib/agreement-pdf-client.ts','utf8').replace('win.print();','/* intercepted for automated QA */'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;

for(const [kind,label]of [['english-house','English residential rental'],['english-shop','English shop rental'],['tamil-house','Tamil residential rental'],['tamil-shop','Tamil shop rental'],['lease','English residential lease'],['lease-shop','English shop lease'],['tamil-lease','Tamil residential lease'],['tamil-lease-shop','Tamil shop lease']])for(const stamp of [100,200])for(const paintingDeduction of [0,5000.5]){
 const terms={...base,paintingDeduction,stampPaperDenomination:stamp,language:kind.startsWith('tamil')?'Tamil':'English',...(kind.includes('lease')?{agreementType:'Lease',monthlyRent:0,rentIncreasePct:0,securityDeposit:150000}:{})};
 const data={ownerDetails:owner,tenantDetails:tenant,propertyDetails:{fullAddress:'Door No.25, Model Road, Mylapore',city:'Chennai',pincode:'600004',propertyType:kind.endsWith('shop')?'Commercial Shop':'Flat',furnishing:'Unfurnished',businessName:'Sample Stores'},agreementTerms:terms};
 await page.setContent(`<html><head><base href="${origin}/"><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div></body></html>`,{waitUntil:'domcontentloaded'});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(data=>window.renderAgreement(data),data);
 await page.locator('#printable-agreement-doc[aria-busy="false"] .agreement-export-page').first().waitFor();
 await page.evaluate(()=>{const copy=document.getElementById('agreement-template-source').cloneNode(true);copy.querySelectorAll('.agreement-signatures,.agreement-page-number,.stamp-paper-allowance,.pointer-events-none').forEach(e=>e.remove());window.expectedAgreementText=copy.textContent.replace(/\s/g,'');});
 await page.evaluate(({stamp,paintingDeduction})=>{
 const pages=[...document.querySelectorAll('#printable-agreement-doc .agreement-export-page')];
 const title=pages[0].querySelector('h1');
 if(!title||getComputedStyle(title).textAlign!=='center')throw Error('Agreement title is not centered');
 if(pages[0].lang==='ta'){
   const clauses=[...document.querySelectorAll('#printable-agreement-doc [data-agreement-clause]')];
   if(clauses.length<10||clauses.some((p,i)=>Number(p.dataset.agreementClause)!==i+1||p.querySelector('strong')?.textContent!==`${i+1}.`))throw Error('Tamil clauses are not consecutively numbered');
   const emphasized=[...document.querySelectorAll('#printable-agreement-doc .agreement-export-body strong')];
   for(const value of ['Arun Kumar','Priya Raman',...(paintingDeduction>0?['5,000.50']:[])]){
     if(!emphasized.some(e=>e.textContent===value&&Number(getComputedStyle(e).fontWeight)>=700))throw Error('Tamil form value is not bold: '+value);
   }
 }
 for(const p of document.querySelectorAll('#printable-agreement-doc .agreement-export-body p')){
   if(!p.matches('.text-center,.tamil-execution-location')&&getComputedStyle(p).textAlign!=='justify')throw Error('Agreement body text is not justified');
 }
 const stamped=pages.flatMap((p,i)=>p.querySelector('.stamp-paper-allowance')?[i+1]:[]);
 if(JSON.stringify(stamped)!==JSON.stringify(stamp===200?[1,2]:[1]))throw Error('Wrong physical stamp pages '+stamped);
 const intros=document.querySelector('#printable-agreement-doc [data-agreement-introductions]');
 if(!intros||!intros.textContent.includes('Arun Kumar')||!intros.textContent.includes('Priya Raman'))throw Error('Introductions separated');
 if(intros.closest('.agreement-export-page')!==pages[0])throw Error('Introductions not on first page');
 const termsStart=document.querySelector('#printable-agreement-doc [data-agreement-terms-start]');
 if(!termsStart||termsStart.closest('.agreement-export-page')!==pages[1])throw Error('Terms must start on physical page 2');
 if(pages[0].querySelector('[data-agreement-terms-start]'))throw Error('Terms pushed onto page 1');
 for(const p of pages){const body=p.querySelector('.agreement-export-body');if(body.getBoundingClientRect().height>Number(p.dataset.availableContentHeight)+.5)throw Error('Reserved content budget exceeded');}

 const final=document.querySelector('#printable-agreement-doc [data-agreement-final-section]');
 const closing=final?.querySelector('[data-agreement-closing]');
 if(!closing||final.children.length!==3||closing.querySelectorAll('p').length<3)throw Error('Final clauses, conclusion and witnesses are not together');
 if(final.closest('.agreement-export-page')!==pages.at(-1))throw Error('Closing is not on last page');
 if(pages.length<3||pages.length>4)throw Error('Expected a balanced three or four page agreement');
 const actual=pages.map(p=>p.querySelector('.agreement-export-body').textContent).join('').replace(/\s/g,'');
 const paintingClause=pages.some(p=>/painting charges|\u0baa\u0bc6\u0baf\u0bbf\u0ba3\u0bcd\u0b9f\u0bcd/.test(p.querySelector('.agreement-export-body').textContent));
 if(paintingClause!==(paintingDeduction>0))throw Error('Painting clause must match positive amount only');
 if(paintingDeduction>0&&!actual.includes('5,000.50'))throw Error('Painting paise must retain two decimal digits');
 if(actual!==window.expectedAgreementText)throw Error('Agreement text lost or reordered');
 for(const p of pages){
 const body=p.querySelector('.agreement-export-body'), sign=p.querySelector('.agreement-signatures'),footer=p.querySelector('.agreement-page-number');
 const rect=p.getBoundingClientRect();
 if(Math.abs(rect.width-210*96/25.4)>1||Math.abs(rect.height-297*96/25.4)>1)throw Error('Page is not fixed A4');
 if(p.scrollHeight>Math.ceil(297*96/25.4))throw Error('Page has scroll overflow beyond A4');
 if(!document.querySelector('style[data-agreement-layout]'))throw Error('Paginator did not install its required layout');
 if(body.getBoundingClientRect().bottom+15>sign.getBoundingClientRect().top)throw Error('Body overlaps signing space');
 if(sign.getBoundingClientRect().bottom>footer.getBoundingClientRect().top)throw Error('Signatures overlap footer');
 }

 for(const p of pages){const sign=p.querySelector('.agreement-signatures');if(sign.getBoundingClientRect().bottom>p.getBoundingClientRect().bottom-40)throw Error('Signature overflow');}
 },{stamp,paintingDeduction});
 const layout=await page.locator('#printable-agreement-doc .agreement-page').evaluateAll(ps=>ps.map(p=>{const s=p.querySelector('.agreement-signatures'),body=p.querySelector('.agreement-export-body');return {height:p.getBoundingClientRect().height,font:getComputedStyle(p).fontSize,space:s.getBoundingClientRect().top-body.getBoundingClientRect().bottom,signing:s.getBoundingClientRect().height};}));
 if(layout.some(p=>p.space<15||p.signing<110))throw Error('Bad signing space '+JSON.stringify(layout));



 await page.getByRole('button',{name:'Save Agreement as PDF'}).click();
 await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.__qaPrintRequested);
 await page.evaluate(expected=>{const frame=document.querySelector('iframe');const pages=[...frame.contentDocument.querySelectorAll('.agreement-export-page')];if(pages.length!==expected||pages.some(p=>Math.abs(p.getBoundingClientRect().height-297*96/25.4)>1))throw Error('Export differs from visible preview');frame.remove();},layout.length);
 await page.locator('#printable-agreement-doc[aria-busy="false"] .agreement-export-page').first().waitFor();
 await page.evaluate(()=>{const printable=document.getElementById('printable-agreement-doc');document.body.replaceChildren(printable);});
 await page.emulateMedia({media:'print'});
 const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
 const printedPages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
 if(printedPages!==layout.length)throw Error('PDF gained overflow pages: '+printedPages+' vs '+layout.length);
 if(process.env.AGREEMENT_QA_PDF_DIR){fs.mkdirSync(process.env.AGREEMENT_QA_PDF_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.AGREEMENT_QA_PDF_DIR,kind+'-'+stamp+'-painting-'+paintingDeduction+'.pdf'),pdf);}
 await page.emulateMedia({media:'screen'});
 console.log('PASS visible preview and PDF',kind,stamp,'painting='+paintingDeduction,layout.map(p=>p.height).join(',')+'px');
}
await b.close();})();

