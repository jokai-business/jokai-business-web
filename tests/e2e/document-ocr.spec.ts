import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {login} from './helpers';
const pdf=Buffer.from('%PDF-1.4\n%%EOF');
test('OCR configuration state preserves document access and enforces permissions',async({page,request,browser})=>{
 const admin=await login(page,'admin@example.test');
 const upload=await request.post('/api/v1/documents',{headers:admin,multipart:{title:`OCR ${randomUUID()}`,workspace:'sales',file:{name:'invoice.pdf',mimeType:'application/pdf',buffer:pdf}}});expect(upload.status()).toBe(201);const doc=(await upload.json()).data;
 await page.goto(`/documents/${doc.id}`);const panel=page.getByRole('region',{name:'Document text extraction'});
 await expect(panel.getByText('Accept the document intake before requesting extraction.')).toBeVisible();
 await page.getByRole('button',{name:'Record review',exact:true}).click();
 const state=(await (await request.get(`/api/v1/documents/${doc.id}/ocr`,{headers:admin})).json()).data;
 if(state.available){await expect(panel.getByRole('button',{name:'Extract text',exact:true})).toBeEnabled();}
 else {await expect(panel.getByRole('button',{name:'Extract text',exact:true})).toBeDisabled();await expect(panel.getByText(/Text extraction is not configured/)).toBeVisible();expect((await request.post(`/api/v1/documents/${doc.id}/ocr`,{headers:admin,data:{version:0}})).status()).toBe(503);}
 const outsider=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});
 try{const other=await login(outsider,'other@example.test');expect((await request.get(`/api/v1/documents/${doc.id}/ocr`,{headers:other})).status()).toBe(404);}finally{await outsider.close();}
 await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'test-results/document-ocr-mobile.png',fullPage:true});
});
test('OCR review confirms corrections, retains source text and recovers from a stale save',async({page,request})=>{
 const admin=await login(page,'admin@example.test');const upload=await request.post('/api/v1/documents',{headers:admin,multipart:{title:`OCR review ${randomUUID()}`,workspace:'sales',file:{name:'invoice.pdf',mimeType:'application/pdf',buffer:pdf}}});const doc=(await upload.json()).data;
 await request.post(`/api/v1/documents/${doc.id}/review`,{headers:admin,data:{version:1,status:'accepted',note:''}});
 const raw='Invoice 12\nTotal 42.00\n<script>window.ocrInjected=true</script>';
 const state={available:true,status:'ready',version:3,attempts:1,sourceSha256:doc.sha256,engine:'PaddleOCR',rawText:raw,reviewedText:'',pages:1,failure:'',requestedAt:new Date().toISOString(),completedAt:new Date().toISOString(),reviewedAt:null as string|null,reviewerName:'',reviewNote:''};let saves=0;
 await page.route(`**/api/v1/documents/${doc.id}/ocr`,route=>route.fulfill({json:{data:state,meta:{requestId:'mock'}}}));
 await page.route(`**/api/v1/documents/${doc.id}/ocr/review`,async route=>{
  const input=route.request().postDataJSON();expect(input.confirmed).toBe(true);expect(input.text).toBe('Invoice 12\nTotal 43.00');saves++;
  if(saves===1){state.version++;await route.fulfill({status:409,json:{error:{code:'RECORD_CHANGED',message:'This record changed. Reload before saving.'},meta:{requestId:'mock'}}});return;}
  expect(input.version).toBe(state.version);state.status='approved';state.reviewedText=input.text;state.reviewNote=input.note;state.reviewerName='Administrator';state.reviewedAt=new Date().toISOString();state.version++;await route.fulfill({json:{data:{ok:true},meta:{requestId:'mock'}}});
 });
 await page.goto(`/documents/${doc.id}`);const panel=page.getByRole('region',{name:'Document text extraction'});
 await expect(panel.getByLabel('Corrected text')).toHaveValue(raw);await panel.getByLabel('Corrected text').fill('Invoice 12\nTotal 43.00');await panel.getByRole('button',{name:'Save text review'}).click();expect(saves).toBe(0);
 await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Save text review'}).click();await expect(panel.getByRole('alert')).toContainText('This record changed');
 await panel.getByRole('button',{name:'Refresh extraction status'}).click();await expect(panel.getByLabel('Corrected text')).toHaveValue(raw);await panel.getByLabel('Corrected text').fill('Invoice 12\nTotal 43.00');await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Save text review'}).click();
 await expect(panel.getByText('Text approved',{exact:true})).toBeVisible();await expect(panel.getByText('Invoice 12\nTotal 43.00',{exact:true})).toBeVisible();await panel.getByText('Original OCR text',{exact:true}).click();await expect(panel.locator('pre')).toHaveText(raw);expect(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(window,'ocrInjected'))).toBe(false);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'test-results/document-ocr-review.png',fullPage:true});
});
