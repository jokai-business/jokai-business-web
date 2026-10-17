import {test,expect,type APIRequestContext} from '@playwright/test';
import {login} from './helpers';
import type {components} from '../../src/lib/api/schema';
type Profile=components['schemas']['OrganizationSettings'];
type Headers={Authorization:string};
const path='/api/v1/settings/organization';
const options={baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:!process.env.BASE_URL||process.env.E2E_ALLOW_SELF_SIGNED==='true'};
async function get(request:APIRequestContext,headers:Headers):Promise<Profile>{const r=await request.get(path,{headers});expect(r.status()).toBe(200);return (await r.json()).data;}
function input(p:Profile){const {name,address,contactEmail,phone,timezone,defaultCurrency,version}=p;return {name,address,contactEmail,phone,timezone,defaultCurrency,version};}
// Valid one-pixel PNG; production decodes and re-encodes it before storing.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
test('admin profile persists, updates defaults and recovers from save errors on mobile',async({page,request})=>{
 const admin=await login(page,'admin@example.test');const original=await get(request,admin);
 try{
  await page.getByRole('button',{name:'Admin Settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Admin Settings',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Users & access/})).toHaveAttribute('href','/settings/users');await expect(page.getByRole('link',{name:/Audit log/})).toHaveAttribute('href','/settings/audit');
  await page.getByLabel('Company name',{exact:true}).fill('MVP Settings Test');await page.getByLabel('Address',{exact:true}).fill('Phnom Penh');await page.getByLabel('Contact email',{exact:true}).fill('office@example.test');await page.getByLabel('Phone',{exact:true}).fill('+855 12 345 678');await page.getByLabel('Timezone',{exact:true}).fill('Asia/Phnom_Penh');await page.getByLabel('Default currency',{exact:true}).fill('KHR');
  await page.route('**/api/v1/settings/organization',route=>route.request().method()==='PUT'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'unavailable',message:'Settings temporarily unavailable.'}})}):route.continue());
  await page.getByRole('button',{name:'Save organization settings',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('Settings temporarily unavailable.');await expect(page.getByLabel('Company name',{exact:true})).toHaveValue('MVP Settings Test');await page.unroute('**/api/v1/settings/organization');
  await page.getByRole('button',{name:'Save organization settings',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Organization settings saved.');await expect(page.locator('.desktop-sidebar .workspace-switch strong')).toHaveText('MVP Settings Test');await page.reload();await expect(page.getByLabel('Timezone',{exact:true})).toHaveValue('Asia/Phnom_Penh');await expect(page.getByLabel('Default currency',{exact:true})).toHaveValue('KHR');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/admin-settings-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/admin-settings-desktop.png',fullPage:true});
  await page.goto('/opportunities');await page.getByRole('button',{name:'New opportunity',exact:true}).click();await expect(page.getByLabel('Currency',{exact:true})).toHaveValue('KHR');
  await page.goto('/quotes');await page.getByRole('button',{name:'New quote',exact:true}).click();await expect(page.getByLabel('Currency',{exact:true})).toHaveValue('KHR');
  const audit=await request.get('/api/v1/audit-logs',{headers:admin});expect((await audit.json()).data.some((a:{action:string})=>a.action==='organization.settings_updated')).toBe(true);
 }finally{const current=await get(request,admin);expect((await request.put(path,{headers:admin,data:{...input(original),version:current.version}})).status()).toBe(200);}
});
test('settings enforce tenant/admin boundaries, stale versions and private logo validation',async({page,browser,request})=>{
 const admin=await login(page,'admin@example.test');const salesPage=await browser.newPage(options),otherPage=await browser.newPage(options);const original=await get(request,admin);const originalLogo=original.hasLogo?await (await request.get(path+'/logo',{headers:admin})).body():null;
 try{
  const sales=await login(salesPage,'sales@example.test'),other=await login(otherPage,'other@example.test');const foreign=await get(request,other);
  expect((await request.get(path)).status()).toBe(401);expect((await request.get(path,{headers:sales})).status()).toBe(403);expect((await request.put(path,{headers:sales,data:input(original)})).status()).toBe(403);expect((await request.get(path+'/logo',{headers:sales})).status()).toBe(403);expect((await request.delete(path+'/logo',{headers:sales,data:{version:original.version}})).status()).toBe(403);
  expect((await request.put(path+'/logo',{headers:sales,multipart:{version:String(original.version),file:{name:'logo.png',mimeType:'image/png',buffer:png}}})).status()).toBe(403);
  await expect(salesPage.getByRole('button',{name:'Admin Settings',exact:true})).toHaveCount(0);await salesPage.goto('/settings');await expect(salesPage.getByRole('heading',{name:'Administrator access required'})).toBeVisible();
  for(const patch of [{organizationId:'00000000-0000-0000-0000-000000000001'},{timezone:'Invalid/Zone'},{defaultCurrency:'ZZZ'},{name:''},{contactEmail:'bad'}])expect((await request.put(path,{headers:admin,data:{...input(original),...patch}})).status()).toBe(400);
  const results=await Promise.all([request.put(path,{headers:admin,data:{...input(original),address:'Concurrent A'}}),request.put(path,{headers:admin,data:{...input(original),address:'Concurrent B'}})]);expect(results.map(r=>r.status()).sort()).toEqual([200,409]);expect(await get(request,other)).toEqual(foreign);
  let current=await get(request,admin);const upload=async(buffer:Buffer,version=current.version)=>request.put(path+'/logo',{headers:admin,multipart:{version:String(version),file:{name:'logo.png',mimeType:'image/png',buffer}}});
  expect((await upload(Buffer.from('<svg></svg>'))).status()).toBe(400);expect((await upload(Buffer.alloc(2*1024*1024+1))).status()).toBe(400);
  const r=await upload(png);expect(r.status(),await r.text()).toBe(200);expect((await r.json()).data.hasLogo).toBe(true);expect((await upload(png,current.version)).status()).toBe(409);
  const download=await request.get(path+'/logo',{headers:admin});expect(download.status()).toBe(200);expect(download.headers()['content-type']).toBe('image/png');expect(download.headers()['cache-control']).toBe('no-store');expect((await download.body()).subarray(1,4).toString()).toBe('PNG');expect(await get(request,other)).toEqual(foreign);
  await page.goto('/settings');await expect(page.getByAltText('Organization logo')).toBeVisible();
  const displayed=await get(request,admin);expect((await request.put(path,{headers:admin,data:{...input(displayed),phone:'Conflict test'}})).status()).toBe(200);await page.getByLabel('Company name',{exact:true}).fill('Unsaved conflict');await page.getByRole('button',{name:'Save organization settings',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('Organization settings changed.');await expect(page.getByLabel('Company name',{exact:true})).toHaveValue('Unsaved conflict');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reload settings',exact:true}).click();await expect(page.getByLabel('Phone',{exact:true})).toHaveValue('Conflict test');
  current=await get(request,admin);expect((await request.delete(path+'/logo',{headers:admin,data:{version:current.version}})).status()).toBe(200);expect((await request.get(path+'/logo',{headers:admin})).status()).toBe(404);
 }finally{
  let current=await get(request,admin);if(originalLogo){expect((await request.put(path+'/logo',{headers:admin,multipart:{version:String(current.version),file:{name:'restore.png',mimeType:'image/png',buffer:originalLogo}}})).status()).toBe(200);}else if(current.hasLogo){expect((await request.delete(path+'/logo',{headers:admin,data:{version:current.version}})).status()).toBe(200);}
  current=await get(request,admin);expect((await request.put(path,{headers:admin,data:{...input(original),version:current.version}})).status()).toBe(200);await salesPage.close();await otherPage.close();
 }
});
