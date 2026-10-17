"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import type {components} from '@/lib/api/schema';
import {api} from '@/lib/api/client';
import {getSession} from '@/lib/auth/session';
import AppShell from '@/components/navigation/app-shell';
import Brand from '@/components/ui/brand';
import Icon from '@/components/ui/icon';
type Context=components['schemas']['UserContext'];
const SessionContext=createContext<Context|undefined>(undefined);
export function useWorkspaceContext(){const value=useContext(SessionContext);if(!value)throw new Error('Workspace session is unavailable');return value;}
function message(error:unknown){return error instanceof Error?error.message:'Could not connect. Please try again.';}
const views=['gmail','customers','opportunities','products','quotes','projects','finance','scopes','documents','notifications','users','audit'] as const;
export default function WorkspaceFrame({children}:{children:ReactNode}){
 const pathname=usePathname();
 const view=(pathname==='/settings'||pathname==='/settings/email')?'settings':views.find(v=>pathname===`/${v}`||pathname.startsWith(`/${v}/`)||pathname===`/settings/${v}`)??'overview';
 const [context,setContext]=useState<Context>();const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{let active=true;let pending=false;
 async function check(){if(pending)return;pending=true;try{const session=await getSession();if(!active)return;if(!session.authenticated){setContext(undefined);return;}const r=await api.GET('/api/v1/me');if(!active)return;if(r.error){if(r.response.status===401||r.response.status===403)setContext(undefined);throw new Error(r.error.error.message);}setContext(old=>JSON.stringify(old)===JSON.stringify(r.data.data)?old:r.data.data);setError('');}catch(e){if(active)setError(message(e));}finally{pending=false;if(active)setLoading(false);}}
 void check();const refresh=()=>{if(document.visibilityState==='visible')void check();};const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);window.addEventListener('organization-settings-changed',refresh);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('organization-settings-changed',refresh);};},[]);
 async function login(){setError('');try{await(await getSession()).login({redirectUri:window.location.origin+window.location.pathname,prompt:'login'});}catch(e){setError(message(e));}}
 async function logout(){try{await(await getSession()).logout({redirectUri:window.location.origin});}catch(e){setError(message(e));}}
 if(loading)return <main className="session-loading" aria-busy="true"><Brand/><p role="status">Opening your workspace…</p></main>;
 if (!context) return <main className="login-screen"><section className="login-intro"><div className="brand"><Brand/></div><div className="login-copy"><span className="login-eyebrow">ONE WORKSPACE. EVERY POSSIBILITY.</span><h1>Bring your work<br/>into focus.</h1><p>From the first conversation to the final delivery. Give your team one place to move business forward.</p><div className="login-trust"><Icon name="shield" size={18}/>Private by design. Built for your team.</div></div><p className="login-copyright">JOKAI</p></section><section className="login-form-panel"><div className="login-card"><span className="login-icon"><Icon name="building" size={25}/></span><span className="login-eyebrow">YOUR WORK STARTS HERE</span><h2>Welcome to JOKAI</h2><p>A clearer view of your business is one sign-in away.</p>{error&&<div role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error} Ask your administrator to check your membership if you cannot access your organization.</div>}<button className="button login-submit" disabled={loading} onClick={login}>{loading?'Checking your session…':<><span>Sign in</span><Icon name="arrow" size={17}/></>}</button><div className="login-note"><Icon name="shield" size={16}/><span>Secure sign-in through your work account.</span></div></div></section></main>;

 return <SessionContext.Provider value={context}><AppShell context={context} view={view} onLogout={logout}>{error&&<p role="alert" className="finance-error">{error}</p>}<div className="route-content">{children}</div></AppShell></SessionContext.Provider>;
}
