import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {login} from './helpers';

test.describe('Real local PaddleOCR',()=>{
 test.skip(process.env.OCR_E2E_ENABLED!=='true','Requires docker-compose.ocr.yml and real inference');
 for(const file of ['ocr-invoice.png','ocr-invoice.jpg','ocr-invoice.pdf','ocr-invoice-two-pages.pdf']){
  test(`extracts and reviews ${file}`,async({page,request})=>{
   test.setTimeout(120000);
   const headers=await login(page,'admin@example.test');
   const buffer=readFileSync(`tests/fixtures/${file}`);
   const response=await request.post('/api/v1/documents',{headers,multipart:{title:`Live OCR ${file} ${randomUUID().slice(0,8)}`,workspace:'sales',file:{name:file,mimeType:file.endsWith('pdf')?'application/pdf':file.endsWith('png')?'image/png':'image/jpeg',buffer}}});
   expect(response.status()).toBe(201);const doc=(await response.json()).data;
   expect((await request.post(`/api/v1/documents/${doc.id}/review`,{headers,data:{version:doc.version,status:'accepted',note:'Synthetic OCR fixture.'}})).status()).toBe(200);
   await page.goto(`/documents/${doc.id}`);const panel=page.getByRole('region',{name:'Document text extraction'});
   await expect(panel.getByRole('button',{name:'Extract text',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'Extract text',exact:true}).click();
   await expect(panel.getByLabel('Corrected text')).toBeVisible({timeout:100000});
   const extracted=(await (await request.get(`/api/v1/documents/${doc.id}/ocr`,{headers})).json()).data;
   expect(extracted.status).toBe('ready');expect(extracted.pages).toBe(file.includes('two-pages')?2:1);expect(extracted.sourceSha256).toBe(doc.sha256);
   expect(extracted.rawText).toContain('TEST-2042');expect(extracted.rawText).toContain('110.00');expect(extracted.rawText).toContain('Example Supplies');
   if(file.includes('two-pages'))expect(extracted.rawText).toContain('Payment reference');
   const corrected=extracted.rawText+'\nReviewed against original.';
   await panel.getByLabel('Corrected text').fill(corrected);await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Save text review'}).click();await expect(panel.getByText('Text approved',{exact:true})).toBeVisible();
   await page.reload();await expect(panel.getByText('Text approved',{exact:true})).toBeVisible();
   const reviewed=(await (await request.get(`/api/v1/documents/${doc.id}/ocr`,{headers})).json()).data;expect(reviewed.rawText).toBe(extracted.rawText);expect(reviewed.reviewedText).toBe(corrected);expect(reviewed.reviewerName).toBeTruthy();
   if(file==='ocr-invoice-two-pages.pdf'){
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:'test-results/document-ocr-live-mobile.png',fullPage:true});
   }
   const original=await request.get(`/api/v1/documents/${doc.id}/download`,{headers});expect(await original.body()).toEqual(buffer);
  });
 }
});

test.describe('Local Khmer OCR',()=>{
 test.skip(process.env.KHMER_OCR_E2E_ENABLED!=='true','Requires docker-compose.khmer-ocr.yml');
 for(const file of ['ocr-khmer.png','ocr-khmer.pdf']){
  test(`Khmer and English extraction retains review corrections for ${file}`,async({page,request})=>{
   test.setTimeout(120000);
   const headers=await login(page,'admin@example.test');
   const upload=await request.post('/api/v1/documents',{headers,multipart:{title:`Khmer fixture ${randomUUID().slice(0,8)}`,workspace:'sales',file:{name:file,mimeType:file.endsWith('pdf')?'application/pdf':'image/png',buffer:readFileSync(`tests/fixtures/${file}`)}}});expect(upload.status()).toBe(201);const doc=(await upload.json()).data;
   expect((await request.post(`/api/v1/documents/${doc.id}/review`,{headers,data:{version:doc.version,status:'accepted',note:'Synthetic Khmer fixture.'}})).status()).toBe(200);
   await page.goto(`/documents/${doc.id}`);const panel=page.getByRole('region',{name:'Document text extraction'});
   await panel.getByRole('combobox',{name:'Document language',exact:true}).selectOption('km+en');await panel.getByRole('button',{name:'Extract text',exact:true}).click();await expect(panel.getByLabel('Corrected text')).toBeVisible({timeout:100000});
   const ocr=(await (await request.get(`/api/v1/documents/${doc.id}/ocr`,{headers})).json()).data;expect(ocr.language).toBe('km+en');expect(ocr.engine).toContain('Tesseract');expect(ocr.pages).toBe(1);
   for(const text of ['វិក្កយបត្រ','អតិថិជន','KH-2042','110.00'])expect(ocr.rawText).toContain(text);
   const corrected=readFileSync('tests/fixtures/ocr-khmer-expected.txt','utf8').trim();await panel.getByLabel('Corrected text').fill(corrected);await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Save text review'}).click();await expect(panel.getByText('Text approved',{exact:true})).toBeVisible();await page.reload();await expect(panel.getByText('Text approved',{exact:true})).toBeVisible();
   const reviewed=(await (await request.get(`/api/v1/documents/${doc.id}/ocr`,{headers})).json()).data;expect(reviewed.reviewedText).toBe(corrected);expect(reviewed.rawText).toBe(ocr.rawText);expect(reviewed.language).toBe('km+en');
   await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.fonts.check('14px "Noto Sans Khmer"','វិក្កយបត្រ'))).toBe(true);await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`test-results/khmer-${file.endsWith('pdf')?'pdf':'png'}-mobile.png`,fullPage:true});
  });
 }
});
