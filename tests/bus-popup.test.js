import test from 'node:test';
import assert from 'node:assert/strict';
import { busPopup } from '../public/src/map/bus-popup.js';
class Element {
  children=[];textContent='';
  append(...children){this.children.push(...children);}
  get text(){return this.textContent+this.children.map(c=>c.text ?? c.textContent ?? c).join(' ');}
}
globalThis.document={createElement:()=>new Element(),createTextNode:text=>({text})};
const now=new Date('2026-09-29T10:59:00Z'); // 23:59 NZ, regardless of browser's zone
const stop={name:'<img onerror=bad()>',routes:[{number:'1',name:'Airport'}],departures:[
 {scheduledAt:'2026-09-29T10:58:00Z',route:'1',destination:'OLD'},
 {scheduledAt:'2026-09-29T11:05:00Z',route:'1',destination:'Airport',pickupType:'2'}
]};
test('popup uses NZ dates across midnight, filters departed buses, and labels schedules',()=>{
 const text=busPopup(stop,{now}).text;
 assert.ok(!text.includes('OLD'));assert.match(text,/30 Sept/);assert.match(text,/00:05/);
 assert.match(text,/Airport/);assert.match(text,/arrange pickup/);assert.match(text,/not live arrivals/);
 assert.match(text,/<img onerror=bad\(\)>/); // textContent, never parsed HTML
});
test('popup distinguishes loading, unavailable and no timetable service',()=>{
 assert.match(busPopup(stop,{now,loading:true}).text,/Loading scheduled/);
 assert.match(busPopup(stop,{now,error:true}).text,/Departures unavailable/);
 assert.match(busPopup({...stop,departures:[]},{now}).text,/next 7 days/);
 assert.ok(!busPopup(stop,{now,error:true}).text.includes('00:05'));
});
