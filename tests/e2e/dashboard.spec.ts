import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {login} from './helpers';
import type {components} from '../../src/lib/api/schema';
type Dashboard=components['schemas']['Dashboard'];
const options={baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:!process.env.BASE_URL||process.env.E2E_ALLOW_SELF_SIGNED==='true'};
async function overview(request:APIRequestContext,headers:{Authorization:string}):Promise<Dashboard>{const r=await request.get('/api/v1/dashboard',{headers});expect(r.status()).toBe(200);return (await r.json()).data;}
const cents=(s:string)=>BigInt(s.replace('.',''));
test('business overview totals keep currencies separate and select only my due tasks',async({page,request})=>{
 const headers=await login(page,'admin@example.test');const before=await overview(request,headers);const me=(await (await request.get('/api/v1/me',{headers})).json()).data;
 const marker=`Dashboard ${randomUUID().slice(0,8)}`;const customer=(await (await request.post('/api/v1/customers',{headers,data:{name:marker}})).json()).data;
 const stages=(await (await request.get('/api/v1/pipeline-stages',{headers})).json()).data;const open=stages.find((s:{isClosed:boolean})=>!s.isClosed),won=stages.find((s:{isWon:boolean})=>s.isWon),lost=stages.find((s:{isClosed:boolean;isWon:boolean})=>s.isClosed&&!s.isWon);
 async function deal(stageId:string,value:string,currency:string,probability:number){const r=await request.post('/api/v1/opportunities',{headers,data:{customerId:customer.id,stageId,title:marker,expectedValue:value,currency,probability}});expect(r.status()).toBe(201);return (await r.json()).data;}
 await deal(open.id,'100.00','USD',25);const source=await deal(won.id,'300.00','USD',100);await deal(lost.id,'900.00','USD',0);await deal(open.id,'200.00','EUR',50);
 const projectResponse=await request.post('/api/v1/projects',{headers,data:{opportunityId:source.id,name:marker}});expect(projectResponse.status()).toBe(201);const project=(await projectResponse.json()).data;
 const excluded:string[]=[];
 for(const [name,date,status,assignee] of [['Today',before.today,'todo',me.user.id],['Overdue','2000-01-01','in_progress',me.user.id],['Done',before.today,'done',me.user.id],['Future','2099-01-01','todo',me.user.id],['Unassigned',before.today,'todo',''],['No date','','todo',me.user.id]]){
  const r=await request.post(`/api/v1/projects/${project.id}/tasks`,{headers,data:{title:marker+' '+name,dueDate:date,status,assigneeId:assignee}});expect(r.status()).toBe(201);const t=(await r.json()).data;if(!['Today','Overdue'].includes(name))excluded.push(t.id);
 }
 const after=await overview(request,headers);for(const [currency,openDelta,weightedDelta,wonDelta] of [['USD',10000,2500,30000],['EUR',20000,10000,0]] as const){const a=after.sales!.currencies.find(c=>c.currency===currency)!;const b=before.sales!.currencies.find(c=>c.currency===currency);expect(cents(a.openValue)-cents(b?.openValue??'0.00')).toBe(BigInt(openDelta));expect(cents(a.weightedValue)-cents(b?.weightedValue??'0.00')).toBe(BigInt(weightedDelta));expect(cents(a.wonValue)-cents(b?.wonValue??'0.00')).toBe(BigInt(wonDelta));}
 expect(after.tasks!.dueToday).toBe(before.tasks!.dueToday+1);expect(after.tasks!.overdue).toBe(before.tasks!.overdue+1);expect(after.tasks!.items.length).toBeLessThanOrEqual(8);expect(after.tasks!.items.every(t=>t.dueDate<=after.today&&!excluded.includes(t.id))).toBe(true);
 expect(after.sales!.stages.find(s=>s.id===open.id)!.count).toBe(before.sales!.stages.find(s=>s.id===open.id)!.count+2);expect(after.activity.length).toBeLessThanOrEqual(12);expect(after.activity.some(a=>a.title===marker)).toBe(true);
 await page.goto('/');await expect(page.getByRole('heading',{name:'Sales pipeline',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'My due tasks',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Recent business activity',exact:true})).toBeVisible();await page.getByRole('button',{name:'Refresh overview',exact:true}).click();await expect(page.getByRole('button',{name:'Refresh overview',exact:true})).toBeEnabled();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByText('Your account and permissions',{exact:true}).click();await expect(page.getByText(me.user.email+' · '+me.organization.name,{exact:true})).toBeVisible();
});
test('overview hides unauthorized modules, confidential document events and foreign organizations',async({page,browser,request})=>{
 const admin=await login(page,'admin@example.test');const salesPage=await browser.newPage(options),otherPage=await browser.newPage(options);
 try{const sales=await login(salesPage,'sales@example.test'),other=await login(otherPage,'other@example.test');const baseline=await overview(request,other);const title=`Corporate ${randomUUID()}`;
 const upload=await request.post('/api/v1/documents',{headers:admin,multipart:{title,workspace:'corporate',file:{name:'contract.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nprivate\n%%EOF')}}});expect(upload.status()).toBe(201);
 const adminData=await overview(request,admin);expect(adminData.activity.some(a=>a.title===title)).toBe(true);
 const salesData=await overview(request,sales);expect(salesData.tasks).toBeNull();expect(salesData.sales).not.toBeNull();expect(salesData.activity.some(a=>a.title===title||a.action.startsWith('invoice.')||a.action.startsWith('project.'))).toBe(false);
 const foreign=await overview(request,other);expect(foreign.sales).toEqual(baseline.sales);expect(foreign.tasks).toEqual(baseline.tasks);expect(foreign.activity.some(a=>a.title===title)).toBe(false);
 const spoof=await request.get('/api/v1/dashboard',{headers:{...sales,'X-Organization-ID':randomUUID()},params:{organizationId:randomUUID()}});expect((await spoof.json()).data.sales).toEqual(salesData.sales);expect((await request.get('/api/v1/dashboard')).status()).toBe(401);
 await salesPage.goto('/');await expect(salesPage.getByRole('heading',{name:'Sales pipeline',exact:true})).toBeVisible();await expect(salesPage.getByRole('heading',{name:'My due tasks',exact:true})).toHaveCount(0);await expect(salesPage.getByRole('heading',{name:'Invoice balances',exact:true})).toHaveCount(0);await expect(salesPage.getByRole('link',{name:title,exact:true})).toHaveCount(0);
 }finally{await salesPage.close();await otherPage.close();}
});
