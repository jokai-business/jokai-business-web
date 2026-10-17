import {test,expect} from '@playwright/test';
import {login} from './helpers';
test('shared calendar supports keyboard selection, time, escape and mobile',async({page})=>{
 await login(page,'admin@example.test');await page.goto('/notifications');await page.getByRole('button',{name:'My reminders',exact:true}).click();await page.getByRole('button',{name:'New reminder',exact:true}).click();
 await page.getByRole('button',{name:'Choose due at',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Choose a date'});await expect(dialog).toBeVisible();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await dialog.getByLabel('Reminder time').fill('15:30');await dialog.getByRole('button',{name:'Done',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.getByLabel('Remind me at',{exact:true})).toHaveValue(/T15:30$/);
 await page.getByRole('button',{name:'Choose due at',exact:true}).click();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Choose due at',exact:true})).toBeFocused();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Choose due at',exact:true}).click();await expect(dialog).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/jokai-calendar-mobile.png'});
});
