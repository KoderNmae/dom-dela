/* Garden rules are independent of the chore scheduler and the browser. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GardenEngine=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DAY=86400000;
const tiers=[{id:'common',name:'Обычное',grow:6,chance:0},{id:'uncommon',name:'Необычное',grow:9,chance:.08},{id:'rare',name:'Редкое',grow:12,chance:.02},{id:'epic',name:'Эпическое',grow:15,chance:.004},{id:'legendary',name:'Легендарное',grow:21,chance:.0005}];
const species={
 daisy:{name:'Ромашки',tier:0,legacy:0},lavender:{name:'Лаванда',tier:0,legacy:1},apple:{name:'Яблоня',tier:0,legacy:2},
 hydrangea:{name:'Гортензия',tier:1,art:0},peony:{name:'Пион',tier:1,art:1},
 orchid:{name:'Голубая орхидея',tier:2,art:2},maple:{name:'Японский клён',tier:2,art:3},
 magnolia:{name:'Серебряная магнолия',tier:3,art:4},fern:{name:'Аметистовый папоротник',tier:3,art:5},
 wisteria:{name:'Золотая глициния',tier:4,art:6},lotus:{name:'Лунный лотос',tier:4,art:7},
 daisy_double:{name:'Махровая ромашка',tier:0,art:12,parent:'daisy',recipe:6},lavender_silver:{name:'Серебристая лаванда',tier:0,art:13,parent:'lavender',recipe:8}
};
const decor={bench:{name:'Скамейка',art:8,cost:8},lantern:{name:'Фонарь',art:9,cost:6},planter:{name:'Терракотовое кашпо',art:10,cost:6},fountain:{name:'Фонтан',art:11,cost:24},fence:{name:'Ограда',art:14,cost:5},stones:{name:'Каменная дорожка',art:15,cost:4}};
const clone=x=>JSON.parse(JSON.stringify(x)),number=(x,d=0)=>Number.isFinite(+x)?Math.max(0,+x):d;
function fresh(now){return {version:2,revision:0,createdAt:now,lastNow:now,pausedMs:0,vacation:null,spent:0,economy:{water:0,debt:0,sources:{},initialized:false},inventory:{wild:6},plants:{},decorations:{},decorStock:{},zones:['meadow'],storageLevel:0,claims:{},thanks:{},rewards:{},celebrations:{},history:[],tutorial:false,migration:null};}
function migrate(v,now){
 if(!v)return fresh(now);
 if(v.version>2)throw Error('Сад обновлён на другом устройстве. Обновите страницу.');
 if(v.version===2){
  const d={...fresh(now),...clone(v)};
  for(const k of ['inventory','plants','decorations','decorStock','claims','thanks','rewards','celebrations'])d[k]=d[k]||{};
  d.zones=Array.isArray(d.zones)?d.zones:Object.values(d.zones||{});if(!d.zones.includes('meadow'))d.zones.unshift('meadow');
  d.history=Array.isArray(d.history)?d.history:Object.values(d.history||{});
  d.economy={water:0,debt:0,sources:{},initialized:false,...d.economy};d.economy.sources=d.economy.sources||{};
  return d;
 }
 const d=fresh(now),w=v.world||{},initial={a:['daisy',2,true],b:['lavender',1,false],c:['lavender',2,false],d:['daisy',0,false],e:['apple',1,false],h:['daisy',2,true]};
 const untouched=Object.entries(initial).every(([id,p])=>w.plants?.[id]?.kind===p[0]&&w.plants[id].stage===p[1]&&!!w.plants[id].collected===p[2])&&!w.spent&&!w.harvests;
 d.revision=number(v.revision);d.spent=number(w.spent);d.inventory={wild:number(w.seeds,4)};
 for(const k of ['thanks','rewards','celebrations'])d[k]=clone(v[k]||{});
 const legacySlots='abcdefghijklmn';let slot=0,removed=0;
 for(const [id,p] of Object.entries(w.plants||{})){
  if(untouched&&initial[id]){removed++;continue;}
  if(!species[p.kind])continue;
  const s=legacySlots.indexOf(id);d.plants['legacy_'+id]={id:'legacy_'+id,species:p.kind,zone:'meadow',slot:s>=0?s:slot++,age:(p.stage>=2?6:p.stage===1?3:0)*DAY,tick:now,waterAt:now,cycle:p.collected?1:0,fed:false,stored:false};
 }
 d.migration={from:1,removedDemo:removed,preserved:Object.keys(d.plants).length,at:now};
 // Original snapshot is retained privately inside the family garden for recovery.
 d.legacyBackup=clone(v);return d;
}
function realTime(s,now){return Math.max(number(now),number(s.lastNow));}
function clock(s,now){const real=realTime(s,now),v=s.vacation;return real-number(s.pausedMs)-(v?Math.max(0,Math.min(real,v.end)-v.start):0);}
function onVacation(s,now){return !!(s.vacation&&realTime(s,now)<s.vacation.end);}
function ageAt(s,p,now){if(p.stored)return p.age;const t=clock(s,now);return number(p.age)+Math.max(0,Math.min(t,p.waterAt+7*DAY)-p.tick);}
function plantInfo(s,p,now){
 const age=ageAt(s,p,now),duration=tiers[species[p.species].tier].grow*DAY,elapsed=p.stored?0:Math.max(0,clock(s,now)-p.waterAt),vacation=onVacation(s,now),wilted=elapsed>=7*DAY;
 return {age,duration,progress:Math.min(1,age/duration),stage:age>=duration?2:age>=duration*.45?1:0,wilted,thirsty:elapsed>=3*DAY,paused:vacation,ready:!p.stored&&!vacation&&!wilted&&age>=duration+number(p.cycle)*7*DAY,waterIn:Math.max(0,3*DAY-elapsed),harvestIn:Math.max(0,duration+number(p.cycle)*7*DAY-age)};
}
function settle(s,p,now){p.age=ageAt(s,p,now);p.tick=clock(s,now);}
function slots(s,zone){return zone==='meadow'?14:12;}
function locations(s,zone){return Array.from({length:slots(s,zone)},(_,i)=>({slot:i,x:575+(i%4)*150,y:570+Math.floor(i/4)*160}));}
function occupied(s,zone,slot,exclude){return Object.values(s.plants).some(p=>!p.stored&&p.zone===zone&&p.slot===slot&&p.id!==exclude)||Object.values(s.decorations).some(p=>p.zone===zone&&p.slot===slot&&p.id!==exclude);}
function available(s){return Object.entries(s.inventory).reduce((sum,[k,n])=>sum+((k==='wild'||species[k]?.tier===0)?Math.max(0,n-2):0),0);}
function spendSeeds(s,cost){if(available(s)<cost)throw Error('Недостаточно семян для обмена. По два каждого вида остаются для посадки.');let left=cost;for(const [id,n] of Object.entries(s.inventory).sort((a,b)=>b[1]-a[1])){if(id!=='wild'&&species[id]?.tier!==0)continue;const used=Math.min(left,Math.max(0,n-2));s.inventory[id]-=used;left-=used;if(!left)break;}}
function addSeed(s,id,n=1){s.inventory[id]=number(s.inventory[id])+n;}
function zonePrice(s){return 20+(s.zones.length-1)*15;}
function zoneMilestone(s){return 10+(s.zones.length-1)*15;}
function storageCapacity(s){return 8+number(s.storageLevel)*4;}
function waterCost(s){const n=Object.values(s.plants).filter(p=>!p.stored).length;return n?Math.max(2,Math.ceil(2*Math.sqrt(n))):0;}
function waterCapacity(s){return Math.max(12,waterCost(s)*4);}
function incomeNeeded(s,ctx){const e=s.economy,source=ctx.sources||{};return !e?.initialized||e.water>waterCapacity(s)||Object.keys({...e.sources,...source}).some(k=>number(e.sources[k]?.active)!==number(source[k]));}
function syncIncome(s,ctx){
 const e=s.economy,cap=waterCapacity(s),sources=ctx.sources||{};e.water=Math.min(cap,e.water);
 e.rates=e.rates||{};for(const [key,rate] of Object.entries(ctx.rates||{}))if(!e.rates[key])e.rates[key]=rate;
 for(const key of Object.keys({...e.sources,...sources}).sort()){
  const next=Math.min(10000,Math.floor(number(sources[key]))),r=e.sources[key]||{active:0,paid:''};
  // Remember which individual drops actually entered the tank. Overflow is not
  // banked, and undo/redo cannot reroll previously discarded drops into water.
  if(next>r.active){for(let i=r.active;i<next;i++){
   let granted;
   if(i<r.paid.length)granted=r.paid[i]==='1';
   else{granted=e.debt>0||e.water<cap;r.paid+=granted?'1':'0';}
   if(granted){if(e.debt)e.debt--;else e.water=Math.min(cap,e.water+1);}
  }}else if(next<r.active){for(let i=next;i<r.active;i++)if(r.paid[i]==='1'){if(e.water)e.water--;else e.debt++;}}
  r.active=next;e.sources[key]=r;
 }
 if(!e.initialized){if(s.migration&&s.spent)e.water=Math.max(0,e.water-s.spent);e.initialized=true;}
}
function rarityRoll(r){if(r<.0005)return 4;if(r<.0045)return 3;if(r<.0245)return 2;if(r<.1045)return 1;return 0;}
function validateSpace(s,zone,slot,exclude){if(!s.zones.includes(zone)||!Number.isInteger(slot)||slot<0||slot>=slots(s,zone)||occupied(s,zone,slot,exclude))throw Error('Это место занято или недоступно. Выберите другое.');}
function requireAwake(s,now){if(onVacation(s,now))throw Error('Сад отдыхает. Завершите отпуск, чтобы продолжить уход.');}
function apply(input,cmd,ctx){
 const now=ctx.now,s=migrate(input,now),t=clock(s,now);let result={message:'Готово'};
 syncIncome(s,ctx);
 const p=cmd.id&&s.plants[cmd.id];
 if(['plant','water','harvest','feed','store','restore'].includes(cmd.type))requireAwake(s,now);
 switch(cmd.type){
 case 'plant':{
  const kind=species[cmd.species];if(!kind)throw Error('Выберите семя.');validateSpace(s,cmd.zone,cmd.slot);
  const seed=number(s.inventory[cmd.species])>0?cmd.species:kind.tier===0&&!kind.parent?'wild':null;
  if(!seed||!s.inventory[seed])throw Error('Такого семени пока нет в запасах.');
  if(!cmd.newId||s.plants[cmd.newId])throw Error('Посадка уже сохранена.');s.inventory[seed]--;
  s.plants[cmd.newId]={id:cmd.newId,species:cmd.species,zone:cmd.zone,slot:cmd.slot,age:0,tick:t,waterAt:t,cycle:0,fed:false,stored:false};
  s.tutorial=true;result={message:kind.name+' посажены. Земля увлажнена на три дня.',plantId:cmd.newId};break;
 }
 case 'water':{
  const active=Object.values(s.plants).filter(p=>!p.stored);if(!active.length)throw Error('Сначала посадите растение.');
  if(!active.some(p=>plantInfo(s,p,now).thirsty))throw Error('Земля ещё влажная. Полив пока не нужен.');
  const cost=waterCost(s);if(s.economy.water<cost)throw Error('Для общего полива нужно '+cost+' капель. Получите их за домашние дела.');
  for(const p of active){settle(s,p,now);p.waterAt=t;}s.spent+=cost;s.economy.water-=cost;result.message='Весь сад полит · −'+cost+' капель';break;
 }
 case 'harvest':{
  if(!p||!plantInfo(s,p,now).ready)throw Error('Семена ещё не созрели.');
  settle(s,p,now);p.cycle++;p.fed=false;
  const basic=species[p.species].tier===0?p.species:'wild';addSeed(s,basic);
  const tier=rarityRoll(cmd.roll),choices=Object.keys(species).filter(k=>species[k].tier===tier&&!species[k].parent);
  const bonus=tier?choices[Math.min(choices.length-1,Math.floor(cmd.pick*choices.length))]:null;
  if(bonus)addSeed(s,bonus);
  result={message:bonus?'Находка! '+species[bonus].name:'Собрано семя · '+(basic==='wild'?'обычное':species[basic].name),bonus,tier};
  s.history.push({id:cmd.eventId,plant:p.id,cycle:p.cycle,bonus:bonus||null,at:realTime(s,now)});s.history=s.history.slice(-30);break;
 }
 case 'move':{
  const item=p||s.decorations[cmd.id];if(!item||item.stored)throw Error('Выберите объект в саду.');validateSpace(s,cmd.zone,cmd.slot,cmd.id);item.zone=cmd.zone;item.slot=cmd.slot;result.message='На новом месте';break;
 }
 case 'store':if(!p||p.stored)throw Error('Растение уже в оранжерее.');else{if(Object.values(s.plants).filter(p=>p.stored).length>=storageCapacity(s))throw Error('В оранжерее нет свободных мест. Расширьте её в лавке.');settle(s,p,now);p.storedDry=Math.max(0,t-p.waterAt);p.stored=true;p.zone=null;p.slot=null;result.message='Растение в оранжерее. Уход ему не нужен.';}break;
 case 'restore':if(!p||!p.stored)throw Error('Растение уже в саду.');else{validateSpace(s,cmd.zone,cmd.slot);p.stored=false;p.zone=cmd.zone;p.slot=cmd.slot;p.tick=t;p.waterAt=t-number(p.storedDry);delete p.storedDry;result.message='Растение вернулось в сад';}break;
 case 'feed':if(!p||p.stored||p.fed||plantInfo(s,p,now).wilted)throw Error('Подкормка сейчас недоступна.');else{spendSeeds(s,3);settle(s,p,now);p.age+=DAY;p.fed=true;result.message='Подкормка ускорила рост на один день';}break;
 case 'breed':{
  const item=species[cmd.species];if(!item?.parent||!s.inventory[item.parent])throw Error('Нужно одно семя исходного растения.');
  // Three parent seeds are required so the promised two-seed reserve survives.
  if(s.inventory[item.parent]<3)throw Error('Нужно минимум три исходных семени: два останутся в запасе.');
  s.inventory[item.parent]--;spendSeeds(s,item.recipe);addSeed(s,cmd.species);result.message='Получено семя: '+item.name;break;
 }
 case 'buy-decor':{const item=decor[cmd.kind];if(!item)throw Error('Такого украшения нет.');spendSeeds(s,item.cost);s.decorStock[cmd.kind]=number(s.decorStock[cmd.kind])+1;result.message='Украшение добавлено в запасы';break;}
 case 'place-decor':if(!decor[cmd.kind]||!s.decorStock[cmd.kind])throw Error('Сначала приобретите украшение.');else{validateSpace(s,cmd.zone,cmd.slot);s.decorStock[cmd.kind]--;s.decorations[cmd.newId]={id:cmd.newId,kind:cmd.kind,zone:cmd.zone,slot:cmd.slot};result.message='Украшение размещено';}break;
 case 'store-decor':{const item=s.decorations[cmd.id];if(!item)throw Error('Украшение не найдено.');s.decorStock[item.kind]=number(s.decorStock[item.kind])+1;delete s.decorations[cmd.id];result.message='Украшение убрано в запасы';break;}
 case 'expand':if(ctx.units<zoneMilestone(s))throw Error('Сначала завершите семейную цель для нового участка.');else{spendSeeds(s,zonePrice(s));const zone='plot-'+s.zones.length;s.zones.push(zone);result={message:'Открыт новый участок · 12 мест',zone};}break;
 case 'storage-upgrade':spendSeeds(s,12+number(s.storageLevel)*8);s.storageLevel++;result.message='В оранжерее ещё четыре места';break;
 case 'claim':{
  const g=(ctx.goals||[]).find(g=>g.id===cmd.goal);if(!g||!g.ready||s.claims[g.id]||species[cmd.species]?.tier!==g.tier)throw Error('Эта награда пока недоступна или уже получена.');
  s.claims[g.id]={species:cmd.species,at:realTime(s,now)};addSeed(s,cmd.species);result.message='Награда за общую цель: '+species[cmd.species].name;break;
 }
 case 'vacation':{
  const real=realTime(s,now);if(s.vacation)s.pausedMs+=Math.max(0,Math.min(real,s.vacation.end)-s.vacation.start);
  s.vacation=cmd.days?{start:real,end:real+Math.max(1,Math.min(60,cmd.days))*DAY}:null;
  result.message=cmd.days?'Сад отдыхает. Рост и высыхание приостановлены.':'С возвращением! Сад продолжает расти.';break;
 }
 case 'thank':if(!ctx.thank||s.thanks[ctx.thank.key])throw Error('Благодарность уже отправлена.');else{s.thanks[ctx.thank.key]=ctx.thank.value;result.message='Спасибо за заботу о доме!';}break;
 case 'reward':if(!['cinema','dinner','games'].includes(cmd.reward))throw Error('Выберите награду.');else s.rewards[ctx.week]=cmd.reward;break;
 case 'celebrate':if(!ctx.weekGoalDone||s.celebrations[ctx.week])throw Error('Цель ещё не выполнена или уже отмечена.');else{s.celebrations[ctx.week]=true;result.message='Пусть таких вечеров будет больше!';}break;
 case 'migrate':case 'income':break;
 default:throw Error('Действие не поддерживается.');
 }
 s.economy.water=Math.min(s.economy.water,waterCapacity(s));s.lastNow=realTime(s,now);s.revision++;return {state:s,...result};
}
return {DAY,tiers,species,decor,fresh,migrate,clock,onVacation,plantInfo,slots,locations,occupied,available,zonePrice,zoneMilestone,storageCapacity,waterCost,waterCapacity,incomeNeeded,rarityRoll,apply};
});
