import {test,expect} from '@playwright/test';
import {login} from './helpers';
import type {components} from '../../src/lib/api/schema';
test('follow-up consent, history persistence, reset and stale hiding',async({page,request})=>{
 const headers=await login(page,'admin@example.test');const me=(await(await request.get('/api/v1/me',{headers})).json()).data;const id=me.organization.id;
 let stale=false,posts=0;
 let result:components['schemas']['BusinessQuestionResult']={status:'ready',version:3,stale:false,question:'First question',output:'First answer <img src="https://tracker.invalid">',provider:'Fixture AI',model:'fixture',promptVersion:'organization_question_v1',requestedAt:'2026-10-16T01:00:00Z',completedAt:'2026-10-16T01:01:00Z',history:[],conversationStartedAt:'2026-10-16T01:00:00Z'};
 await page.route(`**/api/v1/ai/questions/organization/${id}`,async route=>{
 if(route.request().method()==='POST'){
 const input=route.request().postDataJSON();expect(input).not.toHaveProperty('history');expect(input.confirmed).toBe(true);posts++;
 expect(input.followUp).toBe(posts===1);
 const history=input.followUp?[...(result.history??[]),{question:result.question,answer:result.output}]:[];
 result={...result,version:result.version+3,question:input.question,output:posts===1?'Follow-up answer':'Independent answer',history};await route.fulfill({status:202,json:{data:{queued:true}}});return;
 }
 await route.fulfill({json:{data:{available:true,provider:'Fixture AI',model:'fixture',sourceHash:(stale?'b':'a').repeat(64),context:{kind:'organization',sections:[],omitted:[]},result:stale?{...result,stale:true,history:[],question:'',output:''}:result}}});
 });
 await page.goto('/');const panel=page.getByRole('region',{name:'Business Q&A'});await panel.getByRole('button',{name:'Ask a question',exact:true}).click();await expect(panel.getByText('First answer',{exact:false})).toBeVisible();await panel.getByLabel('Include previous conversation').check();await panel.getByLabel('Your question').fill('Please explain that.');
 page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:'Ask question',exact:true}).click();expect(posts).toBe(0);
 page.once('dialog',d=>{expect(d.message()).toContain('1 previous question-and-answer pairs');return d.accept();});await panel.getByRole('button',{name:'Ask question',exact:true}).click();await expect(panel.getByText('Follow-up answer',{exact:true})).toBeVisible();await expect(panel.getByRole('heading',{name:'Previous conversation'})).toBeVisible();expect(await panel.locator('img,script,iframe').count()).toBe(0);
 await page.reload();await panel.getByRole('button',{name:'Ask a question',exact:true}).click();await expect(panel.getByText('First question',{exact:true})).toBeVisible();await expect(panel.getByLabel('Include previous conversation')).not.toBeChecked();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await panel.screenshot({path:'test-results/conversation-mobile.png'});
 await panel.getByLabel('Your question').fill('Independent question');page.once('dialog',d=>{expect(d.message()).toContain('independent question');return d.accept();});await panel.getByRole('button',{name:'Ask question',exact:true}).click();await expect(panel.getByText('Independent answer',{exact:true})).toBeVisible();await expect(panel.getByRole('heading',{name:'Previous conversation'})).toHaveCount(0);
 result={...result,history:Array.from({length:4},(_,i)=>({question:`Earlier ${i}`,answer:`Answer ${i}`}))};await panel.getByRole('button',{name:'Reload source and answer'}).click();await expect(panel.getByLabel('Include previous conversation')).toBeDisabled();await expect(panel.getByText('This conversation reached five questions.',{exact:false})).toBeVisible();
 stale=true;await panel.getByRole('button',{name:'Reload source and answer'}).click();await expect(panel.getByText('The source or your access changed.',{exact:false})).toBeVisible();await expect(panel.getByRole('heading',{name:'Previous conversation'})).toHaveCount(0);await expect(panel.getByText('Independent answer',{exact:true})).toHaveCount(0);await expect(panel.getByLabel('Include previous conversation')).toBeDisabled();
});
