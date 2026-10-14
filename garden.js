/* Shared family garden. Chore scheduling and completion stay in the tracker. */
(function(){
'use strict';
window.homeGardenIcon=function(name){
 const key=name.replace(/(^|-)([a-z])/g,(_,dash,c)=>c.toUpperCase());
 const def=window.lucide&&lucide.icons[key];
 return def?lucide.createElement(def,{class:'app-icon',width:20,height:20,'aria-hidden':'true'}).outerHTML:'';
};
window.createHomeGarden=function(api){
 const esc=api.escape,icon=window.homeGardenIcon;
 const RELEASE='2026-10-14',key=(api.preview?'hc.preview.v5':'hc')+'.garden.v1';
 const viewKey=key+'.ui',copy=x=>JSON.parse(JSON.stringify(x));
 const rewards={cinema:{title:'Кино вдвоём',note:'Выбрать фильм и большой попкорн',icon:'clapperboard'},dinner:{title:'Любимая доставка',note:'Вечер с вкусной едой',icon:'pizza'},games:{title:'Вечер настолок',note:'Чай и любимая игра',icon:'dices'}};
 let shared,baseline,ref=null,ready=api.preview,pending=false,currentView='today',content=null,sheet=null,toast='',noticeTimer;
 let local={motion:true,largeText:false};try{local={...local,...JSON.parse(localStorage.getItem(viewKey)||'{}')};}catch(e){}
 let state={world:null};
 const button=(a,label,cls='',attrs='')=>'<button type="button" data-garden="'+a+'" class="'+cls+'" '+attrs+'>'+label+'</button>';
 const paintIcons=()=>{};
 const canAnimate=()=>local.motion&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
  const species={daisy:{name:'Ромашки',row:0,note:'Солнечный цветник',harvest:1},lavender:{name:'Лаванда',row:1,note:'Тихий ароматный уголок',harvest:1},apple:{name:'Яблоня',row:2,note:'Маленькое дерево с плодами',harvest:2}};
 const regions={meadow:{name:'Цветочная поляна',x:670,y:750,cost:0},pond:{name:'У пруда',x:1080,y:930,cost:15},orchard:{name:'Плодовый сад',x:550,y:1230,cost:25}};
 const plots=[
  {id:'a',x:570,y:550,region:'meadow'},{id:'b',x:760,y:560,region:'meadow'},
  {id:'c',x:490,y:740,region:'meadow'},{id:'d',x:700,y:760,region:'meadow'},
  {id:'e',x:900,y:730,region:'meadow'},{id:'f',x:650,y:950,region:'meadow'},
  {id:'g',x:420,y:945,region:'meadow'},{id:'h',x:860,y:950,region:'meadow'},
  {id:'i',x:1070,y:815,region:'pond'},{id:'j',x:1130,y:985,region:'pond'},
  {id:'k',x:975,y:1070,region:'pond'},{id:'l',x:470,y:1170,region:'orchard'},
  {id:'m',x:675,y:1210,region:'orchard'},{id:'n',x:545,y:1340,region:'orchard'}
 ];
 function makeGarden(){return {seeds:4,spent:0,bonus:0,planted:0,harvests:0,questReward:false,unlocked:['meadow'],mode:'look',selected:null,selectedZone:null,moving:null,guide:true,camera:{x:690,y:790,z:.54},plants:{a:{kind:'daisy',stage:2,collected:true},b:{kind:'lavender',stage:1,collected:false},c:{kind:'lavender',stage:2,collected:false},d:{kind:'daisy',stage:0,collected:false},e:{kind:'apple',stage:1,collected:false},h:{kind:'daisy',stage:2,collected:true}}};}
 let worldGrowth={},worldTimers={},worldFrame=0,worldResize=null,worldSuppress=0,worldFeedbackTimer=0;
 const gardenState=()=>state.world;
 const wgButton=(action,label,cls='',attrs='')=>'<button type="button" class="'+cls+' cursor-interaction" data-wg="'+action+'" '+attrs+'>'+label+'</button>';
 function worldSprite(kind,level=2){return '<span class="wg-sprite" style="background-position:'+(level*50)+'% '+(species[kind].row*50)+'%" role="img" aria-label="'+species[kind].name+' · '+['росток','молодое растение','взрослое растение'][level]+'"></span>';}
 function worldGame(){return '<section class="wg-game" aria-label="Наш сад — игровая территория"><div class="wg-viewport" aria-label="Карта сада. Перемещайте пальцем, приближайте двумя пальцами или кнопками."><div class="wg-terrain"><span class="wg-pond-ring"></span><span class="wg-pond-ring"></span><div class="wg-plants"></div><div class="wg-regions"></div></div></div><div class="wg-hud">'+button('wg-back',icon('arrow-left')+'<span>К делам</span>','wg-back','aria-label="К делам"')+'<div class="wg-title"><h1>Наш сад</h1><p>'+api.getState().people.map(p=>esc(p.name)).join(' и ')+'</p></div>'+button('settings',icon('sliders-horizontal'),'wg-round','aria-label="Настройки игры"')+'</div><div class="wg-resources"></div><div class="wg-quest-slot"></div><div class="wg-zoom">'+wgButton('zoom-in',icon('plus'),'wg-round','aria-label="Приблизить сад"')+wgButton('zoom-out',icon('minus'),'wg-round','aria-label="Отдалить сад"')+wgButton('home',icon('locate-fixed'),'wg-round','aria-label="Вернуться на поляну"')+'</div>'+wgButton('map','<span class="wg-map-window"></span>','wg-map-mini','aria-label="Открыть карту всего сада"')+'<div class="wg-tip">'+icon('hand')+'Потяните сад пальцем</div><div class="wg-dock"><div class="wg-context-slot"></div><div class="wg-tools">'+[['plant-mode','sprout','Посадить','plant'],['water-mode','droplets','Полить','water'],['move-mode','move','Перенести','move'],['tasks','list-checks','Дела','tasks']].map(([a,i,t,m])=>wgButton(a,icon(i)+'<span>'+t+'</span>','','data-mode="'+m+'" aria-pressed="false"')).join('')+'</div></div><div class="wg-announcement" role="status" aria-live="polite"></div></section>';}
 function goTracker(){sheet=null;save();api.navigate('today');}
 function worldPlots(){const w=gardenState();return plots.filter(p=>w.unlocked.includes(p.region)).map(p=>{
  const v=w.plants[p.id],g=worldGrowth[p.id],selected=w.selected===p.id;
  const art=v?'<span class="wg-sway" style="--phase:-'+(p.x%7)+'s">'+(g?'<span class="wg-growing-old">'+worldSprite(v.kind,g.from)+'</span><span class="wg-growing-new">'+worldSprite(v.kind,v.stage)+'</span>':worldSprite(v.kind,v.stage))+'</span>':'';
  const effect=g?'<span class="wg-water-cloud">'+icon('cloud-rain')+'</span>'+Array.from({length:16},(_,i)=>'<span class="wg-water-drop" style="--dx:'+(i%5*11-24)+'px;--delay:'+(i*.045)+'s"></span>').join('')+Array.from({length:9},(_,i)=>'<span class="wg-spark" style="--sx:'+Math.round(Math.cos(i*2.3)*80)+'px;--sy:'+Math.round(-40-Math.abs(Math.sin(i*2.3))*90)+'px;--delay:'+(i*.055+.6)+'s"></span>').join(''):'';
  return wgButton('plot',art+(!v?'<span class="wg-add">'+icon('plus')+'</span>':v.stage===2&&!v.collected?'<span class="wg-ready">'+icon('sprout')+'</span>':'')+effect,'wg-plot'+(!v?' is-empty':v.kind==='apple'?' wg-tree':'')+(selected?' is-selected':'')+(g?' is-watered':''),'data-id="'+p.id+'" aria-label="'+(v?species[v.kind].name+', '+['росток','нужен полив','выросло'][v.stage]:'Свободный участок')+'" aria-pressed="'+selected+'" style="left:'+p.x+'px;top:'+p.y+'px;z-index:'+Math.round(p.y/10)+'"');
 }).join('');}
 function worldRegions(){const w=gardenState();return Object.entries(regions).filter(([k])=>!w.unlocked.includes(k)).map(([k,r])=>'<div class="wg-zone-mist" style="left:'+(r.x-210)+'px;top:'+(r.y-125)+'px;width:420px;height:290px"></div>'+wgButton('region',icon('lock-keyhole')+'<span>'+r.name+'<small>Открыть · '+r.cost+' капель</small></span>','wg-zone','data-id="'+k+'" style="left:'+r.x+'px;top:'+r.y+'px;z-index:160"')).join('');}
 function worldContext(){const w=gardenState(),p=w.selected&&w.plants[w.selected];let title='Сад, который создаёте вы',sub='14 мест для цветов и деревьев',action='plant-mode',label=icon('sprout')+'Посадить растение';
  if(w.selectedZone){const r=regions[w.selectedZone];title=r.name;sub='Ещё три места для новых растений';action='unlock';label=icon('key-round')+'Открыть · '+r.cost+' капель';}
  else if(w.mode==='move'){title=w.moving?'Выберите новое место':'Какое растение перенесём?';sub=w.moving?'Коснитесь свободного участка':'Коснитесь растения в саду';action='cancel-mode';label=icon('x')+'Завершить перестановку';}
  else if(p){title=species[p.kind].name;sub=['Росток · два полива до цветения','Ещё один полив — и расцветёт',p.collected?'Растёт в вашем семейном саду':'Можно собрать семена'][p.stage];if(p.kind==='apple')sub=['Саженец · два полива до плодов','Ещё один полив — и появятся яблоки',p.collected?'Растёт в вашем семейном саду':'Первые яблоки уже созрели'][p.stage];
   action=p.stage<2?'water':p.collected?'plant-mode':'collect';label=worldGrowth[w.selected]?icon('droplets')+'Поливаем…':p.stage<2?icon('droplets')+'Полить · 10 капель':p.collected?icon('sprout')+'Посадить ещё':icon('sprout')+'Собрать семена · +'+species[p.kind].harvest;
  }else if(w.mode==='plant'){title='Где посадим новое растение?';sub='Выберите свободный участок со знаком +';action='catalog';label=icon('leaf')+'Выбрать растение';}
  else if(w.mode==='water'){title='Кому нужен полив?';sub='Коснитесь молодого растения';action='tasks';label=icon('circle-check')+'Получить капли за дела';}
  return '<section class="wg-context"><div class="wg-context-head"><div><h2>'+title+'</h2><p>'+sub+'</p></div>'+wgButton('journal',icon('book-open'),'wg-round','aria-label="История и достижения сада"')+'</div>'+wgButton(action,label,'hg-primary','aria-disabled="'+!!(w.selected&&worldGrowth[w.selected])+'"')+'</section>';
 }
 function refreshWorld(redraw=true){const v=content.querySelector('.wg-game');if(!v)return;const w=gardenState();
  if(redraw){v.querySelector('.wg-plants').innerHTML=worldPlots();v.querySelector('.wg-regions').innerHTML=worldRegions();}
  v.querySelector('.wg-resources').innerHTML=wgButton('tasks',icon('droplets')+'<b class="gd-inline-wallet">'+wallet()+'</b><span>капель</span>','wg-resource','aria-label="Капли: '+wallet()+'. Открыть домашние дела"')+wgButton('catalog',icon('sprout')+'<b>'+w.seeds+'</b>','wg-resource','aria-label="Семян: '+w.seeds+'. Выбрать растение"');
  v.querySelector('.wg-quest-slot').innerHTML=wgButton('journal',icon(w.planted>=3?'circle-check':'flower-2')+'<span><b>'+(w.planted>=3?'Полянка оживает':'Посадим маленький сад')+'</b>'+Math.min(w.planted,3)+' из 3 новых растений</span>','wg-quest');
  v.querySelector('.wg-context-slot').innerHTML=worldContext();v.querySelector('.wg-tip').hidden=!w.guide;
  v.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===w.mode));paintIcons();paintWorldCamera();
 }
 function cameraBounds(){const v=content.querySelector('.wg-viewport');return v?{width:v.clientWidth,height:v.clientHeight}:null;}
 function clampCamera(){const b=cameraBounds();if(!b)return;const c=gardenState().camera;c.z=Math.max(Math.max(b.width,b.height)/1600,Math.min(1.25,c.z));const hx=b.width/(2*c.z),hy=b.height/(2*c.z);c.x=Math.max(hx,Math.min(1600-hx,c.x));c.y=Math.max(hy,Math.min(1600-hy,c.y));}
 function paintWorldCamera(travel=false){const v=content.querySelector('.wg-viewport');if(!v)return;clampCamera();const c=gardenState().camera,b=cameraBounds(),terrain=v.querySelector('.wg-terrain');terrain.classList.toggle('is-traveling',travel&&canAnimate());terrain.style.transform='translate('+(b.width/2-c.x*c.z)+'px,'+(b.height/2-c.y*c.z)+'px) scale('+c.z+')';const m=content.querySelector('.wg-map-window');if(m){m.style.left=(c.x-b.width/(2*c.z))/16+'%';m.style.top=(c.y-b.height/(2*c.z))/16+'%';m.style.width=b.width/c.z/16+'%';m.style.height=b.height/c.z/16+'%';}}
 function travelWorld(x,y,z){const w=gardenState();w.camera.x=x;w.camera.y=y;if(z)w.camera.z=z;w.guide=false;paintWorldCamera(true);const tip=content.querySelector('.wg-tip');if(tip)tip.hidden=true;save();}
 function worldFeedback(text){const target=content.querySelector('.wg-announcement');if(!target)return;target.innerHTML='<span class="wg-feedback">'+text+'</span>';clearTimeout(worldFeedbackTimer);worldFeedbackTimer=setTimeout(()=>{target.innerHTML='';},2200);}
 function waterWorld(id){if(!canMutate())return;const w=gardenState(),p=w.plants[id];if(!p||p.stage>=2||worldGrowth[id])return;if(wallet()<10){goTracker();notice('Выполните дело, чтобы получить капли для полива.');return;}w.spent+=10;w.selected=id;worldGrowth[id]={from:p.stage};p.stage++;refreshWorld();save();worldTimers[id]=setTimeout(()=>{delete worldGrowth[id];refreshWorld();worldFeedback(p.stage===2?(p.kind==='apple'?'Первые яблоки!':p.kind==='lavender'?'Лаванда расцвела':'Ромашки расцвели'):'Растение стало больше');save();},canAnimate()?1900:30);}
 function worldAction(action,el){if(['plant','water','collect','unlock'].includes(action)&&!canMutate())return;if(action==='plot'&&(state.world.mode==='move'||state.world.mode==='water')&&!canMutate())return;const w=gardenState(),id=el&&el.dataset.id;if(el&&el.getAttribute('aria-disabled')==='true')return;
  if(action==='zoom-in'||action==='zoom-out'){w.camera.z*=action==='zoom-in'?1.22:1/1.22;paintWorldCamera(true);save();return;}
  if(action==='home'){travelWorld(regions.meadow.x,regions.meadow.y,.54);return;}
  if(action==='map'){sheet={type:'wg-map'};render();return;}
  if(action==='journal'){sheet={type:'wg-journal'};render();return;}
  if(action==='tasks'){goTracker();return;}
  if(action==='catalog'){if(!w.selected||w.plants[w.selected])w.selected=plots.find(p=>w.unlocked.includes(p.region)&&!w.plants[p.id])?.id||null;if(!w.selected){worldFeedback('Откройте новый уголок сада');return;}sheet={type:'wg-seeds'};render();return;}
  if(action==='plant-mode'||action==='water-mode'||action==='move-mode'){w.mode=action.split('-')[0];w.selected=null;w.selectedZone=null;w.moving=null;refreshWorld();save();return;}
  if(action==='cancel-mode'){w.mode='look';w.moving=null;w.selected=null;refreshWorld();save();return;}
  if(action==='goto'||action==='region'){const key=id||el.dataset.region;sheet=null;w.selected=null;w.mode='look';w.selectedZone=w.unlocked.includes(key)?null:key;render();travelWorld(regions[key].x,regions[key].y,.72);return;}
  if(action==='unlock'){const key=w.selectedZone;if(!key||w.unlocked.includes(key))return;const r=regions[key];if(wallet()<r.cost){goTracker();return;}w.spent+=r.cost;w.unlocked.push(key);w.selectedZone=null;w.mode='plant';refreshWorld();worldFeedback('Новый уголок открыт');save();return;}
  if(action==='plant'){if(w.seeds<1||!w.selected||w.plants[w.selected]||!species[id])return;w.plants[w.selected]={kind:id,stage:0,collected:false};w.seeds--;w.planted++;if(w.planted>=3&&!w.questReward){w.questReward=true;w.seeds++;}const q=plots.find(p=>p.id===w.selected);sheet=null;w.mode='look';render();travelWorld(q.x,q.y-90,Math.max(w.camera.z,.72));worldFeedback(w.planted===3?'Полянка ожила · +1 семя':'Новое растение в вашем саду');const node=content.querySelector('[data-wg="plot"][data-id="'+w.selected+'"] .wg-sway');if(node&&canAnimate())node.animate([{opacity:0,transform:'scale(.2)'},{opacity:1,transform:'scale(1.12)',offset:.7},{opacity:1,transform:'scale(1)'}],{duration:750,easing:'ease-out'});save();return;}
  if(action==='water'){waterWorld(w.selected);return;}
  if(action==='collect'){const p=w.plants[w.selected];if(!p||p.stage!==2||p.collected)return;p.collected=true;w.seeds+=species[p.kind].harvest;w.harvests++;refreshWorld();worldFeedback('+'+species[p.kind].harvest+(species[p.kind].harvest===1?' семя':' семени')+' для новых растений');save();return;}
  if(action==='plot'){
   const p=plots.find(p=>p.id===id);if(!p||!w.unlocked.includes(p.region))return;w.selectedZone=null;
   if(w.mode==='move'){if(!w.moving){if(!w.plants[id]){worldFeedback('Сначала выберите растение');return;}w.moving=id;w.selected=id;}
    else if(!w.plants[id]){const from=plots.find(p=>p.id===w.moving),moving=w.plants[w.moving];if(worldGrowth[w.moving])return;delete w.plants[w.moving];w.plants[id]=moving;w.moving=null;w.selected=id;w.mode='look';refreshWorld();const node=content.querySelector('[data-wg="plot"][data-id="'+id+'"]');if(node&&canAnimate())node.animate([{translate:(from.x-p.x)+'px '+(from.y-p.y)+'px'},{translate:'0px 0px'}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'});worldFeedback('На новом месте');save();return;}
    else {w.moving=id;w.selected=id;}
   }else if(!w.plants[id]){w.selected=id;sheet={type:'wg-seeds'};render();save();return;}
   else {w.selected=id;if(w.mode==='water'&&w.plants[id].stage<2){waterWorld(id);return;}}
   refreshWorld();const node=content.querySelector('[data-wg="plot"][data-id="'+id+'"] .wg-sway');if(node&&canAnimate())node.animate([{transform:'scale(1)'},{transform:'scale(1.08) rotate(-2deg)',offset:.45},{transform:'scale(1)'}],{duration:500,easing:'ease-out'});save();return;
  }
 }
 function worldSheet(){const w=gardenState();
  if(sheet.type==='wg-seeds')return '<h2 id="hg-sheet-title">Что посадим?</h2><p>Выберите растение для свободного участка.</p><div class="wg-catalog">'+Object.entries(species).map(([k,p])=>wgButton('plant','<span class="wg-seed-art">'+worldSprite(k)+'</span><span><b>'+p.name+'</b><small>'+p.note+'<br>1 семя · 2 полива</small></span>'+icon('chevron-right'),'wg-seed','data-id="'+k+'" '+(w.seeds<1?'disabled':''))).join('')+'</div><p class="wg-modal-info">'+icon('sprout')+' В запасе '+w.seeds+' семян. Новые можно собрать с выросших растений.</p>';
  if(sheet.type==='wg-map')return '<h2 id="hg-sheet-title">Весь наш сад</h2><p>Выберите уголок, чтобы переместиться.</p><div class="wg-overview">'+plots.filter(p=>w.plants[p.id]).map(p=>'<span class="wg-overview-plant" style="left:'+(p.x/16)+'%;top:'+(p.y/16)+'%">'+worldSprite(w.plants[p.id].kind,w.plants[p.id].stage)+'</span>').join('')+Object.entries(regions).map(([k,r])=>wgButton('goto',icon(w.unlocked.includes(k)?'map-pin':'lock-keyhole')+' '+r.name,'','data-region="'+k+'"')).join('')+'</div><p class="wg-map-note">'+w.unlocked.length+' из 3 уголков открыто · 14 мест для посадки</p>';
  return '<h2 id="hg-sheet-title">История нашего сада</h2><p>Он растёт благодаря вам обоим.</p><div class="wg-collection-art">'+Object.keys(species).map(k=>worldSprite(k)).join('')+'</div><ul class="hg-checklist"><li>'+icon('sprout')+'<div>Первые посадки<div class="hg-small">'+w.planted+' новых растений · '+(w.planted>=3?'Бонусное семя получено':'Посадите 3 растения и получите семя')+'</div></div></li><li>'+icon('map')+'<div>Новые уголки<div class="hg-small">'+w.unlocked.length+' из 3 открыто</div></div></li><li>'+icon('heart')+'<div>Забота становится видимой<div class="hg-small">'+Object.keys(w.plants).length+' растений в вашем саду</div></div></li></ul>'+button('close','Вернуться в сад','hg-primary hg-full','style="margin-top:16px"');
 }
 function setupWorld(){if(worldResize){worldResize.disconnect();worldResize=null;}const v=content.querySelector('.wg-viewport');if(!v)return;refreshWorld();const points=new Map();let drag=null,pinch=null,dragged=false,multi=false,target=null;
  const local=(p)=>{const r=v.getBoundingClientRect();return {x:p.x-r.left,y:p.y-r.top};};
  const pinchStart=()=>{const p=[...points.values()],a=local(p[0]),b=local(p[1]),c=gardenState().camera;const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),z:c.z,anchorX:c.x+(mx-v.clientWidth/2)/c.z,anchorY:c.y+(my-v.clientHeight/2)/c.z};};
  v.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});v.setPointerCapture(e.pointerId);if(points.size===1){target=e.target.closest('[data-wg]');drag={x:e.clientX,y:e.clientY,cx:gardenState().camera.x,cy:gardenState().camera.y};dragged=false;multi=false;}else{multi=true;dragged=true;pinchStart();}v.classList.add('is-dragging');});
  v.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});const c=gardenState().camera;if(points.size>=2&&pinch){const p=[...points.values()],a=local(p[0]),b=local(p[1]),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const z=Math.max(Math.max(v.clientWidth,v.clientHeight)/1600,Math.min(1.25,pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));c.z=z;c.x=pinch.anchorX-(mx-v.clientWidth/2)/z;c.y=pinch.anchorY-(my-v.clientHeight/2)/z;}
   else if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6)dragged=true;c.x=drag.cx-dx/c.z;c.y=drag.cy-dy/c.z;}if(dragged){gardenState().guide=false;const tip=content.querySelector('.wg-tip');if(tip)tip.hidden=true;}cancelAnimationFrame(worldFrame);worldFrame=requestAnimationFrame(()=>paintWorldCamera());});
  const finish=e=>{if(!points.has(e.pointerId))return;points.delete(e.pointerId);worldSuppress=performance.now()+400;if(points.size){const p=[...points.values()][0];drag={x:p.x,y:p.y,cx:gardenState().camera.x,cy:gardenState().camera.y};pinch=null;return;}v.classList.remove('is-dragging');if(!dragged&&!multi&&e.type!=='pointercancel'){if(target)worldAction(target.dataset.wg,target);else{const r=v.getBoundingClientRect(),c=gardenState().camera,x=c.x+(e.clientX-r.left-v.clientWidth/2)/c.z,y=c.y+(e.clientY-r.top-v.clientHeight/2)/c.z;const near=plots.filter(p=>gardenState().unlocked.includes(p.region)&&gardenState().plants[p.id]).map(p=>({p,d:Math.hypot((p.x-x),((p.y-90)-y))})).sort((a,b)=>a.d-b.d)[0];if(near&&near.d<105)worldAction('plot',{dataset:{id:near.p.id},getAttribute:()=>null});}}drag=null;pinch=null;paintWorldCamera();save();};
  v.addEventListener('pointerup',finish);v.addEventListener('pointercancel',finish);
  v.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();gardenState().camera.z*=e.deltaY<0?1.08:1/1.08;paintWorldCamera();save();},{passive:false});
  worldResize=new ResizeObserver(()=>paintWorldCamera());worldResize.observe(v);
 }

 const worldKeys=['seeds','spent','bonus','planted','harvests','questReward','unlocked','plants'];
 function worldData(w){return Object.fromEntries(worldKeys.map(k=>[k,copy(w[k])]));}
 function empty(){return {version:1,revision:0,world:worldData(makeGarden()),thanks:{},rewards:{},celebrations:{}};}
 function normalize(value){
  const d=empty();if(!value||value.version!==1)return d;
  d.revision=Math.max(0,Number(value.revision)||0);
  d.world={...d.world,...value.world};
  d.world.unlocked=Array.from(new Set(Array.isArray(d.world.unlocked)?d.world.unlocked:Object.values(d.world.unlocked||{meadow:'meadow'}))).filter(k=>regions[k]);
  if(!d.world.unlocked.includes('meadow'))d.world.unlocked.unshift('meadow');
  d.world.plants=d.world.plants||{};
  for(const [id,p] of Object.entries(d.world.plants)){if(!plots.some(q=>q.id===id)||!p||!species[p.kind])delete d.world.plants[id];else{p.stage=Math.max(0,Math.min(2,Number(p.stage)||0));p.collected=!!p.collected;}}
  for(const k of ['seeds','spent','bonus','planted','harvests'])d.world[k]=Math.max(0,Number(d.world[k])||0);
  for(const k of ['thanks','rewards','celebrations'])d[k]=value[k]||{};
  return d;
 }
 function receive(value){
  shared=normalize(value);baseline=copy(shared);
  state.world={...makeGarden(),...state.world,...copy(shared.world)};
  try{localStorage.setItem(key,JSON.stringify(shared));}catch(e){}
 }
 let cached=null;try{cached=JSON.parse(localStorage.getItem(key)||'null');}catch(e){}
 receive(cached);if(local.camera)state.world.camera=local.camera;
 function entries(){
  const s=api.getState(),out=[],dates=new Set([...Object.keys(s.done),...Object.keys(s.meals),...Object.keys(s.debt)]);
  for(const day of Array.from(dates).sort()){
   if(day<RELEASE||day>api.today())continue;
   const assign=api.assign(day).assign,ids=new Set([...Object.keys(s.done[day]||{}),...Object.keys(s.meals[day]||{}),...Object.keys(s.debt[day]||{})]);
   for(const id of ids){
    const c=api.chore(id);if(!c||api.isSkipped(day,id))continue;
    const debt=s.debt[day]&&s.debt[day][id];
    let units=api.isCook(c)?api.cooked(day,id):Math.min(api.target(c,day),api.units(day,id));
    if(debt&&debt.st==='done')units=Math.max(units,1);
    if(units<=0)continue;
    out.push({day,id,title:c.title,person:debt&&debt.st==='done'?debt.by:assign[id],units,points:c.points||1,help:!!(debt&&debt.st==='done'),drops:units*10});
   }
  }
  return out;
 }
 const earned=()=>entries().reduce((sum,e)=>sum+e.drops,0);
 const wallet=()=>Math.max(0,earned()-state.world.spent);
 function goal(){
  const days=api.week(),s=api.getState(),selected=[];
  const kitchen=s.chores.filter(c=>c.cat==='Кухня'&&!api.isCook(c));
  // One occurrence of each actual scheduled kitchen chore; never add extra chores.
  for(const c of kitchen){
   const day=days.find(d=>api.assign(d).due.some(q=>q.id===c.id));if(!day)continue;
   selected.push({day,id:c.id,title:c.title,done:!api.isSkipped(day,c.id)&&api.units(day,c.id)>=api.target(c,day),person:api.assign(day).assign[c.id]});
   if(selected.length===4)break;
  }
  return {key:api.monday(api.today()),tasks:selected,done:selected.filter(t=>t.done).length,total:selected.length};
 }
 function rhythm(){return api.week().map(day=>{const p=api.progress(api.getMe(),day,api.assign(day));return {day,done:day<=api.today()&&p.count>0&&p.countDone===p.count,rest:p.count===0};});}
 function canMutate(){
  if(pending){notice('Сохраняем изменение…');return false;}
  if(!api.preview&&(!ready||!api.connected())){notice('Подключитесь к интернету, чтобы изменить общий сад.');return false;}
  return true;
 }
 function save(){
  local.camera=state.world.camera;try{localStorage.setItem(viewKey,JSON.stringify(local));}catch(e){}
  const next={...shared,world:worldData(state.world)};
  if(JSON.stringify(next)===JSON.stringify(baseline))return;
  if(!canMutate()){receive(baseline);refresh();return;}
  const expected=baseline.revision;next.revision=expected+1;
  if(api.preview){receive(next);refreshStatus();return;}
  pending=true;refreshStatus();
  // A compare-and-swap prevents two phones spending the same resources.
  ref.transaction(value=>{const current=normalize(value);if(current.revision!==expected)return;return next;},(error,committed,snap)=>{
   pending=false;
   receive(!error&&snap?snap.val():baseline);
   if(error)notice('Не удалось сохранить сад. Изменение отменено — попробуйте ещё раз.');
   else if(!committed)notice('Сад изменился на другом телефоне. Обновили его — повторите действие.');
   refresh();
  },false);
 }
 function connect(db){
  if(api.preview)return;
  ref=db.ref('rooms/'+api.room+'/garden');
  ref.on('value',snap=>{ready=true;if(!pending){receive(snap.val());refresh();}},()=>{ready=false;notice('Не удалось загрузить общий сад. Проверьте подключение.');});
 }
 function notice(message){
  let el=document.getElementById('garden-notice');if(!el){el=document.createElement('div');el.id='garden-notice';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el);}
  el.textContent=message;el.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.hidden=true;},4200);
 }
 function refreshStatus(){
  const el=document.querySelector('.garden-save-status');if(el)el.textContent=api.preview?'Предпросмотр':pending?'Сохраняем сад…':ready?'Общий сад семьи':'Подключаем сад…';
  const host=document.getElementById('home-game-preview');if(host)host.setAttribute('aria-busy',String(pending));
 }
 function refresh(){
  if(currentView==='garden'){if(content&&content.isConnected){refreshWorld();refreshStatus();}}
  else api.redraw();
 }
 function render(){
  if(currentView==='garden'&&content){content.innerHTML=worldGame()+'<span class="garden-save-status"></span>';setupWorld();refreshStatus();}
  renderDialog();
 }
 function goalLink(){const g=goal();return button('goal',icon('flag')+'<span>Цель недели · уютная кухня</span><b>'+(g.total?g.done+' из '+g.total:'Выбрать дела')+'</b>'+icon('chevron-right'),'family-goal');}
 function thankKey(e){return [e.day,encodeURIComponent(e.id).replaceAll('.','%2E'),api.getMe()].join('_');}
 function thanksRow(){
  const e=entries().filter(e=>e.person&&e.person!==api.getMe()&&e.day===api.today()).at(-1);if(!e)return '';
  const sent=!!shared.thanks[thankKey(e)],person=api.person(e.person);if(!person)return '';
  return '<section class="family-thanks"><span class="avatar">'+esc(person.name.charAt(0))+'</span><div><p>'+esc(person.name)+' · '+esc(e.title)+'</p><small>'+ (sent?'Ваша благодарность отправлена':'Выполнено сегодня')+'</small></div>'+button('thank',icon(sent?'check':'heart')+(sent?'Спасибо!':'Спасибо'),'garden-secondary','aria-pressed="'+sent+'"')+'</section>';
 }
 function meter(value,max,label){return '<div class="garden-meter" role="progressbar" aria-label="'+label+'" aria-valuenow="'+value+'" aria-valuemin="0" aria-valuemax="'+max+'"><span style="width:'+Math.min(100,value/max*100)+'%"></span></div>';}
 function rhythmHTML(){const r=rhythm(),n=r.filter(d=>d.done).length;return '<section class="garden-panel"><div class="garden-line"><h2>В своём ритме</h2><span>'+n+' / 4 дня</span></div><div class="rhythm-days">'+r.map(d=>'<span class="'+(d.done?'achieved':'')+'" aria-label="'+d.day+(d.done?' — план выполнен':d.rest?' — отдых':'')+'">'+icon(d.done?'check':d.rest?'minus':'circle')+'<small>'+['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(d.day+'T12:00:00').getDay()]+'</small></span>').join('')+'</div><p>Четыре дня с завершённым планом за неделю. Дни отдыха не обнуляют прогресс.</p></section>';}
 function successHTML(){
  const me=api.getMe(),p=api.person(me),own=entries().filter(e=>e.person===me),xp=own.reduce((s,e)=>s+e.units*10,0),r=rhythm();
  const badges=[['mountain','Большое дело','Завершите задачу с усилием от 3',own.some(e=>e.points>=3)],['hand-heart','Плечом к плечу','Выручите семью с отложенным делом',own.some(e=>e.help)],['sun','День в своём ритме','Завершите свой план на день',r.some(d=>d.done)],['sprout','Первый росток','Посадите растение в общем саду',state.world.planted>0]];
  const thanks=Object.values(shared.thanks).filter(t=>t.to===me).sort((a,b)=>b.day.localeCompare(a.day)).slice(0,5);
  return '<div class="garden-success"><section class="garden-panel garden-profile"><span class="avatar">'+esc(p.name.charAt(0))+'</span><div><h2>'+esc(p.name)+'</h2><p>Уровень '+(Math.floor(xp/100)+1)+' · '+xp%100+' / 100 опыта</p>'+meter(xp%100,100,'Личный опыт')+'</div></section>'+rhythmHTML()+'<section class="garden-panel"><h2>Достижения</h2>'+badges.map(b=>'<div class="garden-achievement '+(b[3]?'achieved':'')+'"><span>'+icon(b[0])+'</span><div><h3>'+b[1]+'</h3><p>'+b[2]+'</p><small>'+(b[3]?'Уже ваше':'Впереди')+'</small></div></div>').join('')+'</section>'+goalLink()+'<section class="garden-panel"><h2>Спасибо от близкого</h2>'+(thanks.length?thanks.map(t=>'<p class="received-thanks">'+icon('heart')+' '+esc(api.person(t.from)?.name||'Семья')+': спасибо за «'+esc(t.title)+'»<small>'+esc(t.day)+'</small></p>').join(''):'<p>Здесь появятся благодарности за выполненные дела.</p>')+'</section>'+button('stats',icon('chart-no-axes-combined')+'Подробная статистика','garden-secondary garden-wide')+'</div>';
 }
 function goalHTML(){
  const g=goal(),r=rewards[shared.rewards[g.key]]||rewards.cinema,done=g.total>0&&g.done===g.total;
  return '<h2 id="hg-sheet-title">Уютная кухня</h2><p>Общая цель на эту неделю · '+g.done+' из '+g.total+'</p>'+(g.total?meter(g.done,g.total,'Цель недели'):'<p>В плане недели пока нет кухонных дел. Добавить их можно в настройках дома.</p>')+'<ul class="hg-checklist">'+g.tasks.map(t=>'<li>'+icon(t.done?'circle-check':'circle')+'<div>'+esc(t.title)+'<div class="hg-small">'+esc(api.person(t.person)?.name||'Семья')+' · '+t.day+'</div></div></li>').join('')+'</ul><p class="goal-footnote">Учитываются дела из вашего расписания. Отмечайте их в трекере.</p><div class="garden-reward">'+icon(r.icon)+'<div><h3>'+r.title+'</h3><p>'+r.note+'</p></div></div>'+button('reward','Выбрать награду','garden-secondary garden-wide')+(done?button('celebrate',shared.celebrations[g.key]?'Вы отпраздновали':icon('sparkles')+'Мы отпраздновали','hg-primary hg-full','style="margin-top:10px" '+(shared.celebrations[g.key]?'disabled':'')):'');
 }
 function renderDialog(){
  document.getElementById('garden-dialog')?.remove();if(!sheet)return;
  let host=document.getElementById('home-game-preview');if(!host){host=document.createElement('div');host.id='home-game-preview';host.className='garden-overlay';api.root.appendChild(host);}
  let body='';
  if(sheet.type.startsWith('wg-'))body=worldSheet();
  else if(sheet.type==='goal')body=goalHTML();
  else if(sheet.type==='reward')body='<h2 id="hg-sheet-title">Ваша общая награда</h2><p>Чем будет приятно отметить цель?</p><div class="garden-rewards">'+Object.entries(rewards).map(([id,r])=>button('select-reward',icon(r.icon)+'<span><b>'+r.title+'</b><small>'+r.note+'</small></span>','garden-secondary','data-id="'+id+'"')).join('')+'</div>';
  else body='<h2 id="hg-sheet-title">Настройки сада</h2><label class="garden-setting"><span>Анимации</span><input type="checkbox" data-garden-setting="motion" '+(local.motion?'checked':'')+'></label><label class="garden-setting"><span>Крупный текст</span><input type="checkbox" data-garden-setting="largeText" '+(local.largeText?'checked':'')+'></label><p>Каждое выполнение дела даёт 10 капель и 10 опыта. Полив стоит 10 капель. Начальные растения и 4 семени — подарок для вашего сада.</p><p class="goal-footnote">Отмена отметки уменьшает доступные капли. Уже выращенные растения остаются. Новые выполнения сначала покрывают потраченные капли.</p><p>Прогресс считается с 14 октября 2026 года.</p>';
  const dialog=document.createElement('dialog');dialog.id='garden-dialog';dialog.className='hg-sheet';dialog.setAttribute('aria-labelledby','hg-sheet-title');
  dialog.innerHTML=button('close',icon('x'),'hg-sheet-close','aria-label="Закрыть"')+body;
  dialog.addEventListener('cancel',()=>{sheet=null;});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){sheet=null;dialog.close();}}});
  host.appendChild(dialog);dialog.showModal();
 }
 function mount(view){
  currentView=view;
  if(view!=='garden'&&worldResize){worldResize.disconnect();worldResize=null;}
  const host=document.getElementById('home-game-preview');
  if(view==='garden'){
   host.innerHTML='<div class="hg-app wg-full '+(canAnimate()?'hg-motion':'')+'"><div class="hg-main"></div></div>';
   host.classList.toggle('garden-large',local.largeText);content=host.querySelector('.hg-main');render();
  }else{
   content=null;
   if(view==='success')host.innerHTML=successHTML();
   if(view==='today')api.root.querySelector('.primary-pane')?.insertAdjacentHTML('beforeend','<div class="family-extras">'+goalLink()+thanksRow()+'</div>');
   if(view==='week')api.root.querySelector('.focused-view')?.insertAdjacentHTML('afterbegin','<div class="family-week">'+rhythmHTML()+goalLink()+'</div>');
   renderDialog();
  }
 }
 function handle(action,el){
  if(action==='close'){sheet=null;document.getElementById('garden-dialog')?.close();return;}
  if(action==='wg-back'){goTracker();return;}
  if(action==='stats'){sheet=null;api.navigate('stats');return;}
  if(['goal','reward','settings'].includes(action)){sheet={type:action};renderDialog();return;}
  if(action==='thank'){
   if(!canMutate())return;
   const e=entries().filter(e=>e.person&&e.person!==api.getMe()&&e.day===api.today()).at(-1);if(!e||shared.thanks[thankKey(e)])return;
   shared.thanks[thankKey(e)]={from:api.getMe(),to:e.person,title:e.title,day:e.day};save();api.redraw();notice('Спасибо за заботу о доме!');return;
  }
  if(action==='select-reward'&&rewards[el.dataset.id]){if(!canMutate())return;shared.rewards[goal().key]=el.dataset.id;save();sheet={type:'goal'};renderDialog();return;}
  if(action==='celebrate'){const g=goal();if(!canMutate()||!g.total||g.done!==g.total||shared.celebrations[g.key])return;shared.celebrations[g.key]=true;save();renderDialog();notice('Пусть таких вечеров будет больше!');}
 }
 api.root.addEventListener('click',e=>{
  const el=e.target.closest('[data-wg],[data-garden]');if(!el)return;
  if(el.dataset.wg){if(performance.now()>worldSuppress||!el.closest('.wg-viewport'))worldAction(el.dataset.wg,el);}
  else handle(el.dataset.garden,el);
 });
 api.root.addEventListener('change',e=>{const k=e.target.dataset.gardenSetting;if(!['motion','largeText'].includes(k))return;local[k]=e.target.checked;save();if(currentView==='garden'){api.root.querySelector('.hg-app').classList.toggle('hg-motion',canAnimate());document.getElementById('home-game-preview').classList.toggle('garden-large',local.largeText);}});
 api.root.addEventListener('keydown',e=>{if(sheet||currentView!=='garden'||!e.target.closest('.wg-viewport,.wg-zoom'))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const c=state.world.camera;c.x+=e.key==='ArrowLeft'?-90:e.key==='ArrowRight'?90:0;c.y+=e.key==='ArrowUp'?-90:e.key==='ArrowDown'?90:0;paintWorldCamera(true);save();}});
 return {mount,connect,earned,onChoreChange(before){const delta=earned()-before;if(delta>0)notice('Дело выполнено · +'+delta+' капель для сада');}};
};
})();
