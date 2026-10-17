import {test,expect} from '@playwright/test';
import {login} from './helpers';

test('personal inbox API starts empty and requires explicit configured sync',async({page,request})=>{
 const headers=await login(page,'sales@example.test');
 expect((await request.get('/api/v1/gmail/messages')).status()).toBe(401);
 const state=(await (await request.get('/api/v1/gmail',{headers})).json()).data;
 expect((await request.put('/api/v1/gmail/sync',{headers,data:{enabled:true,confirmed:false}})).status()).toBe(400);
 expect((await request.put('/api/v1/gmail/sync',{headers,data:{enabled:true,confirmed:true,userId:'another'}})).status()).toBe(400);
 expect((await request.get('/api/v1/gmail/messages?filter=invalid',{headers})).status()).toBe(400);
 expect((await request.get('/api/v1/gmail/messages?customerId=invalid',{headers})).status()).toBe(400);
 if(!state.available){expect((await request.put('/api/v1/gmail/sync',{headers,data:{enabled:true,confirmed:true}})).status()).toBe(503);}
 const inbox=await request.get('/api/v1/gmail/messages?filter=all',{headers});expect(inbox.status()).toBe(200);
 await page.goto('/gmail');await expect(page.getByRole('region',{name:'Your Gmail inbox'})).toBeVisible();
 if(!state.connected){await expect(page.getByRole('button',{name:'Enable sync',exact:true})).toBeDisabled();}
});

test('Gmail inbox filters, plain-text reading, consent and Customer 360 stay personal',async({page,request})=>{
 const headers=await login(page,'admin@example.test');const me=(await (await request.get('/api/v1/me',{headers})).json()).data;
 const created=await request.post('/api/v1/customers',{headers,data:{name:`Gmail view ${Date.now()}`,email:'sender@example.test',ownerId:me.user.id,status:'active'}});expect(created.status()).toBe(201);const customer=(await created.json()).data;
 let enabled=false;let updates=0;let lastCustomer='';
 const message={id:'message1',subject:'<script>not executable</script>',sender:'Sender <sender@example.test>',senderEmail:'sender@example.test',snippet:'A private message preview',text:'Plain text <img src="https://tracker.invalid/pixel">',receivedAt:'2026-10-15T00:00:00Z',unread:true,textLimited:true,customerId:customer.id,customerName:customer.name};
 await page.route('**/api/v1/gmail',route=>route.fulfill({json:{data:{available:true,connected:true,email:'owner@example.test',connectedAt:'2026-10-15T00:00:00Z'},meta:{requestId:'test'}}}));
 await page.route('**/api/v1/gmail/sync',async route=>{if(route.request().method()==='PUT'){expect(route.request().postDataJSON().confirmed).toBe(true);enabled=route.request().postDataJSON().enabled;updates++;}await route.fulfill({json:{data:{enabled,status:'idle',lastSyncedAt:'2026-10-15T00:00:00Z',nextSyncAt:null,limited:true},meta:{requestId:'test'}}});});
 await page.route('**/api/v1/gmail/messages?*',async route=>{const q=new URL(route.request().url()).searchParams;lastCustomer=q.get('customerId')||'';const items=q.get('filter')==='unread'?[]:[message];await route.fulfill({json:{data:items,meta:{requestId:'test',page:1,pageSize:25,total:items.length}}});});
 await page.goto('/gmail');const panel=page.getByRole('region',{name:'Your Gmail inbox'});
 await expect(panel.getByRole('heading',{name:message.subject,exact:true})).toBeVisible();await panel.getByText('Read message text',{exact:true}).click();await expect(panel.getByText(message.text,{exact:true})).toBeVisible();expect(await panel.locator('img,script,iframe').count()).toBe(0);
 await panel.getByLabel('Message filter').selectOption('unread');await expect(panel.getByText('No synced messages match this view.',{exact:false})).toBeVisible();await panel.getByLabel('Message filter').selectOption('linked');await expect(panel.getByRole('link',{name:`Sender match: ${customer.name}`})).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());await panel.getByRole('button',{name:'Enable sync',exact:true}).click();expect(updates).toBe(0);
 page.once('dialog',dialog=>dialog.accept());await panel.getByRole('button',{name:'Enable sync',exact:true}).click();await expect(panel.getByRole('button',{name:'Pause sync',exact:true})).toBeVisible();expect(updates).toBe(1);
 await page.goto(`/customers/${customer.id}`);await page.getByRole('navigation',{name:'Customer details'}).getByRole('button',{name:'emails',exact:true}).click();await expect(panel.getByRole('heading',{name:'Your emails with this customer'})).toBeVisible();await expect(panel.getByRole('heading',{name:message.subject,exact:true})).toBeVisible();expect(lastCustomer).toBe(customer.id);await expect(panel.getByText('This view uses your own mailbox only.',{exact:false})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/gmail-customer-mobile.png',fullPage:true});
});
