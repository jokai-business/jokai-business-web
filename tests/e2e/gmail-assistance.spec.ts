import {test,expect} from '@playwright/test';
import {login} from './helpers';
import type {components} from '../../src/lib/api/schema';

test('email AI endpoints require authentication, explicit consent and server-owned mailbox scope',async({page,request})=>{
 const headers=await login(page,'sales@example.test');
 expect((await request.get('/api/v1/gmail/ai')).status()).toBe(401);
 const status=await request.get('/api/v1/gmail/ai',{headers});expect(status.status()).toBe(200);const data=(await status.json()).data;expect(Object.keys(data).sort()).toEqual(['available','model','provider']);
 expect((await request.get('/api/v1/gmail/messages/missing/assistance',{headers})).status()).toBe(404);
 const body={kind:'summary',version:0,sourceHash:'a'.repeat(64),provider:data.provider,model:data.model,confirmed:true};
 expect((await request.post('/api/v1/gmail/messages/missing/assistance',{headers,data:{...body,confirmed:false}})).status()).toBe(400);
 expect((await request.post('/api/v1/gmail/messages/missing/assistance',{headers,data:{...body,userId:'another-member'}})).status()).toBe(400);
 if(!data.available){expect((await request.post('/api/v1/gmail/messages/missing/assistance',{headers,data:body})).status()).toBe(503);}
 expect((await request.put('/api/v1/gmail/messages/missing/draft',{headers,data:{text:'Draft',version:1,confirmed:false}})).status()).toBe(400);
});

test('email AI summary and reply require consent, review and persist edited text on reload',async({page})=>{
 await login(page,'admin@example.test');
 const message={id:'ai-fixture',subject:'Invoice clarification',sender:'Sender <sender@example.test>',senderEmail:'sender@example.test',snippet:'Please confirm the invoice reference.',text:'Please confirm the invoice reference. សួស្តី',receivedAt:'2026-10-15T00:00:00Z',unread:true,textLimited:false,customerId:null,customerName:null};
 let items:components['schemas']['GmailAssistance'][]=[];let posts=0;let saves=0;let queuedReads=0;let conflict=false;
 const envelope=(data:unknown)=>({data,meta:{requestId:'test'}});
 await page.route('**/api/v1/gmail/messages?*',route=>route.fulfill({json:{data:[message],meta:{requestId:'test',page:1,pageSize:25,total:1}}}));
 await page.route('**/api/v1/gmail/ai',route=>route.fulfill({json:envelope({available:true,provider:'Fixture AI',model:'fixture-model'})}));
 await page.route('**/api/v1/gmail/messages/ai-fixture/assistance',async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();expect(body.confirmed).toBe(true);expect(body.provider).toBe('Fixture AI');expect(body.model).toBe('fixture-model');expect(body.sourceHash).toBe('a'.repeat(64));expect(body.userId).toBeUndefined();posts++;
   items=items.filter(i=>i.kind!==body.kind);items.push({kind:body.kind,status:'queued',version:1,stale:false,provider:'Fixture AI',model:'fixture-model',promptVersion:`email_${body.kind}_v1`,output:'',editedText:'',reviewedAt:null,requestedAt:'2026-10-15T01:00:00Z',completedAt:null});queuedReads=0;
   await route.fulfill({status:202,json:envelope({queued:true})});return;
  }
  if(items.some(i=>i.status==='queued')&&queuedReads++>0){items=items.map(i=>i.status==='queued'?{...i,status:'ready',version:3,completedAt:'2026-10-15T01:01:00Z',output:i.kind==='summary'?'Sender requests invoice clarification. <img src="https://tracker.invalid/pixel">':'Thank you. The invoice reference is [reference].'}:i);}
  await route.fulfill({json:envelope({sourceHash:'a'.repeat(64),items})});
 });
 await page.route('**/api/v1/gmail/messages/ai-fixture/draft',async route=>{
  const body=route.request().postDataJSON();expect(body.confirmed).toBe(true);saves++;
  if(conflict){await route.fulfill({status:409,json:{error:{code:'AI_CHANGED',message:'The source or AI result changed. Reload before continuing.',requestId:'test'}}});return;}
  items=items.map(i=>i.kind==='reply'?{...i,version:i.version+1,editedText:body.text,reviewedAt:'2026-10-15T01:02:00Z'}:i);await route.fulfill({json:envelope({saved:true})});
 });
 await page.goto('/gmail');await page.getByRole('button',{name:'AI assistance',exact:true}).click();const panel=page.getByRole('region',{name:'Email AI assistance'});await expect(panel.getByText('Provider: Fixture AI',{exact:false})).toBeVisible();
 page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'Generate summary',exact:true}).click();expect(posts).toBe(0);
 page.once('dialog',d=>{expect(d.message()).toContain('cached plain-text body');return d.accept();});await panel.getByRole('button',{name:'Generate summary',exact:true}).click();await expect(panel.getByText('Waiting for AI…',{exact:true})).toBeVisible();await expect(panel.getByText('Sender requests invoice clarification.',{exact:false})).toBeVisible({timeout:15000});expect(await panel.locator('img,iframe,script').count()).toBe(0);
 page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'Draft reply',exact:true}).click();await expect(panel.getByLabel('Reply text')).toBeVisible({timeout:15000});await expect(panel.getByRole('button',{name:'Save reviewed draft',exact:true})).toBeDisabled();await expect(panel.getByRole('button',{name:'Copy reviewed draft',exact:true})).toHaveCount(0);
 const corrected='សួស្តី — Thank you. The reference is TEST-42.';await panel.getByLabel('Reply text').fill(corrected);await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Save reviewed draft',exact:true}).click();await expect(panel.getByText('Reviewed draft saved',{exact:false})).toBeVisible();expect(saves).toBe(1);expect(posts).toBe(2);
 await page.reload();await page.getByRole('button',{name:'AI assistance',exact:true}).click();await expect(panel.getByLabel('Reply text')).toHaveValue(corrected);await expect(panel.getByRole('button',{name:'Copy reviewed draft',exact:true})).toBeVisible();
 conflict=true;await panel.getByLabel('Reply text').fill('Unsaved local correction');await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Save reviewed draft',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Reload before continuing');await expect(panel.getByLabel('Reply text')).toHaveValue('Unsaved local correction');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/gmail-ai-mobile.png',fullPage:true});
 expect(await panel.getByRole('button',{name:/^Send/}).count()).toBe(0);
});

