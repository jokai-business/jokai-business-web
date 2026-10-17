import {test,expect} from '@playwright/test';
test('authentication errors stay outside inputs and empty values do not submit',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#username').waitFor();
 let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/login-actions/authenticate'))posts++;});
 await page.locator('#kc-login').click();await expect(page.locator('#username-error')).toBeVisible();await expect(page.locator('#password-error')).toBeVisible();expect(posts).toBe(0);await expect(page.locator('#username')).toBeFocused();
 for(const id of ['username','password']){expect(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).backgroundImage)).toBe('none');const field=await page.locator('#'+id).boundingBox(),error=await page.locator('#'+id+'-error').boundingBox();expect(error!.y).toBeGreaterThanOrEqual(field!.y+field!.height);}
 await page.locator('#username').fill('invalid@example.test');await page.locator('#kc-login').click();expect(posts).toBe(0);await expect(page.locator('#password')).toBeFocused();await page.locator('#password').fill('not-a-real-password');await page.locator('#kc-login').click();await expect(page.locator('#input-error')).toBeVisible();expect(posts).toBe(1);await expect(page.locator('#kc-login')).toBeEnabled();
 const alert=await page.locator('#input-error').boundingBox(),user=await page.locator('#username').boundingBox();expect(alert!.y+alert!.height).toBeLessThan(user!.y);
 await page.screenshot({path:'test-results/auth-error-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/auth-error-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#password').fill('');await page.locator('#kc-login').click();await expect(page.locator('#password-error')).toBeVisible();await page.screenshot({path:'test-results/auth-empty-mobile.png'});await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.card-pf').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 await page.getByRole('link',{name:'Forgot Password?'}).click();await expect(page.locator('#username')).toBeVisible();
});
