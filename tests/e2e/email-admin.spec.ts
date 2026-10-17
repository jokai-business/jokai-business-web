import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {login} from './helpers';
const root='/api/v1/settings/email';
const options={baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:!process.env.BASE_URL||process.env.E2E_ALLOW_SELF_SIGNED==='true'};
test('email administration is admin-only and disabled SMTP cannot send',async({page,browser,request})=>{
 const admin=await login(page,'admin@example.test');const salesPage=await browser.newPage(options);
 try{const sales=await login(salesPage,'sales@example.test');
  for(const path of [root,root+'/deliveries']){expect((await request.get(path)).status()).toBe(401);expect((await request.get(path,{headers:sales})).status()).toBe(403);}
  expect((await request.post(root+'/test',{headers:sales,data:{confirmed:true,idempotencyKey:randomUUID()}})).status()).toBe(403);
  expect((await request.post(root+`/deliveries/${randomUUID()}/retry`,{headers:sales,data:{confirmed:true}})).status()).toBe(403);
  await salesPage.goto('/settings/email');await expect(salesPage.getByRole('heading',{name:'Administrator access required'})).toBeVisible();
  const config=await(await request.get(root,{headers:admin})).json();expect(Object.keys(config.data).sort()).toEqual(['available','sender','testRecipient','transport']);
  expect((await request.get(root+'/deliveries',{headers:admin,params:{status:'bad'}})).status()).toBe(400);
  expect((await request.post(root+'/test',{headers:admin,data:{confirmed:false,idempotencyKey:randomUUID()}})).status()).toBe(400);
  expect((await request.post(root+'/test',{headers:admin,data:{confirmed:true,idempotencyKey:randomUUID(),recipient:'someone@example.test'}})).status()).toBe(400);
  if(!config.data.available){expect((await request.post(root+'/test',{headers:admin,data:{confirmed:true,idempotencyKey:randomUUID()}})).status()).toBe(503);expect((await request.post(root+`/deliveries/${randomUUID()}/retry`,{headers:admin,data:{confirmed:true}})).status()).toBe(503);}
  await page.goto('/settings');await page.getByRole('link',{name:/Email delivery →/}).click();await expect(page.getByRole('heading',{name:'Email delivery',exact:true})).toBeVisible();const configPanel=page.getByRole('region',{name:'Email configuration'});
  await expect(configPanel).toContainText('admin@example.test');if(!config.data.available){await expect(configPanel).toContainText('Not configured');await expect(page.getByRole('button',{name:'Send test email to me'})).toBeDisabled();}
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/email-admin-mobile.png',fullPage:true});
 }finally{await salesPage.close();}
});
test('email operations preview recipients, require confirmation and preserve idempotency after uncertain failure',async({page})=>{
 await login(page,'admin@example.test');const id=randomUUID();let testCalls=0,retryCalls=0;const keys:string[]=[];
 await page.route('**/api/v1/settings/email',r=>r.fulfill({json:{data:{available:true,sender:'notify@example.test',testRecipient:'admin@example.test',transport:'STARTTLS'}}}));
 await page.route('**/api/v1/settings/email/deliveries?*',r=>r.fulfill({json:{data:[{id,kind:'notification',recipient:'member@example.test',status:'failed',attempts:5,manualRetries:0,createdAt:new Date().toISOString(),nextAttemptAt:null,sentAt:null,canRetry:true}],meta:{page:1,pageSize:25,total:1}}}));
 // Intercept every outbound action: this test never invokes SMTP or the real queue.
 await page.route('**/api/v1/settings/email/test',async r=>{testCalls++;keys.push(r.request().postDataJSON().idempotencyKey);expect(r.request().postDataJSON().confirmed).toBe(true);if(testCalls===1)await r.fulfill({status:503,json:{error:{message:'Temporary test request failure.'}}});else await r.fulfill({status:202,json:{data:{id:randomUUID()}}});});
 await page.route('**/api/v1/settings/email/deliveries/*/retry',async r=>{retryCalls++;expect(r.request().postDataJSON()).toEqual({confirmed:true});await r.fulfill({status:202,json:{data:{ok:true}}});});
 await page.goto('/settings/email');const send=page.getByRole('button',{name:'Send test email to me'});await expect(send).toBeEnabled();
 page.once('dialog',async d=>{expect(d.message()).toContain('admin@example.test');await d.dismiss();});await send.click();expect(testCalls).toBe(0);
 page.once('dialog',d=>d.accept());await send.click();await expect(page.getByRole('main').getByRole('alert')).toContainText('Temporary test request failure.');
 page.once('dialog',d=>d.accept());await send.click();await expect(page.getByRole('status').filter({hasText:'Test email queued.'})).toBeVisible();expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
 const retry=page.getByRole('button',{name:'Retry notification to member@example.test'});page.once('dialog',async d=>{expect(d.message()).toContain('duplicate is possible');await d.dismiss();});await retry.click();expect(retryCalls).toBe(0);
 page.once('dialog',d=>d.accept());await retry.click();await expect(page.getByRole('status').filter({hasText:'One additional delivery attempt queued.'})).toBeVisible();expect(retryCalls).toBe(1);
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await expect(page.getByRole('heading',{name:'Email delivery',exact:true})).toBeInViewport();await page.screenshot({path:'test-results/email-admin-desktop.png',fullPage:true});
});