test('email assistance clearly handles disabled providers and stale or failed results',async({page})=>{
 await login(page,'admin@example.test');let enabled=false;const message={id:'disabled-fixture',subject:'Test',sender:'Sender',senderEmail:'sender@example.test',snippet:'Test',text:'Test',receivedAt:'2026-10-15T00:00:00Z',unread:false,textLimited:true,customerId:null,customerName:null};
 await page.route('**/api/v1/gmail/messages?*',r=>r.fulfill({json:{data:[message],meta:{page:1,pageSize:25,total:1,requestId:'test'}}}));
 await page.route('**/api/v1/gmail/ai',r=>r.fulfill({json:{data:{available:enabled,provider:enabled?'Fixture AI':'',model:enabled?'fixture-model':''}}}));
 await page.route('**/api/v1/gmail/messages/disabled-fixture/assistance',r=>r.fulfill({json:{data:{sourceHash:'a'.repeat(64),items:[{kind:'reply',status:'failed',version:4,stale:true,provider:'Fixture AI',model:'fixture-model',promptVersion:'email_reply_v1',output:'',editedText:'',reviewedAt:null,requestedAt:'2026-10-15T01:00:00Z',completedAt:null}]}}}));
 await page.goto('/gmail');await page.getByRole('button',{name:'AI assistance',exact:true}).click();const panel=page.getByRole('region',{name:'Email AI assistance'});await expect(panel.getByText('AI is not configured.',{exact:false})).toBeVisible();await expect(panel.getByRole('button',{name:'Draft reply',exact:true})).toBeDisabled();await expect(panel.getByText('The source changed.',{exact:false})).toBeVisible();await expect(panel.getByText('Generation failed or was interrupted.',{exact:false})).toBeVisible();enabled=true;await panel.getByRole('button',{name:'Reload AI assistance',exact:true}).click();await expect(panel.getByRole('button',{name:'Draft reply',exact:true})).toBeEnabled();
});
