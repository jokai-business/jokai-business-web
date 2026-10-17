import {test,expect} from '@playwright/test';
import {login} from './helpers';
test('operational health is admin-only, sanitized, cached and recoverable on mobile',async({page,browser,request})=>{
 expect((await request.get('/api/v1/settings/health')).status()).toBe(401);
 const admin=await login(page,'admin@example.test');
 const response=await request.get('/api/v1/settings/health',{headers:admin});expect(response.status()).toBe(200);const data=(await response.json()).data;
 expect(Object.keys(data).sort()).toEqual(['checkedAt','database','khmerOcr','ocr','storage']);expect(data.database).toBe('reachable');expect(data.storage).toBe('reachable');expect(Number.isNaN(Date.parse(data.checkedAt))).toBe(false);
 const config=(await(await request.get('/api/v1/settings/integrations',{headers:admin})).json()).data;
 for(const key of ['ocr','khmerOcr'])expect(data[key]).toBe(config[key]==='configured'?'reachable':'not_configured');
 const cached=(await(await request.get('/api/v1/settings/health',{headers:admin})).json()).data;expect(cached).toEqual(data);
 const other=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});try{const sales=await login(other,'sales@example.test');expect((await request.get('/api/v1/settings/health',{headers:sales})).status()).toBe(403);}finally{await other.close();}
 await page.goto('/settings');const panel=page.getByRole('region',{name:'Operational health'});await expect(panel.getByRole('status')).toHaveCount(0);
 await panel.getByRole('button',{name:'Check service health'}).click();await expect(panel.getByRole('status')).toContainText('Checked at');await expect(panel.getByText('Reachable',{exact:true}).first()).toBeVisible();
 await page.route('**/api/v1/settings/health',route=>route.abort());await panel.getByRole('button',{name:'Check service health'}).click();await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByRole('status')).toHaveCount(0);
 await page.unroute('**/api/v1/settings/health');await panel.getByRole('button',{name:'Check service health'}).click();await expect(panel.getByRole('status')).toContainText('Checked at');await expect(panel.getByRole('alert')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await panel.screenshot({path:'test-results/operational-health-mobile.png'});
});
