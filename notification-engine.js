/* Notification rules never change chores, plants, or rewards. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HomeNotificationEngine=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DAY=86400000;
const categories={
 thanks:{name:'Благодарности',note:'Когда близкий говорит вам «Спасибо»',icon:'heart',mode:'banner'},
 transfer:{name:'Передача дел',note:'Вам передали или добавили дело',icon:'arrow-right-left',mode:'banner'},
 change:{name:'Изменения в плане',note:'Переносы и важные правки ваших дел',icon:'calendar-clock',mode:'banner'},
 plan:{name:'План на день',note:'Один обзор оставшихся дел за день',icon:'list-checks',mode:'history'},
 goal:{name:'Семейные цели',note:'Выполненные цели и доступные награды',icon:'flag',mode:'history'},
 water:{name:'Полив сада',note:'Одно напоминание для всего сада',icon:'droplets',mode:'history'},
 harvest:{name:'Сбор семян',note:'Какие растения готовы к сбору',icon:'sprout',mode:'history'}
};
const time=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||'');
const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
function preferences(raw={}){const modes={};for(const [id,c] of Object.entries(categories))modes[id]=['banner','history','off'].includes(raw.modes?.[id])?raw.modes[id]:c.mode;return {modes,planAt:time(raw.planAt)?raw.planAt:'09:00',quiet:raw.quiet!==false,quietStart:time(raw.quietStart)?raw.quietStart:'22:00',quietEnd:time(raw.quietEnd)?raw.quietEnd:'09:00'};}
function quiet(p,m){if(!p.quiet)return false;const start=minutes(p.quietStart),end=minutes(p.quietEnd);return start===end?false:start<end?m>=start&&m<end:m>=start||m<end;}
const plural=(n,a,b,c)=>n%10===1&&n%100!==11?a:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?b:c;
const shortDate=d=>new Date(d+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
const operations=new Set(['assign','snooze','unsnooze','add-day','remove-day','edit','del','skip','reset-ov','cap','mode','restday','away-add','away-del','add']);
function changes({op,before,after,actor,day,today,now,id,nextDay}){
 if(!operations.has(op.t))return [];
 const cid=op.cid||op.id||op.chore?.id,people=new Set([...before,...after].map(t=>t.person).filter(p=>p&&p!==actor)),out=[];
 const own=(list,p)=>list.filter(t=>t.person===p&&t.remaining>0).sort((a,b)=>a.cid.localeCompare(b.cid));
 for(const to of people){
  if(cid){
   const old=before.find(t=>t.cid===cid),next=after.find(t=>t.cid===cid),was=old?.person===to&&old.remaining>0,has=next?.person===to&&next.remaining>0;
   if(!was&&!has)continue;if(JSON.stringify(old)===JSON.stringify(next))continue;
   let type='change',heading='Изменено ваше дело',detail='Изменились условия выполнения.',target={type:'chore',day,cid};
   if(op.t==='unsnooze'){heading='Дело возвращено в план';detail='Снова в плане на '+shortDate(day)+'.';}
   else if(has&&(!old||old.person!==to)){type='transfer';heading=old?'Вам передали дело':'Вам добавили дело';detail='План на '+shortDate(day)+'.';}
   else if(op.t==='snooze'){heading='Дело перенесено';detail='Перенесено с '+shortDate(day)+' на '+shortDate(nextDay)+'.';target={type:'plan',day:nextDay};}
   else if(!has){heading=next&&next.person!==to?'Дело передано другому участнику':'Дело убрано из плана';detail='Больше не в вашем плане на '+shortDate(day)+'.';target={type:'plan',day};}
   if(type==='change'&&day!==today)continue;
   out.push({id:id+'_'+to,type,to,from:actor,at:now,day,cid,title:next?.title||old.title,heading,detail,target});
  }else{
   const a=own(before,to),b=own(after,to);if(day!==today||JSON.stringify(a)===JSON.stringify(b))continue;
   out.push({id:id+'_'+to,type:'change',to,from:actor,at:now,day,heading:'Ваш план на сегодня изменился',title:b.length?'Осталось '+b.length+' '+plural(b.length,'дело','дела','дел'):'Активных дел на сегодня нет',detail:'Обновлены распределение или расписание.',target:{type:'plan',day}});
  }
 }return out;
}
function journal(existing,events,now){return Object.fromEntries(Object.entries({...existing,...Object.fromEntries(events.map(e=>[e.id,e]))}).filter(([,e])=>e&&Number(e.at)>=now-90*DAY).sort((a,b)=>b[1].at-a[1].at||b[0].localeCompare(a[0])).slice(0,300));}
function collect(s,p){
 const out=[],name=id=>s.people.find(p=>p.id===id)?.name||'Близкий человек';
 const add=e=>{if(p.modes[e.type]!=='off')out.push({active:true,...e,keys:e.keys||[e.id],icon:categories[e.type].icon});};
 for(const [id,t] of Object.entries(s.thanks||{}))if(t?.to===s.me){add({id,type:'thanks',at:Number(t.at)||Date.parse(t.day+'T12:00:00')||0,legacy:!t.at,day:t.day,heading:name(t.from),detail:'Спасибо за заботу!',title:'За «'+(t.title||'домашнее дело')+'»',target:t.cid?{type:'chore',day:t.day,cid:t.cid}:null});}
 const events=Object.values(s.events||{}).filter(e=>e?.to===s.me&&categories[e.type]&&Number(e.at)>=s.now-90*DAY).sort((a,b)=>b.at-a.at||b.id.localeCompare(a.id)),latest=new Set();
 for(const e of events){const group=e.day+'_'+(e.cid||'plan'),superseded=latest.has(group);latest.add(group);const task=s.tasks.find(t=>t.cid===e.cid&&t.person===s.me&&t.remaining>0);add({...e,detail:name(e.from)+' · '+e.detail,active:!superseded&&e.day>=s.today&&(e.type!=='transfer'||e.day!==s.today||!!task)});}
 const pending=s.tasks.filter(t=>t.person===s.me&&t.remaining>0);
 if(pending.length&&s.minute>=minutes(p.planAt))add({id:'plan_'+s.today+'_'+s.me,type:'plan',at:Date.parse(s.today+'T'+p.planAt+':00'),heading:'Ваш план на сегодня',title:pending.length+' '+plural(pending.length,'дело осталось','дела осталось','дел осталось'),detail:pending.slice(0,3).map(t=>t.title).join(' · ')+(pending.length>3?'…':''),target:{type:'plan',day:s.today}});
 for(const g of s.goals||[])if(g.ready||g.claimed)add({id:'goal_'+g.id,type:'goal',at:g.claimed?.at||0,active:!g.claimed,heading:g.claimed?'Награда получена':'Семейная цель достигнута',title:g.title,detail:g.claimed?'Семена уже в ваших запасах.':'Можно выбрать '+g.rarity+' растение в награду.',target:{type:'goals'}});
 if(!s.vacation){
  const thirsty=(s.plants||[]).filter(p=>p.thirsty),ready=(s.plants||[]).filter(p=>p.ready);
  if(thirsty.length)add({id:'garden_water',type:'water',at:0,keys:thirsty.map(p=>'water_'+p.id+'_'+Math.floor(p.waterAt)),heading:'Саду нужен полив',title:thirsty.length+' '+plural(thirsty.length,'растение ждёт','растения ждут','растений ждут')+' воды',detail:'На общий полив нужно '+s.waterCost+' '+plural(s.waterCost,'капля','капли','капель')+'.',target:{type:'water'}});
  if(ready.length)add({id:'garden_harvest',type:'harvest',at:0,keys:ready.map(p=>'harvest_'+p.id+'_'+p.cycle),heading:'Семена созрели',title:'Можно собрать с '+ready.length+' '+plural(ready.length,'растения','растений','растений'),detail:ready.slice(0,3).map(p=>p.name).join(' · ')+(ready.length>3?'…':''),target:{type:'harvest'}});
 }
 return out.sort((a,b)=>Number(b.active)-Number(a.active)||(b.at||0)-(a.at||0)||a.id.localeCompare(b.id));
}
return {categories,preferences,minutes,quiet,operations,changes,journal,collect,plural};
});
