// Local synthetic account. Inspect intermediate frames, not only final visibility.
const assert = require('node:assert/strict'), fs = require('node:fs');
const {base,launchBrowser,closeBrowser,accountHeaders,waitForWorker}=require('./qa/runtime.cjs');
const engine=process.env.QA_BROWSER||'chromium',out=`outputs/sheet-motion-${engine}`;
fs.mkdirSync(out,{recursive:true});
(async()=>{
 await waitForWorker(); const browser=await launchBrowser({engine}); let p;
 try {
  const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:accountHeaders('sheet_motion')});
  p=await c.newPage(); await p.goto(base); await p.getByText('서버에 저장됨',{exact:true}).waitFor();
  const before=await(await c.request.get(base+'/api/state')).json(),dialog=p.getByRole('dialog');
  const open=async()=>{await p.getByRole('button',{name:'학습 설정',exact:true}).click();await dialog.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));};
  await open();const handle=p.locator('.sheet-handle'),box=await handle.boundingBox();
  await p.mouse.move(box.x+box.width/2,box.y+22);await p.mouse.down();const pressed=await handle.boundingBox();
  assert.deepEqual(pressed,box,'pressing the handle must not shift it');await p.screenshot({path:`${out}/pressed.png`});await p.mouse.up();assert.ok(await dialog.isVisible());
  await handle.tap();assert.ok(await dialog.isVisible(),'tapping a drag handle must not dismiss');
  assert.equal(await handle.evaluate(el=>el.tabIndex),-1);
  const motion=async(dy,resize=false,interfere=false)=>p.evaluate(async({dy,resize,interfere})=>{
   const el=document.querySelector('.sheet-dialog'),h=el.querySelector('[data-sheet-handle]'),rect=h.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+22;
   const base=el.getBoundingClientRect(),frames=[];
   const fire=(type,dy)=>{const e=new Event(type,{bubbles:true,cancelable:true}),t={identifier:7,clientX:x,clientY:y+dy};Object.defineProperties(e,{touches:{value:type==='touchend'?[]:[t]},changedTouches:{value:[t]}});h.dispatchEvent(e);};
   fire('touchstart',0);fire('touchmove',dy);
   const release=el.getBoundingClientRect().y-base.y;fire('touchend',dy);
   for(let i=0;i<26;i++){
    await new Promise(requestAnimationFrame);
    if(resize&&i===2)window.dispatchEvent(new Event('resize'));
    if(interfere&&i===2){for(const [type,cx] of [['touchstart',5],['touchmove',185],['touchend',185]]){const e=new Event(type,{bubbles:true,cancelable:true}),t={identifier:8,clientX:cx,clientY:el.getBoundingClientRect().top+10};Object.defineProperties(e,{touches:{value:type==='touchend'?[]:[t]},changedTouches:{value:[t]}});el.dispatchEvent(e);}}
    if(!el.isConnected)break;const b=el.getBoundingClientRect();frames.push({x:b.x-base.x,y:b.y-base.y});
   }
   return{release,frames,visible:el.isConnected,attrs:el.hasAttribute('data-sheet-motion')};
  },{dy,resize,interfere});
  const dismissed=await motion(160,false,true);
  fs.writeFileSync(`${out}/dismissed.json`,JSON.stringify(dismissed,null,2));
  assert.equal(dismissed.visible,false);assert.ok(dismissed.frames.length>=4);
  assert.ok(dismissed.frames.every(f=>Math.abs(f.x)<1&&f.y>=dismissed.release-1),'release must not jump up or sideways');
  assert.ok(dismissed.frames.every((f,i,a)=>!i||f.y>=a[i-1].y-1),'exit continues downward');
  await open();const cancelled=await motion(35);
  fs.writeFileSync(`${out}/cancelled.json`,JSON.stringify(cancelled,null,2));
  assert.ok(cancelled.visible);assert.ok(cancelled.frames[0].y>0,'short drag returns with animation');
  assert.ok(cancelled.frames.every((f,i,a)=>Math.abs(f.x)<1&&(!i||f.y<=a[i-1].y+1)));
  assert.ok(Math.abs(cancelled.frames.at(-1).y)<1);assert.equal(cancelled.attrs,false);
  const resized=await motion(160,true);assert.ok(resized.visible);assert.equal(resized.attrs,false);
  await dialog.getByRole('button',{name:'Close',exact:true}).focus();await p.keyboard.press('Enter');await dialog.waitFor({state:'hidden'});
  await open();await p.emulateMedia({reducedMotion:'reduce'});const reduced=await motion(160);assert.equal(reduced.release,0);assert.equal(reduced.visible,false);
  assert.deepEqual(await(await c.request.get(base+'/api/state')).json(),before);
  const result={passed:true,engine,checks:['handle mouse press/tap stay centered and open; original Close remains keyboard accessible','release frames move continuously downward, cancellation springs home, resize cancels dismissal','reduced motion and unchanged saved state'],dismissed,cancelled,resized};
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,engine,checks:result.checks}));
 }catch(e){if(p)await p.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await closeBrowser(browser);}
})().catch(e=>{console.error(e);process.exitCode=1;});
