import {test,expect} from '@playwright/test';
import {login} from './helpers';

test('Gmail connection is personal, unavailable without configuration, and callback errors are sanitized',async({page,request})=>{
 const headers=await login(page,'sales@example.test');
 const status=await request.get('/api/v1/gmail',{headers});expect(status.status()).toBe(200);const data=(await status.json()).data;
 expect(Object.keys(data).sort()).toEqual(['available','connected','connectedAt','email']);
 expect((await request.get('/api/v1/gmail')).status()).toBe(401);
 expect((await request.post('/api/v1/gmail/connect',{headers,data:{confirmed:false}})).status()).toBe(400);
 expect((await request.post('/api/v1/gmail/connect',{headers,data:{confirmed:true,userId:'another-user'}})).status()).toBe(400);
 await page.goto('/gmail');await expect(page.getByRole('heading',{name:'Gmail connection',exact:true})).toBeVisible();
 if(!data.available){await expect(page.getByRole('button',{name:'Connect Gmail',exact:true})).toBeDisabled();expect((await request.post('/api/v1/gmail/connect',{headers,data:{confirmed:true}})).status()).toBe(503);}
 const callback=await request.get('/api/v1/gmail/callback?state=invalid&code=private-code&error=private-provider-error',{maxRedirects:0});expect(callback.status()).toBe(303);expect(callback.headers().location).toBe('/gmail?connection=failed');expect(await callback.text()).not.toContain('private-code');
 await page.goto('/gmail?connection=failed');await expect(page.getByRole('status').filter({hasText:'not completed'})).toBeVisible();await expect(page).toHaveURL(/\/gmail$/);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/gmail-mobile.png',fullPage:true});
});

test('Gmail disconnect requires confirmation and reports unconfirmed provider revocation',async({page})=>{
 await login(page,'admin@example.test');let connected=true;let deletes=0;
 await page.route('**/api/v1/gmail',async route=>{
  if(route.request().method()==='DELETE'){expect(route.request().postDataJSON()).toEqual({confirmed:true});deletes++;connected=false;await route.fulfill({json:{data:{revoked:false},meta:{requestId:'test'}}});return;}
  await route.fulfill({json:{data:{available:true,connected,email:connected?'personal@example.test':'',connectedAt:connected?'2026-10-15T00:00:00Z':null},meta:{requestId:'test'}}});
 });
 await page.goto('/gmail');await expect(page.getByText('personal@example.test',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Disconnect Gmail',exact:true}).click();expect(deletes).toBe(0);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Disconnect Gmail',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Stored credentials removed'})).toBeVisible();await expect(page.getByRole('button',{name:'Connect Gmail',exact:true})).toBeEnabled();expect(deletes).toBe(1);await expect(page.getByText('personal@example.test',{exact:true})).toHaveCount(0);
});
