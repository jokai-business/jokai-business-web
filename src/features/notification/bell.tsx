"use client";
import Link from 'next/link';import {useEffect,useState} from 'react';import {api} from '@/lib/api/client';import Icon from '@/components/ui/icon';
export default function NotificationBell(){
 const [count,setCount]=useState<number>();
 useEffect(()=>{let active=true;let sequence=0;async function load(){if(document.visibilityState==='hidden')return;const current=++sequence;try{const r=await api.GET('/api/v1/notifications/unread');if(r.error)throw new Error();if(active&&current===sequence)setCount(r.data.data.count);}catch{if(active&&current===sequence)setCount(undefined);}}void load();const timer=setInterval(()=>void load(),30000);window.addEventListener('notifications-changed',load);document.addEventListener('visibilitychange',load);return()=>{active=false;clearInterval(timer);window.removeEventListener('notifications-changed',load);document.removeEventListener('visibilitychange',load);};},[]);
 return <Link href="/notifications" className="icon-button notification-bell" aria-label={count===undefined?'Open notifications':`Open notifications, ${count} unread`} title="Notifications"><Icon name="bell" size={19}/>{!!count&&<span className="notification-count">{count>99?'99+':count}</span>}</Link>;
}
