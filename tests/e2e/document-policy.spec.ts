import {test,expect} from '@playwright/test';
import {login} from './helpers';
test('upload policy persists, isolates tenants and restricts new uploads without blocking originals',async({page,browser,request})=>{
 const admin=await login(page,'admin@example.test');const original=(await(await request.get('/api/v1/settings/documents',{headers:admin})).json()).data;let version=original.version;
 const other=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});
 const pdf=Buffer.from('%PDF-1.4\n%%EOF');
 const upload=(headers:{Authorization:string},buffer=pdf)=>request.post('/api/v1/documents',{headers,multipart:{title:'Policy test source',workspace:'sales',file:{name:'source.pdf',mimeType:'application/pdf',buffer}}});
 try{
 const sales=await login(other,'sales@example.test');expect((await request.get('/api/v1/settings/documents',{headers:sales})).status()).toBe(403);expect((await request.put('/api/v1/settings/documents',{headers:sales,data:original})).status()).toBe(403);
 expect((await request.get('/api/v1/documents/upload-policy',{headers:sales})).status()).toBe(200);
 for(const data of [{...original,maxMiB:11},{...original,allowPdf:false,allowPng:false,allowJpeg:false},{...original,organizationId:'foreign'}])expect((await request.put('/api/v1/settings/documents',{headers:admin,data})).status()).toBe(400);
 // Establish an allowed baseline, then prove restricting the policy keeps its original accessible.
 const baseline={...original,maxMiB:10,allowPdf:true,allowPng:true,allowJpeg:true};expect((await request.put('/api/v1/settings/documents',{headers:admin,data:baseline})).status()).toBe(200);version++;
 const before=await upload(sales);expect(before.status()).toBe(201);const id=(await before.json()).data.id;
 await page.goto('/settings');const panel=page.getByRole('region',{name:'Upload policy'});await panel.getByLabel('Maximum document size (MiB)').fill('1');await panel.getByLabel('Allow PDF',{exact:true}).uncheck();await panel.getByRole('button',{name:'Save upload policy',exact:true}).click();await expect(panel.getByText('Upload policy saved.',{exact:true})).toBeVisible();version++;
 expect((await request.put('/api/v1/settings/documents',{headers:admin,data:{...baseline,version:version-1}})).status()).toBe(409);
 const blocked=await upload(sales);expect(blocked.status()).toBe(400);expect((await blocked.json()).error.code).toBe('DOCUMENT_POLICY');
 const download=await request.get(`/api/v1/documents/${id}/download`,{headers:sales});expect(download.status()).toBe(200);expect(await download.body()).toEqual(pdf);
 await other.goto('/documents');await other.getByRole('button',{name:'Upload document',exact:true}).click();await expect(other.getByLabel('Source file')).toHaveAttribute('accept','.png,.jpg,.jpeg');await expect(other.getByText('.png, .jpg, .jpeg · Up to 1 MiB')).toBeVisible();
 await panel.getByLabel('Allow PDF',{exact:true}).check();await panel.getByRole('button',{name:'Save upload policy',exact:true}).click();await expect(panel.getByText('Upload policy saved.',{exact:true})).toBeVisible();version++;
 const large=Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(1024*1024),Buffer.from('%%EOF')]);expect((await upload(sales,large)).status()).toBe(400);expect((await upload(sales)).status()).toBe(201);
 await page.reload();await expect(panel.getByLabel('Maximum document size (MiB)')).toHaveValue('1');
 const audit=(await(await request.get('/api/v1/audit-logs',{headers:admin,params:{pageSize:100}})).json()).data;expect(audit.some((v:{action:string})=>v.action==='organization.document_policy_updated')).toBe(true);
 const foreign=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});try{const h=await login(foreign,'other@example.test');const p=(await(await request.get('/api/v1/documents/upload-policy',{headers:h})).json()).data;expect(p.maxMiB).toBe(10);expect((await upload(h,large)).status()).toBe(201);}finally{await foreign.close();}
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await panel.screenshot({path:'test-results/document-policy-mobile.png'});
 }finally{await other.close();const current=(await(await request.get('/api/v1/settings/documents',{headers:admin})).json()).data;if(current.version===version)expect((await request.put('/api/v1/settings/documents',{headers:admin,data:{...original,version}})).status()).toBe(200);}
});
