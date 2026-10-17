import {test,expect} from '@playwright/test';
import {login} from './helpers';
import type {components} from '../../src/lib/api/schema';

test('business summary API previews authorized context and rejects ownership injection or missing consent',async({page,request,browser})=>{
 const headers=await login(page,'admin@example.test');const me=(await (await request.get('/api/v1/me',{headers})).json()).data;
 const created=await request.post('/api/v1/customers',{headers,data:{name:`AI customer ${Date.now()}`,ownerId:me.user.id,status:'active'}});expect(created.status()).toBe(201);const customer=(await created.json()).data;
 const path=`/api/v1/ai/summaries/customer/${customer.id}`;expect((await request.get(path)).status()).toBe(401);const response=await request.get(path,{headers});expect(response.status()).toBe(200);const v=(await response.json()).data;expect(v.context.sections[0].records[0].name).toBe(customer.name);expect(v.result).toBeNull();
 const body={version:0,sourceHash:v.sourceHash,provider:v.provider,model:v.model,confirmed:true};expect((await request.post(path,{headers,data:{...body,confirmed:false}})).status()).toBe(400);expect((await request.post(path,{headers,data:{...body,userId:me.user.id}})).status()).toBe(400);if(!v.available)expect((await request.post(path,{headers,data:body})).status()).toBe(503);
 const foreignPage=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});try{const foreign=await login(foreignPage,'other@example.test');expect((await request.get(path,{headers:foreign})).status()).toBe(404);}finally{await foreignPage.close();}
 await page.goto(`/customers/${customer.id}`);const panel=page.getByRole('region',{name:'Business AI summary'});await panel.getByRole('button',{name:'Preview AI summary',exact:true}).click();await expect(panel.getByText('Records included in this request',{exact:true})).toBeVisible();if(!v.available){await expect(panel.getByText('AI is not configured.',{exact:false})).toBeVisible();await expect(panel.getByRole('button',{name:'Generate summary',exact:true})).toBeDisabled();}
});

for(const kind of ['customer','opportunity'] as const){
 test(`${kind} summary requires source consent, survives reload and hides stale output`,async({page,request})=>{
  const headers=await login(page,'admin@example.test');const me=(await (await request.get('/api/v1/me',{headers})).json()).data;
  const customer=(await (await request.post('/api/v1/customers',{headers,data:{name:`AI workflow ${Date.now()}`,ownerId:me.user.id,status:'active'}})).json()).data;
  let id=customer.id;
  if(kind==='opportunity'){const stages=(await (await request.get('/api/v1/pipeline-stages',{headers})).json()).data;const response=await request.post('/api/v1/opportunities',{headers,data:{customerId:customer.id,title:'Summary test opportunity',stageId:stages[0].id,expectedValue:'100.00',currency:'USD',probability:30,ownerId:me.user.id,source:'Manual',requirement:'Review requirements',nextAction:'Schedule meeting',expectedCloseDate:''}});expect(response.status()).toBe(201);id=(await response.json()).data.id;}
  let result:components['schemas']['BusinessAIResult']|null=null;let posts=0;let reads=0;let stale=false;
  const context={kind,sections:[{name:kind==='customer'?'Customer':'Opportunity',total:1,limit:5,records:[{id,name:'Test source',notes:'Source text <img src="https://tracker.invalid/pixel">'}]},{name:'Latest contacts',total:8,limit:5,records:[{name:'One contact'}]}],omitted:['Invoices (no access)']};
  await page.route(`**/api/v1/ai/summaries/${kind}/${id}`,async route=>{
   if(route.request().method()==='POST'){const input=route.request().postDataJSON();expect(input.confirmed).toBe(true);expect(input.provider).toBe('Fixture AI');expect(input.sourceHash).toBe(stale?'b'.repeat(64):'a'.repeat(64));posts++;reads=0;stale=false;result={status:'queued',version:1,stale:false,output:'',provider:'Fixture AI',model:'fixture-model',promptVersion:'business_summary_v1',requestedAt:'2026-10-15T01:00:00Z',completedAt:null};await route.fulfill({status:202,json:{data:{queued:true}}});return;}
   if(result?.status==='queued'&&reads++>0)result={...result,status:'ready',version:3,output:'A reviewable overview. Source: Test source. <img src="https://tracker.invalid/ai">',completedAt:'2026-10-15T01:01:00Z'};
   await route.fulfill({json:{data:{available:true,provider:'Fixture AI',model:'fixture-model',sourceHash:stale?'b'.repeat(64):'a'.repeat(64),context,result:result?{...result,stale,output:stale?'':result.output}:null}}});
  });
  await page.goto(`/${kind==='customer'?'customers':'opportunities'}/${id}`);const panel=page.getByRole('region',{name:'Business AI summary'});await panel.getByRole('button',{name:'Preview AI summary',exact:true}).click();await panel.getByText('Records included in this request',{exact:true}).click();await expect(panel.getByText('Some records are omitted from this snapshot.',{exact:true})).toBeVisible();await expect(panel.getByText('Excluded: Invoices (no access).',{exact:true})).toBeVisible();expect(await panel.locator('img,script,iframe').count()).toBe(0);
  page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'Generate summary',exact:true}).click();expect(posts).toBe(0);
  page.once('dialog',d=>{expect(d.message()).toContain('Fixture AI');return d.accept();});await panel.getByRole('button',{name:'Generate summary',exact:true}).click();await expect(panel.getByText('Waiting for AI…',{exact:true})).toBeVisible();await expect(panel.getByText('A reviewable overview.',{exact:false})).toBeVisible({timeout:15000});expect(posts).toBe(1);expect(await panel.locator('img,script,iframe').count()).toBe(0);
  await page.reload();await panel.getByRole('button',{name:'Preview AI summary',exact:true}).click();await expect(panel.getByText('A reviewable overview.',{exact:false})).toBeVisible();
  stale=true;await panel.getByRole('button',{name:'Reload source and summary',exact:true}).click();await expect(panel.getByText('The source or your access changed.',{exact:false})).toBeVisible();await expect(panel.getByText('A reviewable overview.',{exact:false})).toHaveCount(0);await expect(panel.getByRole('button',{name:'Generate summary',exact:true})).toBeEnabled();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`test-results/${kind}-ai-mobile.png`,fullPage:true});
 });
}
