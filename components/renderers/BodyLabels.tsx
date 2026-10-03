import React from 'react';
import { BodyLabel, layoutBodyLabels, SCENE_FONT_FAMILY } from '../../core/sceneLabels';

export default function BodyLabels({labels,width,height,onSelect}: {
  labels:BodyLabel[];width:number;height:number;onSelect:(id:string)=>void;
}) {
  return <g data-layer="body-labels" fontFamily={SCENE_FONT_FAMILY}>
    {layoutBodyLabels(labels,width,height).map(label=><text key={label.id} data-body-label={label.id}
      x={label.x} y={label.y} fontSize={label.fontSize} textAnchor="middle" dominantBaseline="central"
      fill={label.color} opacity={label.opacity} fontWeight={label.emphasized?'600':'400'}
      stroke="#020306" strokeWidth={2.5} strokeLinejoin="round" paintOrder="stroke"
      className="pointer-events-auto cursor-pointer" onClick={e=>{e.stopPropagation();onSelect(label.id);}}>
      {label.text}
    </text>)}
  </g>;
}
