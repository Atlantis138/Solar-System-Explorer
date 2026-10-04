import React from 'react';
export function InspectorHeader({name,subtitle,color}:{name:string;subtitle?:string;color?:string}) {
  return <div className="inspector-heading"><i style={{background:color??'var(--panel-accent)'}}/><div><h3>{name}</h3>{subtitle&&<p>{subtitle}</p>}</div></div>;
}
export function InspectorAction({children,label,kind,onClick,active,disabled}:{children:React.ReactNode;label:string;kind:'look'|'orbit'|'pin'|'travel';onClick:()=>void;active?:boolean;disabled?:boolean}) {
  return <button type="button" className="inspector-action" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{kind==='look'?<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>:kind==='orbit'?<><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="2"/></>:kind==='pin'?<path d="M8 3h8l-1 7 3 4H6l3-4-1-7Zm4 11v7"/>:<path d="m4 20 7-16 2 7 7 2-16 7Zm7-9 9-9"/>}</svg>{children}
  </button>;
}
