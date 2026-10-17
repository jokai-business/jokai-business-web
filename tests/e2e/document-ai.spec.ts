import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {login} from './helpers';
import type {components} from '../../src/lib/api/schema';
type Capture=components['schemas']['InvoiceCapture'];
test('AI extraction previews approved text, requires consent, and applies suggestions only to a reviewed draft',async({page,request,browser})=>{
 test.skip(process.env.OCR_E2E_ENABLED!=='true','Requires local OCR');test.setTimeout(120000);
 const headers=await login(page,'admin@example.test');
 const upload=await request.post('/api/v1/documents',{headers,multipart:{title:`AI extraction ${Date.now()}`,workspace:'sales',file:{name:'invoice.png',mimeType:'image/png',buffer:readFileSync('tests/fixtures/ocr-invoice.png')}}});expect(upload.status()).toBe(201);const doc=(await upload.json()).data;
 const base=`/api/v1/documents/${doc.id}`,path=`${base}/ai-extraction`;
 expect((await request.get(path,{headers})).status()).toBe(409);
 await request.post(`${base}/review`,{headers,data:{version:doc.version,status:'accepted',note:'Synthetic extraction fixture'}});
 expect((await request.post(`${base}/ocr`,{headers,data:{version:0}})).status()).toBe(202);
 await expect.poll(async()=>((await (await request.get(`${base}/ocr`,{headers})).json()).data.status),{timeout:100000}).toBe('ready');
 const ocr=(await (await request.get(`${base}/ocr`,{headers})).json()).data;
 const text='Invoice Number: TEST-2042\nInvoice Date: 2026-10-15\nDue Date: 2026-11-15\nVendor: Example Supplies\nCurrency: USD\nSubtotal: 100.00\nTax: 10.00\nTotal: 110.00';
 expect((await request.post(`${base}/ocr/review`,{headers,data:{version:ocr.version,status:'approved',text,note:'Checked synthetic fixture',confirmed:true}})).status()).toBe(200);
 const response=await request.get(path,{headers});expect(response.status()).toBe(200);const actual=(await response.json()).data;expect(actual.context.text).toBe(text);expect((await request.get(path)).status()).toBe(401);
 const body={version:0,sourceHash:actual.sourceHash,provider:actual.provider,model:actual.model,confirmed:true};
 expect((await request.post(path,{headers,data:{...body,confirmed:false}})).status()).toBe(400);expect((await request.post(path,{headers,data:{...body,userId:doc.uploadedBy}})).status()).toBe(400);
 if(!actual.available)expect((await request.post(path,{headers,data:body})).status()).toBe(503);
 const other=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});try{const sales=await login(other,'sales@example.test');expect((await request.get(path,{headers:sales})).status()).toBe(403);}finally{await other.close();}
 let capture:Capture=(await (await request.get(`${base}/invoice-capture`,{headers})).json()).data;
 const suggestion={fields:{...capture.fields,vendor:'Example Supplies'},evidence:{...capture.fields,vendor:'Example Supplies'}};
 let result:components['schemas']['BusinessAIResult']|null=null,posts=0,saves=0,records=0;
 await page.route(`**${path}`,async route=>{
  if(route.request().method()==='POST'){const inBody=route.request().postDataJSON();expect(inBody.confirmed).toBe(true);expect(inBody.sourceHash).toBe(actual.sourceHash);posts++;result={status:'ready',version:3,stale:false,output:JSON.stringify(suggestion),provider:'Fixture AI',model:'fixture-model',promptVersion:'invoice_extraction_v1',requestedAt:new Date().toISOString(),completedAt:new Date().toISOString()};await route.fulfill({status:202,json:{data:{queued:true}}});return;}
  await route.fulfill({json:{data:{...actual,available:true,provider:'Fixture AI',model:'fixture-model',result}}});
 });
 await page.route(`**${base}/invoice-capture`,async route=>{
  if(route.request().method()==='PUT'){const input=route.request().postDataJSON();expect(input.aiVersion).toBe(3);expect(input.fields.vendor).toBe('Reviewed vendor');saves++;capture={...capture,version:1,status:'draft',fields:input.fields,suggestions:suggestion.fields,aiProvenance:{provider:'Fixture AI',model:'fixture-model',promptVersion:'invoice_extraction_v1',suggestion}};await route.fulfill({json:{data:{saved:true}}});return;}
  await route.fulfill({json:{data:capture}});
 });
 await page.route(`**${base}/invoice-capture/record`,async route=>{expect(route.request().postDataJSON().confirmed).toBe(true);records++;capture={...capture,status:'recorded',version:2,reviewerName:'Reviewer',recordedAt:new Date().toISOString()};await route.fulfill({json:{data:{recorded:true}}});});
 await page.goto(`/documents/${doc.id}`);const panel=page.getByRole('region',{name:'Source invoice fields'}),ai=page.getByRole('region',{name:'AI invoice extraction'});
 await ai.getByRole('button',{name:'Preview AI extraction'}).click();await ai.getByText('Approved text sent to AI',{exact:true}).click();await expect(ai.getByText(text,{exact:true})).toBeVisible();
 page.once('dialog',d=>d.dismiss());await ai.getByRole('button',{name:'Generate AI suggestions'}).click();expect(posts).toBe(0);
 page.once('dialog',d=>{expect(d.message()).toContain('Fixture AI');return d.accept();});await ai.getByRole('button',{name:'Generate AI suggestions'}).click();await expect(ai.getByRole('button',{name:'Apply suggestions to form'})).toBeVisible();expect(posts).toBe(1);expect(saves).toBe(0);
 await panel.getByLabel('Vendor',{exact:true}).fill('Unsaved vendor');page.once('dialog',d=>d.dismiss());await ai.getByRole('button',{name:'Apply suggestions to form'}).click();await expect(panel.getByLabel('Vendor',{exact:true})).toHaveValue('Unsaved vendor');
 page.once('dialog',d=>d.accept());await ai.getByRole('button',{name:'Apply suggestions to form'}).click();await expect(panel.getByLabel('Vendor',{exact:true})).toHaveValue('Example Supplies');await expect(panel.getByRole('button',{name:'Record reviewed invoice'})).toBeDisabled();expect(saves).toBe(0);expect(records).toBe(0);
 await panel.getByLabel('Vendor',{exact:true}).fill('Reviewed vendor');await panel.getByRole('button',{name:'Save field draft'}).click();await expect(panel.getByText('Original AI suggestions · Fixture AI',{exact:false})).toBeVisible();expect(saves).toBe(1);expect(records).toBe(0);
 await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Record reviewed invoice'}).click();await expect(panel.getByText('Recorded',{exact:true})).toBeVisible();await page.reload();await expect(panel.getByText('Original AI suggestions · Fixture AI',{exact:false})).toBeVisible();expect(records).toBe(1);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/document-ai-mobile.png',fullPage:true});
});
