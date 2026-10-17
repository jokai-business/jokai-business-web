import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {login} from './helpers';

test('real OCR invoice fields require review, valid totals and one immutable source record',async({page,request,browser})=>{
 test.skip(process.env.OCR_E2E_ENABLED!=='true','Requires the real local OCR runtime');test.setTimeout(120000);
 const headers=await login(page,'admin@example.test');
 const upload=await request.post('/api/v1/documents',{headers,multipart:{title:`Invoice capture ${randomUUID().slice(0,8)}`,workspace:'sales',file:{name:'invoice.png',mimeType:'image/png',buffer:readFileSync('tests/fixtures/ocr-invoice.png')}}});expect(upload.status()).toBe(201);const doc=(await upload.json()).data;
 const path=`/api/v1/documents/${doc.id}/invoice-capture`;
 const initial=(await (await request.get(path,{headers})).json()).data;expect(initial.status).toBe('awaiting_text');expect((await request.put(path,{headers,data:{version:0,sourceOcrVersion:0,fields:initial.fields}})).status()).toBe(409);
 await request.post(`/api/v1/documents/${doc.id}/review`,{headers,data:{version:doc.version,status:'accepted',note:'Synthetic invoice review.'}});
 await page.goto(`/documents/${doc.id}`);const textPanel=page.getByRole('region',{name:'Document text extraction'});
 await textPanel.getByRole('button',{name:'Extract text',exact:true}).click();await expect(textPanel.getByLabel('Corrected text')).toBeVisible({timeout:100000});
 await textPanel.getByRole('checkbox').check();await textPanel.getByRole('button',{name:'Save text review'}).click();
 const panel=page.getByRole('region',{name:'Source invoice fields'});await expect(panel.getByLabel('Invoice number',{exact:true})).toHaveValue('TEST-2042');
 await expect(panel.getByLabel('Currency',{exact:true})).toHaveValue('USD');await expect(panel.getByLabel('Total',{exact:true})).toHaveValue('110.00');await expect(panel.getByRole('button',{name:'Record reviewed invoice'})).toBeDisabled();
 const suggested=(await (await request.get(path,{headers})).json()).data;
 await panel.getByLabel('Vendor',{exact:true}).fill('Example Supplies Reviewed');await panel.getByLabel('Total',{exact:true}).fill('109.00');await panel.getByRole('button',{name:'Save field draft'}).click();await expect(panel.getByRole('button',{name:'Record reviewed invoice'})).toBeEnabled();
 const draft=(await (await request.get(path,{headers})).json()).data;expect(draft.status).toBe('draft');expect(draft.fields.vendor).toBe('Example Supplies Reviewed');expect(draft.suggestions.vendor).toBe('Example Supplies');
 await panel.getByRole('button',{name:'Record reviewed invoice'}).click();expect((await (await request.get(path,{headers})).json()).data.status).toBe('draft');
 await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Record reviewed invoice'}).click();await expect(panel.getByRole('alert')).toContainText('subtotal plus tax equal to total');
 await panel.getByLabel('Total',{exact:true}).fill('110.00');await expect(panel.getByRole('button',{name:'Record reviewed invoice'})).toBeDisabled();await panel.getByRole('button',{name:'Save field draft'}).click();await expect(panel.getByRole('button',{name:'Record reviewed invoice'})).toBeEnabled();
 expect((await request.put(path,{headers,data:{version:draft.version,sourceOcrVersion:draft.sourceOcrVersion,fields:draft.fields}})).status()).toBe(409);
 const ready=(await (await request.get(path,{headers})).json()).data;
 await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Record reviewed invoice'}).click();await expect(panel.getByText('Recorded',{exact:true})).toBeVisible();await page.reload();await expect(panel.getByText('Recorded',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Save field draft'})).toHaveCount(0);
 const recorded=(await (await request.get(path,{headers})).json()).data;expect(recorded.id).toBe(draft.id);expect(recorded.fields.total).toBe('110.00');expect(recorded.sourceSha256).toBe(doc.sha256);expect(recorded.sourceOcrVersion).toBe(suggested.sourceOcrVersion);expect(recorded.reviewerName).toBeTruthy();
 expect((await request.post(`${path}/record`,{headers,data:{version:ready.version,confirmed:true}})).status()).toBe(200);
 expect((await request.put(path,{headers,data:{version:recorded.version,sourceOcrVersion:recorded.sourceOcrVersion,fields:recorded.fields}})).status()).toBe(409);
 const other=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});
 try{const sales=await login(other,'sales@example.test');expect((await request.get(path,{headers:sales})).status()).toBe(200);expect((await request.put(path,{headers:sales,data:{version:recorded.version,sourceOcrVersion:recorded.sourceOcrVersion,fields:recorded.fields}})).status()).toBe(403);await other.goto(`/documents/${doc.id}`);await expect(other.getByRole('region',{name:'Source invoice fields'}).getByText('Recorded',{exact:true})).toBeVisible();

 }finally{await other.close();}
 const foreignPage=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});try{const foreign=await login(foreignPage,'other@example.test');expect((await request.get(path,{headers:foreign})).status()).toBe(404);}finally{await foreignPage.close();}
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/invoice-capture-mobile.png',fullPage:true});
});
