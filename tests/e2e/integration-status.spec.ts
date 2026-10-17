import {test,expect} from '@playwright/test';
import {login} from './helpers';
test('integration configuration is sanitized and restricted to administrators',async({page,request,browser})=>{
 expect((await request.get('/api/v1/settings/integrations')).status()).toBe(401);
 const admin=await login(page,'admin@example.test');
 const response=await request.get('/api/v1/settings/integrations',{headers:admin});expect(response.status()).toBe(200);
 const data=(await response.json()).data;
 expect(Object.keys(data).sort()).toEqual(['ai','drive','email','gmail','khmerOcr','ocr','storageBackend','telegram']);
 expect(['local','s3','unavailable']).toContain(data.storageBackend);
 for(const key of ['ai','email','gmail','khmerOcr','ocr'])expect(['configured','not_configured']).toContain(data[key]);
 expect(data.drive).toBe('unavailable');expect(data.telegram).toBe('unavailable');
 const other=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});
 try{const sales=await login(other,'sales@example.test');expect((await request.get('/api/v1/settings/integrations',{headers:sales})).status()).toBe(403);}finally{await other.close();}
 await page.goto('/settings');const panel=page.getByRole('region',{name:'Integration status'});
 await expect(panel.getByText('Document storage',{exact:true})).toBeVisible();await expect(panel.getByText('Unavailable',{exact:true})).toHaveCount(2);
 await panel.getByRole('button',{name:'Refresh integration status'}).click();await expect(panel.getByText('Document storage',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.screenshot({path:'test-results/integration-status-mobile.png'});
});
