import React,{useEffect,useState} from 'react';
import FloatingPanel from './FloatingPanel';
import PlanetInfoPanel from './PlanetInfoPanel';
import PinnedPlanetsSidebar from './PinnedPlanetsSidebar';
type Props={details:React.ComponentProps<typeof PlanetInfoPanel>;pins:React.ComponentProps<typeof PinnedPlanetsSidebar>};
export default function PlanetInformation({details,pins}:Props){
  const [visible,setVisible]=useState(true);
  const [tab,setTab]=useState<'details'|'pins'>(details.selectedPlanet?'details':'pins');
  useEffect(()=>{if(details.selectedPlanet){setVisible(true);setTab('details');}},[details.selectedPlanet?.id]);
  useEffect(()=>{if(pins.pinnedPlanets.length){setVisible(true);if(!details.selectedPlanet)setTab('pins');}},[pins.pinnedPlanets.length]);
  if(!visible||!details.selectedPlanet&&!pins.pinnedPlanets.length)return null;
  const active=details.selectedPlanet?tab:'pins';
  return <FloatingPanel id="planet-info" title="行星信息" subtitle={active==='details'?details.selectedPlanet?.name:`订选 ${pins.pinnedPlanets.length} 颗`} side="right" className="panel-inspector" revealKey={`${details.selectedPlanet?.id??''}:${pins.pinnedPlanets.length}`} onClose={()=>{setVisible(false);details.onClose();}}>
    <div className="inspector-tabs" role="group" aria-label="行星信息内容">
      <button aria-pressed={active==='details'} disabled={!details.selectedPlanet} onClick={()=>setTab('details')}>天体资料</button>
      <button aria-pressed={active==='pins'} onClick={()=>setTab('pins')}>订选天体 · {pins.pinnedPlanets.length}</button>
    </div>
    <div hidden={active!=='details'}><PlanetInfoPanel {...details}/></div>
    <div hidden={active!=='pins'}>{pins.pinnedPlanets.length?<PinnedPlanetsSidebar {...pins} onSelect={body=>{setTab('details');pins.onSelect(body);}}/>:<p className="inspector-note">在天体资料中订选，可在这里跟随、改色或取消订选。</p>}</div>
  </FloatingPanel>;
}
