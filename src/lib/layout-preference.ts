"use client";
import {useSyncExternalStore} from 'react';
const eventName='business-os-layout';
const memory=new Map<string,boolean>();
function subscribe(listener:()=>void){window.addEventListener('storage',listener);window.addEventListener(eventName,listener);return()=>{window.removeEventListener('storage',listener);window.removeEventListener(eventName,listener);};}
function read(key:string){try{return localStorage.getItem('business-os:'+key)==='true';}catch{return memory.get(key)??false;}}
export function useLayoutPreference(key:string):[boolean,(value:boolean)=>void]{
 const value=useSyncExternalStore(subscribe,()=>read(key),()=>false);
 return [value,(next:boolean)=>{memory.set(key,next);try{localStorage.setItem('business-os:'+key,String(next));}catch{/* Keep controls working when browser storage is disabled. */}window.dispatchEvent(new Event(eventName));}];
}
