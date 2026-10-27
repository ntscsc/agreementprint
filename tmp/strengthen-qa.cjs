const fs=require('fs');let s=fs.readFileSync('tmp/verify-pdf-fixes.cjs','utf8');s=s.replace(' const layout=',` await page.evaluate(stamp=>{
 const pages=[...document.querySelectorAll('.agreement-export-page')];
 const stamped=pages.flatMap((p,i)=>p.querySelector('.stamp-paper-allowance')?[i+1]:[]);
 if(JSON.stringify(stamped)!==JSON.stringify(stamp===200?[1,2]:[1]))throw Error('Wrong physical stamp pages '+stamped);
 const intros=document.querySelector('[data-agreement-introductions]');
 if(!intros||!intros.textContent.includes('Arun Kumar')||!intros.textContent.includes('Priya Raman'))throw Error('Introductions separated');
 if(intros.closest('.agreement-export-page')!==pages[0])throw Error('Introductions not on first page');
 for(const p of pages){const sign=p.querySelector('.agreement-signatures');if(sign.getBoundingClientRect().bottom>p.getBoundingClientRect().bottom-40)throw Error('Signature overflow');}
 },stamp);
 const layout=`);fs.writeFileSync('tmp/verify-pdf-fixes.cjs',s);
