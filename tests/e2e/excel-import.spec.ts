import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {login} from './helpers';
function workbook(template:Buffer,rows:string[][]){return execFileSync('python3',['-c',`
import sys,base64,io,zipfile,json,xml.etree.ElementTree as E
src=zipfile.ZipFile(io.BytesIO(base64.b64decode(sys.argv[1])))
ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
root=E.fromstring(src.read('xl/worksheets/sheet1.xml'));data=root.find(ns+'sheetData')
for i,row in enumerate(json.loads(sys.argv[2]),2):
 r=E.SubElement(data,ns+'row',{'r':str(i)})
 for col,val in enumerate(row):
  c=E.SubElement(r,ns+'c',{'r':chr(65+col)+str(i),'t':'inlineStr'})
  E.SubElement(E.SubElement(c,ns+'is'),ns+'t').text=val
out=io.BytesIO()
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for name in src.namelist():z.writestr(name,E.tostring(root) if name=='xl/worksheets/sheet1.xml' else src.read(name))
sys.stdout.buffer.write(out.getvalue())
`,template.toString('base64'),JSON.stringify(rows)]);}
for(const kind of ['customer','opportunity'] as const){
 test(`${kind} Excel import validates, confirms once and reloads a private report`,async({page,request,browser})=>{
 const headers=await login(page,'admin@example.test');const stamp=Date.now();
 const template=await request.get(`/api/v1/imports/${kind}/template`,{headers});expect(template.status()).toBe(200);expect(template.headers()['content-type']).toContain('spreadsheetml');
 let rows:string[][];const name=`Excel ${kind} ${stamp}`;
 if(kind==='customer')rows=[[name,`excel-${stamp}@example.test`,'00123','https://example.test','Technology']];
 else{const me=(await (await request.get('/api/v1/me',{headers})).json()).data;const customer=(await (await request.post('/api/v1/customers',{headers,data:{name:`Excel parent ${stamp}`,ownerId:me.user.id,status:'active'}})).json()).data;const stages=(await (await request.get('/api/v1/pipeline-stages',{headers})).json()).data;rows=[[customer.id,name,'100.25','USD',stages[0].name,'']];}
 const file=workbook(await template.body(),rows);const invalid=rows.map(r=>[...r]);invalid[0][kind==='customer'?1:2]='invalid';
 await page.goto(kind==='customer'?'/customers':'/opportunities');const panel=page.getByRole('region',{name:`${kind} Excel import`});await panel.getByRole('button',{name:'Import from Excel',exact:true}).click();
 await panel.getByLabel('Excel workbook').setInputFiles({name:'invalid.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook(await template.body(),invalid)});await panel.getByRole('button',{name:'Preview workbook'}).click();await expect(panel.getByText('1 row previewed · 1 row with errors',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Confirm import'})).toBeDisabled();
 await panel.getByLabel('Excel workbook').setInputFiles({name:'import.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file});await panel.getByRole('button',{name:'Preview workbook'}).click();await expect(panel.getByText('1 row previewed · 0 rows with errors',{exact:true})).toBeVisible();const id=new URL(page.url()).searchParams.get('importId')!;
 const report=(await (await request.get(`/api/v1/imports/${id}`,{headers})).json()).data;expect(report.rows[0].recordId).toBe('');expect((await request.post(`/api/v1/imports/${id}/confirm`,{headers,data:{confirmed:false}})).status()).toBe(400);
 const other=await browser.newPage({baseURL:process.env.BASE_URL||'https://localhost:8443',ignoreHTTPSErrors:true});try{const foreign=await login(other,'other@example.test');expect((await request.get(`/api/v1/imports/${id}`,{headers:foreign})).status()).toBe(404);}finally{await other.close();}
 await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Confirm import'}).click();await expect(panel.getByText('1 record imported.',{exact:true})).toBeVisible();const created=await panel.getByRole('link',{name:'View created record'}).getAttribute('href');
 const again=await request.post(`/api/v1/imports/${id}/confirm`,{headers,data:{confirmed:true}});expect(again.status()).toBe(200);expect(created).toContain((await again.json()).data.rows[0].recordId);
 expect((await request.post(`/api/v1/imports/${kind}/preview`,{headers:{...headers,'Content-Type':'application/octet-stream'},data:file})).status()).toBe(409);
 await page.reload();await expect(panel.getByText('1 record imported.',{exact:true})).toBeVisible();await panel.getByRole('link',{name:'View created record'}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();if(kind==='customer')await expect(page.getByText('00123',{exact:true})).toBeVisible();
 await page.goto(`${kind==='customer'?'/customers':'/opportunities'}?importId=${id}`);await expect(panel.getByText('1 record imported.',{exact:true})).toBeVisible();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await panel.screenshot({path:`test-results/${kind}-import-mobile.png`});
 });
}
