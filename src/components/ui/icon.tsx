import type { CSSProperties } from "react";
const paths = {
 bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
 grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
 customers: "M21 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M21 8v6 M18 11h6",
 users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
 activity: "M3 12h4l3-8 4 16 3-8h4", search: "m21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
 plus:"M12 5v14 M5 12h14", chevron:"m9 5 7 7-7 7", left:"m14 6-6 6 6 6", menu:"M4 6h16 M4 12h16 M4 18h16",
 close:"m6 6 12 12 M6 18 18 6", panel:"M3 3h18v18H3z M9 3v18", expand:"M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5",
 logout:"M9 4H4v16h5 M9 12h12 M17 8l4 4-4 4", building:"M5 21V3h14v18 M3 21h18 M9 7h1 M14 7h1 M9 11h1 M14 11h1 M10 21v-6h4v6",
 list:"M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01", mail:"M3 5h18v14H3z m0 0 9 7 9-7",
 arrow:"M5 12h14 m-5-5 5 5-5 5", check:"m5 12 4 4L19 6", shield:"m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-5", edit:"m16 3 5 5-12 12-6 1 1-6z M14 5l5 5",
} as const;
export type IconName=keyof typeof paths;
export default function Icon({name,size=20,style}:{name:IconName;size?:number;style?:CSSProperties}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0,...style}}><path d={paths[name]}/></svg>;}
