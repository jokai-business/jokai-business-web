import {test,expect} from '@playwright/test';
import {login} from './helpers';
test('dashboard organization Q&A previews bounded sources with tenant boundaries and disabled-provider behavior',async({page,request,browser})=>{
 const headers=await login(page,'admin@example.test');const me=(await(await request.get('/api/v1/me',{headers})).json()).data;const path=`/api/v1/ai/questions/organization/${me.organization.id}`;
 expect((await request.get(path)).status()).toBe(401);const response=await request.get(path,{headers});expect(response.status()).toBe(200);const v=(await response.json()).data;expect(v.context.kind).toBe('organization');expect(v.context.sections).toHaveLength(6);
 for(const s of v.context.sections){expect(s.limit).toBe(10);expect(s.records.length).toBeLessThanOrEqual(10);expect(s.total).toBeGreaterThanOrEqual(s.records.length);}
 const input={version:v.result?.version??0,sourceHash:v.sourceHash,provider:v.provider,model:v.model,confirmed:true,question:'What should we follow up on?'};
 expect((await request.post(path,{headers,data:{...input,confirmed:false}})).status()).toBe(400);expect((await request.post(path,{headers,data:{...input,organizationId:me.organization.id}})).status()).toBe(400);if(!v.available)expect((await request.post(path,{headers,data:input})).status()).toBe(503);
 expect((await request.get(`/api/v1/ai/summaries/organization/${me.organization.id}`,{headers})).status()).toBe(400);
 const other=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});try{const foreign=await login(other,'other@example.test');expect((await request.get(path,{headers:foreign})).status()).toBe(404);}finally{await other.close();}
 await page.goto('/');const panel=page.getByRole('region',{name:'Business Q&A'});await panel.getByRole('button',{name:'Ask a question',exact:true}).click();await expect(panel.getByText('This is a bounded organization snapshot.',{exact:false})).toBeVisible();await panel.getByText('Records included in this request',{exact:true}).click();await expect(panel.getByRole('heading',{name:'Pipeline totals by currency',exact:false})).toBeVisible();if(!v.available){await expect(panel.getByText('AI is not configured.',{exact:false})).toBeVisible();await expect(panel.getByRole('button',{name:'Ask question',exact:true})).toBeDisabled();}
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await panel.screenshot({path:'test-results/organization-questions-mobile.png'});
});
