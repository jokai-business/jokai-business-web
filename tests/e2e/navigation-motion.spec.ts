import {test,expect} from '@playwright/test';
import {login} from './helpers';
test('section navigation preserves the shell and never flashes authentication',async({page})=>{
 await login(page,'admin@example.test');
 await page.getByRole('button',{name:'Collapse navigation',exact:true}).click();
 await page.evaluate(()=>{
  document.querySelector('.route-content')!.setAttribute('data-persistence-check','kept');const shell=document.querySelector('.app-shell')!;shell.setAttribute('data-persistence-check','kept');
  const observer=new MutationObserver(()=>{if(!shell.isConnected||document.querySelector('.login-screen,.session-loading'))document.documentElement.dataset.navigationFlicker='yes';});observer.observe(document.body,{childList:true,subtree:true});
 });
 let sessionReads=0;page.on('request',r=>{if(r.url().endsWith('/api/v1/me'))sessionReads++;});
 for(const [name,path]of [['Customers','/customers'],['Opportunities','/opportunities'],['Quotes','/quotes'],['Delivery','/projects'],['Finance','/finance'],['Documents','/documents'],['Notifications','/notifications']] as const){
  await page.getByRole('button',{name,exact:true}).click();await expect(page).toHaveURL(new RegExp(`${path}$`));await expect(page.locator('.app-shell')).toHaveAttribute('data-persistence-check','kept');await expect(page.locator('.app-shell')).toHaveClass(/is-collapsed/);
 }
 await expect(page.locator('.route-content')).toHaveAttribute('data-persistence-check','kept');expect(await page.locator('.route-content').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');expect(sessionReads).toBe(0);expect(await page.evaluate(()=>document.documentElement.dataset.navigationFlicker)).toBeUndefined();
 await page.goBack();await expect(page).toHaveURL(/\/documents$/);await expect(page.locator('.app-shell')).toHaveAttribute('data-persistence-check','kept');
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.route-content').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');expect(await page.locator('.app-shell').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Customers',exact:true}).click();await expect(page).toHaveURL(/\/customers$/);await expect(page.getByRole('dialog')).not.toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
