import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {login} from './helpers';
const options={baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:!process.env.BASE_URL||process.env.E2E_ALLOW_SELF_SIGNED==='true'};
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
function payload(title:string,workspace='sales'){return {title,workspace,notes:'Original customer source for intake review.',file:{name:'source.pdf',mimeType:'application/pdf',buffer:pdf}};}
async function upload(request:APIRequestContext,headers:{Authorization:string},title:string,workspace='sales'){
 const r=await request.post('/api/v1/documents',{headers,multipart:payload(title,workspace)});expect(r.status()).toBe(201);return (await r.json()).data;
}
test('documents upload, download, review and retain the original on mobile',async({page,browser,request})=>{
 const admin=await login(page,'admin@example.test');const salesPage=await browser.newPage(options);
 try{const sales=await login(salesPage,'sales@example.test');const title=`Document ${randomUUID().slice(0,8)}`;
 await salesPage.goto('/documents');await salesPage.getByRole('button',{name:'Upload document',exact:true}).click();
 await expect(salesPage.getByLabel('Team workspace')).toHaveValue('sales');await expect(salesPage.getByLabel('Team workspace').locator('option')).toHaveCount(1);
 await salesPage.getByLabel('Document title').fill(title);await salesPage.getByLabel('Source file').setInputFiles({name:'source.pdf',mimeType:'application/pdf',buffer:pdf});await salesPage.getByLabel('Intake notes').fill('Check the service scope before preparing a quotation.');
 await salesPage.getByRole('button',{name:'Upload document',exact:true}).click();await expect(salesPage.getByRole('heading',{name:title,exact:true})).toBeVisible();
 await expect(salesPage.getByRole('heading',{level:1})).toHaveCount(1);const id=salesPage.url().split('/').at(-1)!;await expect(salesPage.getByText('Waiting for a reviewer with access to this workspace.')).toBeVisible();
 const data=(await (await request.get(`/api/v1/documents/${id}`,{headers:sales})).json()).data;expect(data.sha256).toBe(createHash('sha256').update(pdf).digest('hex'));expect(data.sizeBytes).toBe(pdf.length);
 const download=await request.get(`/api/v1/documents/${id}/download`,{headers:sales});expect(download.status()).toBe(200);expect(await download.body()).toEqual(pdf);expect(download.headers()['content-disposition']).toContain('attachment');expect(download.headers()['content-type']).toBe('application/octet-stream');
 const downloaded=salesPage.waitForEvent('download');await salesPage.getByRole('button',{name:'Download original'}).click();expect((await downloaded).suggestedFilename()).toBe('source.pdf');
 await page.goto(`/documents/${id}`);await page.getByLabel('Review decision').selectOption('rejected');await page.getByRole('button',{name:'Record review'}).click();await expect(page.getByRole('alert').filter({hasText:'Check the submitted fields'})).toBeVisible();await page.getByLabel('Review note').fill('Please upload the signed version.');await page.getByRole('button',{name:'Record review'}).click();await expect(page.getByRole('status')).toContainText('Intake review recorded');await expect(page.getByText('Please upload the signed version.',{exact:true})).toBeVisible();
 const rejected=(await (await request.get(`/api/v1/documents/${id}`,{headers:sales})).json()).data;expect(rejected.status).toBe('rejected');expect(rejected.sha256).toBe(data.sha256);
 const other=await upload(request,admin,title+' corrected');await page.goto(`/documents/${other.id}`);await page.getByLabel('Review note').fill('Ready for manual Sales follow-up.');await page.getByRole('button',{name:'Record review'}).click();await expect(page.getByRole('status')).toContainText('Intake review recorded');await expect(page.getByText('Intake accepted',{exact:true})).toHaveCount(2);
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Download original'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.goto('/documents');await page.getByLabel('Search documents').fill(title);await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByLabel('Filter document status').selectOption('rejected');await expect(page.getByRole('link',{name:title,exact:true})).toBeVisible();await expect(page.getByRole('link',{name:title+' corrected',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const audit=(await (await request.get('/api/v1/audit-logs',{headers:admin,params:{pageSize:100}})).json()).data;expect(audit.some((r:{action:string;resourceId:string})=>r.action==='document.reviewed'&&r.resourceId===id)).toBe(true);
 }finally{await salesPage.close();}
});
test('documents enforce team and tenant boundaries, validation and concurrent reviews',async({page,browser,request})=>{
 const admin=await login(page,'admin@example.test');const salesPage=await browser.newPage(options);const otherPage=await browser.newPage(options);
 try{const sales=await login(salesPage,'sales@example.test'),other=await login(otherPage,'other@example.test');const title=`Private ${randomUUID().slice(0,8)}`;
 const corporate=await upload(request,admin,title,'corporate');const publicDoc=await upload(request,admin,title+' sales');
 for(const [headers,id] of [[sales,corporate.id],[other,publicDoc.id]] as const){
  expect((await request.get(`/api/v1/documents/${id}`,{headers})).status()).toBe(404);
  expect((await request.get(`/api/v1/documents/${id}/download`,{headers})).status()).toBe(404);
 }
 expect((await request.get('/api/v1/documents')).status()).toBe(401);
 expect((await request.get('/api/v1/documents',{headers:sales,params:{workspace:'corporate'}})).status()).toBe(403);
 const listing=(await (await request.get('/api/v1/documents',{headers:sales,params:{q:title}})).json()).data;expect(listing.map((d:{id:string})=>d.id)).toEqual([publicDoc.id]);
 expect((await request.post('/api/v1/documents',{headers:sales,multipart:payload(title,'corporate')})).status()).toBe(403);
 expect((await request.post(`/api/v1/documents/${publicDoc.id}/review`,{headers:sales,data:{version:1,status:'accepted',note:''}})).status()).toBe(403);
 expect((await request.post(`/api/v1/documents/${publicDoc.id}/review`,{headers:other,data:{version:1,status:'accepted',note:''}})).status()).toBe(404);
 const foreignCustomer=(await (await request.post('/api/v1/customers',{headers:other,data:{name:title}})).json()).data;
 expect((await request.post('/api/v1/documents',{headers:admin,multipart:{...payload(title),customerId:foreignCustomer.id}})).status()).toBe(404);
 for(const data of [ {...payload(title),organizationId:randomUUID()}, {...payload(title),title:''} ])expect((await request.post('/api/v1/documents',{headers:admin,multipart:data})).status()).toBe(400);
 expect((await request.post('/api/v1/documents',{headers:admin,multipart:{...payload(title),file:{name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('<script>alert(1)</script>')}}})).status()).toBe(415);
 expect((await request.post('/api/v1/documents',{headers:admin,multipart:{...payload(title),file:{name:'large.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(10*1024*1024+1)}}})).status()).toBe(413);
 expect((await request.get('/api/v1/documents',{headers:admin,params:{page:0}})).status()).toBe(400);
 expect((await request.post(`/api/v1/documents/${publicDoc.id}/review`,{headers:admin,data:{version:2,status:'accepted',note:''}})).status()).toBe(409);
 const results=await Promise.all(['accepted','rejected'].map(status=>request.post(`/api/v1/documents/${publicDoc.id}/review`,{headers:admin,data:{version:1,status,note:'Reviewed source.'}})));expect(results.map(r=>r.status()).sort()).toEqual([200,409]);
 const current=(await (await request.get(`/api/v1/documents/${publicDoc.id}`,{headers:admin})).json()).data;expect((await request.post(`/api/v1/documents/${publicDoc.id}/review`,{headers:admin,data:{version:current.version,status:'accepted',note:''}})).status()).toBe(409);
 }finally{await salesPage.close();await otherPage.close();}
});
