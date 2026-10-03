import type { AppSettings, SmallBodyPopulation } from '../types';

export const TROJAN_DISTRIBUTION = {
  radialFraction: [.94,1.06] as const,
  librationAmplitudeDeg: [8,30] as const,
  librationPeriodYears: 150,
};

export const SMALL_BODY_POPULATIONS: SmallBodyPopulation[] = [
  {id:'main-asteroid-belt',kind:'population',name:'小行星主带',englishName:'Main asteroid belt',
    distribution:'belt',color:'#888',defaultVisible:true,semiMajorAxisAU:[2.1,3.3],eccentricity:[.02,.18],maxInclinationDeg:16,weight:1,
    description:'火星与木星之间的主要小行星分布区；以较扁的粒子环带表现，不显示画面名称。',
    sourceUrl:'https://science.nasa.gov/solar-system/asteroids/'},
  {id:'jupiter-trojans',kind:'population',name:'木星特洛伊群',englishName:'Jupiter Trojans',
    distribution:'trojan',referenceBodyId:'jupiter',color:'#c1a47c',defaultVisible:false,semiMajorAxisAU:[4.9,5.5],eccentricity:[0,.12],maxInclinationDeg:22,weight:.65,
    description:'与木星共轨，主要聚集在前方和后方约 60° 的 L4、L5 区域；两簇粒子随木星转动，并示意缓慢摆动。',
    sourceUrl:'https://science.nasa.gov/mission/lucy/'},
  {id:'kuiper-population',kind:'population',name:'柯伊伯带小天体',englishName:'Kuiper belt objects',
    distribution:'belt',color:'#829bad',defaultVisible:false,semiMajorAxisAU:[30,50],eccentricity:[0,.15],maxInclinationDeg:20,weight:.8,
    description:'海王星外的冰质小天体盘，以低倾角主体和少量高倾角成员示意；不包含更远的散射盘。与太阳系边界辅助线独立开关。',
    sourceUrl:'https://science.nasa.gov/solar-system/kuiper-belt/'},
];

export function populationVisible(population: SmallBodyPopulation, settings: AppSettings) {
  // Keep the old preference and the settings shortcut as one source of truth.
  return population.id==='main-asteroid-belt' ? settings.showAsteroidBelt
    : settings.populationVisibility?.[population.id] ?? population.defaultVisible;
}
export function setPopulationVisible(settings:AppSettings,id:string,visible:boolean):AppSettings {
  return id==='main-asteroid-belt' ? {...settings,showAsteroidBelt:visible}
    : {...settings,populationVisibility:{...settings.populationVisibility,[id]:visible}};
}
