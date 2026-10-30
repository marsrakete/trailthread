const {chromium}=require('../node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><h1>Komoot fixture</h1><article><h2>Sample tour</h2><a href="https://www.komoot.com/tour/123">Tour</a></article></body></html>'}));
  await page.goto('https://www.komoot.com/user/123/activities');
  await page.addStyleTag({path:'C:/Projekte/trailthread/browser-extension/styles.css'});
  await page.evaluate(()=>{window.chrome={runtime:{id:'fixture',sendMessage:async()=>({}),onMessage:{addListener(){}}}};});
  await page.addScriptTag({path:'C:/Projekte/trailthread/browser-extension/content-komoot.js'});
  const panel=page.locator('.trailthread-komoot-toolbar'),toggle=panel.locator('.trailthread-komoot-toggle');
  await panel.waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await toggle.getAttribute('title'),'Trailthread aufklappen');
  assert.equal(await toggle.locator('path').getAttribute('d'),'m6 15 6-6 6 6');
  await toggle.click();
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:844});
   await toggle.click();
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert.equal(await toggle.getAttribute('title'),'Trailthread aufklappen');
   assert.equal(await toggle.locator('path').getAttribute('d'),'m6 15 6-6 6 6');
   assert.equal(await panel.locator('.trailthread-komoot-body').isVisible(),false);
   assert.equal((await panel.innerText()).trim(),'Trailthread');
   const box=await panel.boundingBox();assert(box.width<200);assert(box.height<=64);assert(box.x>=0&&box.x+box.width<=width);
   await page.screenshot({path:`C:/Projekte/threadline/test-results/trailthread-collapsed-${width}.png`});
   await toggle.press('Enter');
   assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await panel.locator('.trailthread-komoot-body').isVisible(),true);
   assert.equal(await toggle.getAttribute('title'),'Trailthread einklappen');
   assert.equal(await toggle.locator('path').getAttribute('d'),'m6 9 6 6 6-6');
   await toggle.press('Space');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   // Selection and an active export continue to render while the body stays collapsed.
   await page.evaluate(()=>{SELECTED_TOURS.set('123',{tourId:'123',name:'Sample',tourUrl:'https://www.komoot.com/tour/123'});runActive=true;activeExportMode='gpx';renderToolbar();});
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   await toggle.click();assert.equal(await panel.locator('.trailthread-komoot-cancel').isVisible(),true);
   assert.equal(await page.evaluate(()=>SELECTED_TOURS.size),1);
   await page.evaluate(()=>{runActive=false;activeExportMode=null;renderToolbar();});
  }
  assert.deepEqual(errors,[]);console.log('Browser passed: 390/1280px, click/Enter/Space, compact geometry, selection/export retention and no page errors.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
