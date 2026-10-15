/* In-app inbox; uses the existing read receipts, without push services. */
(function(){
'use strict';
window.createHomeNotifications=function(api){
 const N=window.HomeNotificationEngine,esc=api.escape,icon=api.icon,key=(api.preview?'hc.preview.v5':'hc')+'.notifications.'+api.room;
 let receipts={},outbox={},settings={},bannered={},items=[],ref=null,readsReady=api.preview,writing=false,retryTimer,toastTimer,dialog=null,focusBefore=null,mounted=false,lastPerson=null,limit=40,panel='inbox',openingUnread=new Set(),toastKeys=[];
 try{const c=JSON.parse(localStorage.getItem(key)||'{}');receipts=c.receipts||{};outbox=c.outbox||{};settings=c.settings||{};bannered=c.bannered||{};}catch(e){}
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify({receipts,outbox,settings,bannered}));}catch(e){}};
 const prefs=()=>N.preferences(settings[api.getMe()]);
 const button=(name,label,cls='',attrs='')=>'<button type="button" data-family-notification="'+name+'" class="'+cls+'" '+attrs+'>'+label+'</button>';
 const isRead=id=>!!receipts[api.getMe()]?.[id],fresh=e=>e.active&&e.keys.some(k=>!isRead(k)),unread=()=>items.filter(fresh);
 function recompute(){if(api.isReady())items=N.collect(api.snapshot(),prefs());}
 function bell(cls=''){return button('open',icon('bell')+'<span class="family-notification-count" hidden></span>','family-notification-bell '+cls,'aria-label="Уведомления" aria-haspopup="dialog"');}
 function paintBells(){const n=unread().length;api.root.querySelectorAll('.family-notification-bell').forEach(el=>{const badge=el.querySelector('.family-notification-count');badge.hidden=!n;badge.textContent=n>99?'99+':String(n);el.setAttribute('aria-label',n?'Уведомления, непрочитано: '+n:'Уведомления, новых нет');});}
 function ensureBell(){if(api.root.querySelector('.g2-hud'))return;const el=api.root.querySelector('.hd > .page-settings');if(el){const actions=document.createElement('div');actions.className='page-actions';el.before(actions);actions.append(el);actions.insertAdjacentHTML('afterbegin',bell());}}
 function flushReads(){
  if(api.preview||!ref||writing||!api.connected())return;
  const patch={};for(const [person,ids] of Object.entries(outbox))for(const id of Object.keys(ids))patch[person+'/'+id]=true;
  if(!Object.keys(patch).length)return;writing=true;
  ref.update(patch).then(()=>{for(const path of Object.keys(patch)){const [person,id]=path.split('/');if(outbox[person])delete outbox[person][id];}writing=false;persist();flushReads();}).catch(()=>{writing=false;clearTimeout(retryTimer);retryTimer=setTimeout(flushReads,5000);});
 }
 function markRead(keys){const me=api.getMe();receipts[me]=receipts[me]||{};outbox[me]=outbox[me]||{};let changed=false;for(const id of keys){if(isRead(id))continue;receipts[me][id]=true;if(!api.preview)outbox[me][id]=true;changed=true;}if(changed){persist();paintBells();flushReads();}}
 function timeLabel(e){if(e.legacy){const d=new Date(e.day+'T12:00:00');return Number.isNaN(d.getTime())?'Благодарность':'За дело '+d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});}return e.at>0?new Date(e.at).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):N.categories[e.type].name;}
 function heading(title,subtitle,back=false){return '<div class="family-inbox-heading">'+(back?button('back',icon('arrow-left'),'family-inbox-close family-inbox-back','aria-label="Назад к уведомлениям"'):'<span class="family-inbox-symbol">'+icon('bell')+'</span>')+'<div><h2 id="family-inbox-title">'+title+'</h2><p>'+esc(subtitle)+'</p></div>'+button('close',icon('x'),'family-inbox-close','aria-label="Закрыть уведомления"')+'</div>';}
 const targetLabel=t=>({chore:'Открыть дело',plan:'Открыть план',goals:'К семейным целям',water:'К поливу',harvest:'Собрать семена'})[t.type]||'Открыть';
 function content(){
  const person=api.person(api.getMe())?.name||'Семья';if(panel==='settings')return settingsHTML(person);
  return heading('Уведомления',person+' · ваш дом')+'<div class="family-inbox-toolbar"><p>Дела, семья и сад</p>'+button('settings',icon('sliders-horizontal')+'Настроить','family-inbox-settings')+'</div>'+(items.length?'<ol class="family-inbox-list">'+items.slice(0,limit).map(e=>{
   const isNew=e.active&&(openingUnread.has(e.id)||fresh(e));
   return '<li data-notification-type="'+e.type+'" class="family-inbox-item'+(isNew?' is-new':'')+(e.active?'':' is-resolved')+'"><span class="family-inbox-heart kind-'+e.type+'">'+icon(e.icon)+'</span><div><div class="family-inbox-message"><b>'+esc(e.heading)+'</b>'+(isNew?'<small class="family-inbox-new">Новое</small>':'')+'<span>'+esc(e.detail)+'</span></div><p>'+esc(e.title)+'</p><time'+(e.at>0&&!e.legacy?' datetime="'+new Date(e.at).toISOString()+'"':'')+'>'+esc(timeLabel(e))+'</time>'+(e.target?button('follow',esc(targetLabel(e.target))+icon('arrow-up-right'),'family-inbox-follow','data-id="'+esc(e.id)+'"'):'')+'</div></li>';
  }).join('')+'</ol>'+(items.length>limit?button('more','Показать ещё','family-inbox-more'):''):'<div class="family-inbox-empty">'+icon('bell')+'<h3>Пока всё спокойно</h3><p>Здесь появятся благодарности, изменения ваших дел и напоминания о доме.</p></div>');
 }
 function settingsHTML(person){const p=prefs();return heading('Настройки',person+' · уведомления',true)+'<p class="family-settings-intro">Баннеры появляются только в открытом приложении. Эти настройки сохраняются для вас на этом устройстве.</p><div class="family-notification-options">'+Object.entries(N.categories).map(([id,c])=>'<label class="family-notification-option"><span class="family-option-label">'+icon(c.icon)+'<span><b>'+c.name+'</b><small>'+c.note+'</small></span></span><select data-notification-mode="'+id+'" aria-label="'+c.name+'">'+[['banner','Баннер и история'],['history','Только история'],['off','Выключено']].map(([value,label])=>'<option value="'+value+'"'+(p.modes[id]===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label>').join('')+'</div><div class="family-notification-schedule"><label><span>Показывать план дня после</span><input type="time" data-notification-pref="planAt" value="'+p.planAt+'" aria-label="Время плана дня"></label><p>Если приложение закрыто, план появится при следующем открытии. Выполненные дела в него не попадут.</p><label class="family-quiet-toggle"><span>Тихие часы</span><input type="checkbox" data-notification-pref="quiet"'+(p.quiet?' checked':'')+'></label><div class="family-quiet-times"><label>С <input type="time" data-notification-pref="quietStart" value="'+p.quietStart+'" aria-label="Начало тихих часов"></label><label>До <input type="time" data-notification-pref="quietEnd" value="'+p.quietEnd+'" aria-label="Конец тихих часов"></label></div><p>События остаются в колокольчике, а баннеры не появляются. Одинаковое время начала и конца отключает паузу.</p></div>';}
 function renderPanel(){if(!dialog?.open)return;const scroll=dialog.scrollTop,focused=document.activeElement?.dataset.familyNotification;dialog.innerHTML=content();dialog.scrollTop=scroll;if(focused)dialog.querySelector('[data-family-notification="'+focused+'"]')?.focus({preventScroll:true});}
 function hideToast(){clearTimeout(toastTimer);document.getElementById('family-notification-toast')?.remove();toastKeys=[];}
 function announce(){
  if(!mounted||!readsReady||!api.isReady()||document.hidden||dialog?.open||document.querySelector('dialog[open]'))return;
  const s=api.snapshot(),p=prefs(),me=api.getMe();if(N.quiet(p,s.minute))return;
  const seen=bannered[me]||(bannered[me]={}),next=unread().filter(e=>p.modes[e.type]==='banner'&&e.keys.some(k=>!isRead(k)&&!seen[k]));if(!next.length)return;
  hideToast();toastKeys=next.flatMap(e=>e.keys);toastKeys.forEach(k=>seen[k]=s.now);bannered[me]=Object.fromEntries(Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,1500));persist();
  const latest=next[0],toast=document.createElement('aside');toast.id='family-notification-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
  toast.innerHTML='<span class="family-toast-icon">'+icon(next.length===1?latest.icon:'bell')+'</span><div><b>'+esc(next.length===1?(latest.type==='thanks'?latest.heading+': спасибо!':latest.heading):'Новых событий: '+next.length)+'</b><p>'+esc(next.length===1?latest.title:'Откройте уведомления, чтобы их прочитать')+'</p></div>'+button('open','Открыть','family-toast-open')+button('dismiss',icon('x'),'family-toast-dismiss','aria-label="Скрыть уведомление"');document.body.append(toast);toastTimer=setTimeout(hideToast,9000);
 }
 function close(){if(!dialog)return;dialog.close();dialog.remove();dialog=null;openingUnread.clear();const target=focusBefore?.isConnected?focusBefore:api.root.querySelector('.family-notification-bell');target?.focus({preventScroll:true});}
 function readInbox(){if(dialog?.open&&panel==='inbox'){unread().forEach(e=>openingUnread.add(e.id));markRead(items.flatMap(e=>e.keys));}}
 function open(){
  if(dialog?.open)return;focusBefore=document.activeElement;hideToast();recompute();limit=40;panel='inbox';openingUnread=new Set(unread().map(e=>e.id));
  dialog=document.createElement('dialog');dialog.id='family-notifications';dialog.className='family-inbox';dialog.setAttribute('aria-labelledby','family-inbox-title');dialog.innerHTML=content();
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});document.body.append(dialog);dialog.showModal();readInbox();
 }
 function sync(){
  if(!mounted)return;const me=api.getMe();if(lastPerson!==me){close();hideToast();lastPerson=me;items=[];}recompute();ensureBell();paintBells();
  if(toastKeys.length&&!items.some(e=>fresh(e)&&e.keys.some(k=>toastKeys.includes(k))))hideToast();
  if(dialog?.open&&panel==='inbox'){readInbox();renderPanel();}announce();
 }
 function connect(db){
  if(api.preview)return;ref=db.ref('rooms/'+api.room+'/notificationReads');
  ref.on('value',snap=>{for(const [person,ids] of Object.entries(snap.val()||{})){receipts[person]=receipts[person]||{};for(const [id,value] of Object.entries(ids||{}))if(value)receipts[person][id]=true;}readsReady=true;persist();sync();},()=>{readsReady=true;sync();});
  db.ref('.info/connected').on('value',snap=>{if(snap.val()){clearTimeout(retryTimer);retryTimer=setTimeout(flushReads,0);}});
 }
 document.addEventListener('click',e=>{
  const el=e.target.closest('[data-family-notification]');if(!el||(!api.root.contains(el)&&!el.closest('#family-notifications,#family-notification-toast')))return;const a=el.dataset.familyNotification;
  if(a==='open')open();else if(a==='close')close();else if(a==='dismiss')hideToast();else if(a==='more'){limit+=40;renderPanel();}
  else if(a==='settings'||a==='back'){panel=a==='settings'?'settings':'inbox';dialog.scrollTop=0;readInbox();renderPanel();dialog.querySelector('button')?.focus({preventScroll:true});}
  else if(a==='follow'){const item=items.find(i=>i.id===el.dataset.id);if(item?.target){markRead(item.keys);close();api.follow(item.target);}}
 });
 document.addEventListener('change',e=>{if(!e.target.closest('#family-notifications'))return;const mode=e.target.dataset.notificationMode,k=e.target.dataset.notificationPref;if(!mode&&!k)return;const p=prefs();if(mode&&N.categories[mode])p.modes[mode]=e.target.value;else if(k)p[k]=k==='quiet'?e.target.checked:e.target.value;settings[api.getMe()]=N.preferences(p);persist();hideToast();sync();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){sync();flushReads();}});document.addEventListener('close',()=>queueMicrotask(sync),true);
 setInterval(()=>{if(!document.hidden)sync();},60000);
 return {bell,connect,receive:sync,mount(){mounted=true;sync();flushReads();}};
};
})();
