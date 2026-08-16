import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search, X, Navigation, Crosshair, MapPin, ShieldCheck,
  TriangleAlert, HeartPulse, Droplets, BedDouble, Users,
  LifeBuoy, Radio, Layers, Wifi, WifiOff, Hospital, Tent,
  Locate, ChevronDown, Map,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_META } from '@/types';
import type { AidRequest, Shelter, Volunteer, RequestCategory } from '@/types';

// ── Badrinath / Joshimath data ─────────────────────────────────────────────
import {
  MAP_CENTER, MAP_ZOOM, MAP_ZOOM_MIN, MAP_ZOOM_MAX,
  ROADS_GEOJSON, RIVERS_GEOJSON,
  LANDSLIDE_ZONES_GEOJSON, FLOOD_ZONES_GEOJSON, SAFE_ZONES_GEOJSON,
  EMERGENCY_SHELTERS, HOSPITALS, EMERGENCY_RESPONSE, DISASTER_MARKERS,
  SEARCH_INDEX, PLACE_LABELS, ROAD_LABELS, BUILDINGS_GEOJSON, FAMOUS_POIS,
} from '@/data/joshimath-map-data';

// ── Delhi NCR data ─────────────────────────────────────────────────────────
import {
  NCR_CENTER, NCR_ZOOM, NCR_ZOOM_MIN, NCR_ZOOM_MAX,
  NCR_ROADS_GEOJSON, NCR_RIVERS_GEOJSON, NCR_FLOOD_ZONES_GEOJSON,
  NCR_PLACE_LABELS, NCR_ROAD_LABELS, NCR_FAMOUS_POIS, NCR_SEARCH_INDEX,
} from '@/data/delhi-ncr-map-data';

import type { EmergencyLocation, SearchEntry } from '@/data/joshimath-map-data';

// ─────────────────────────────────────────────────────────────────────────────
// Leaflet default-icon fix (bundler strips the URLs)
// ─────────────────────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─────────────────────────────────────────────────────────────────────────────
// Region type
// ─────────────────────────────────────────────────────────────────────────────
export type MapRegion = 'ncr' | 'badrinath';

const REGION_META: Record<MapRegion, {
  label: string; sublabel: string;
  center: [number, number]; zoom: number; zoomMin: number; zoomMax: number;
}> = {
  ncr: {
    label: 'Delhi NCR', sublabel: 'Delhi · Noida · Gurugram · Faridabad',
    center: NCR_CENTER, zoom: NCR_ZOOM, zoomMin: NCR_ZOOM_MIN, zoomMax: NCR_ZOOM_MAX,
  },
  badrinath: {
    label: 'Badrinath / Joshimath', sublabel: 'Chamoli · Uttarakhand · Disaster Region',
    center: MAP_CENTER, zoom: MAP_ZOOM, zoomMin: MAP_ZOOM_MIN, zoomMax: MAP_ZOOM_MAX,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG icon helpers — fully offline, no external URLs
// ─────────────────────────────────────────────────────────────────────────────
function svgIcon(html: string, w: number, h: number): L.DivIcon {
  return L.divIcon({ html, className: '', iconSize:[w,h], iconAnchor:[w/2,h], popupAnchor:[0,-(h-4)] });
}

const pin = (fill: string, symbol: string, uid = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 44" width="36" height="44">
    <defs><filter id="sh${uid}" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.45"/>
    </filter></defs>
    <path d="M18 1C10.82 1 5 6.82 5 14c0 10.5 13 29 13 29s13-18.5 13-29C31 6.82 25.18 1 18 1z"
          fill="${fill}" filter="url(#sh${uid})" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
    <circle cx="18" cy="14" r="8.5" fill="rgba(255,255,255,0.18)"/>
    <text x="18" y="18.5" text-anchor="middle" dominant-baseline="middle"
          font-size="12" font-family="system-ui,sans-serif" fill="white" font-weight="700">${symbol}</text>
  </svg>`;

const ICONS = {
  shelter:  svgIcon(pin('#2563eb','⛺','s'),  36,44),
  hospital: svgIcon(pin('#dc2626','✚','h'),  36,44),
  response: svgIcon(pin('#d97706','★','r'),  36,44),
  risk:     svgIcon(pin('#b91c1c','!','rk'), 36,44),
  safe:     svgIcon(pin('#16a34a','✓','sf'), 36,44),
  gps: svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
      <circle cx="14" cy="14" r="13" fill="#3b82f6" opacity="0.18"/>
      <circle cx="14" cy="14" r="7"  fill="#3b82f6" opacity="0.5"/>
      <circle cx="14" cy="14" r="4"  fill="#3b82f6"/>
      <circle cx="14" cy="14" r="2"  fill="white"/>
    </svg>`, 28, 28,
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  highway:'#c8d4e8', majorRoad:'#8fa3bc', minorRoad:'#5c7080',
  river:'#38bdf8', stream:'#7dd3fc',
  slideCrit:'#f97316', slideHigh:'#fb923c', slideMod:'#fbbf24',
  floodCrit:'#1d4ed8', floodHigh:'#2563eb', floodMod:'#3b82f6',
  safe:'#16a34a',
  bgDeep:'#0c1827', bgMid:'#122033', bgHill:'#1a2d40',
};

// ─────────────────────────────────────────────────────────────────────────────
// Layer visibility — shared across both regions
// ─────────────────────────────────────────────────────────────────────────────
interface LayerVisibility {
  roads:boolean; rivers:boolean;
  landslides:boolean; floods:boolean; safeZones:boolean;
  shelters:boolean; hospitals:boolean; response:boolean;
  risks:boolean; requests:boolean; labels:boolean;
  buildings:boolean; pois:boolean;
}

const DEFAULT_LAYERS: LayerVisibility = {
  roads:true, rivers:true, landslides:true, floods:true, safeZones:true,
  shelters:true, hospitals:true, response:true, risks:true, requests:true,
  labels:true, buildings:true, pois:true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface MapViewProps {
  requests: AidRequest[];
  shelters: Shelter[];
  volunteers: Volunteer[];
  isOnline: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  region: MapRegion;
}

const REQ_ICON_MAP: Record<RequestCategory, typeof HeartPulse> = {
  medical:HeartPulse, food:Droplets, shelter:BedDouble, volunteers:Users, rescue:LifeBuoy,
};

// ─────────────────────────────────────────────────────────────────────────────
// Emergency location popup builder
// ─────────────────────────────────────────────────────────────────────────────
function buildPopupHtml(loc: EmergencyLocation): string {
  const sc = loc.status==='open'?'#22c55e':loc.status==='danger'?'#ef4444':
             loc.status==='warning'?'#f59e0b':loc.status==='full'?'#f97316':'#94a3b8';
  const pct = loc.capacity && loc.occupied!=null
    ? Math.round((loc.occupied/loc.capacity)*100) : null;
  const bar = pct!=null ? `
    <div style="margin:10px 0 4px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:4px">
        <span>${loc.occupied}/${loc.capacity} beds used</span>
        <span style="color:${pct>80?'#f97316':'#22c55e'}">${pct}%</span>
      </div>
      <div style="height:6px;background:#1e3a52;border-radius:4px;overflow:hidden">
        <div style="height:6px;width:${pct}%;background:${pct>80?'#f97316':'#22c55e'};border-radius:4px"></div>
      </div>
    </div>` : '';
  const chips = loc.amenities.length ? `
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
      ${loc.amenities.map(a=>`<span style="background:#162840;border:1px solid #2a4a68;
        border-radius:5px;padding:2px 7px;font-size:10px;color:#93c5fd">${a}</span>`).join('')}
    </div>` : '';
  return `
    <div style="width:240px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700;color:#f1f5f9;line-height:1.35">${loc.name}</span>
        <span style="flex-shrink:0;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;
          text-transform:uppercase;background:${sc}1a;color:${sc};border:1px solid ${sc}40;white-space:nowrap">
          ${loc.status}</span>
      </div>
      <p style="font-size:11px;color:#8fb4d4;margin:0 0 4px;line-height:1.6">${loc.details}</p>
      ${bar}${chips}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #1e3a52;
        display:flex;align-items:center;gap:6px;font-size:11px;color:#5d8aaa">
        <span>📞</span><span style="color:#93c5fd">${loc.phone}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared map-building helpers (called for both regions)
// ─────────────────────────────────────────────────────────────────────────────

/** Render roads GeoJSON into a layer group using casing+fill for highways */
function buildRoadsGroup(
  map: L.Map,
  geojson: GeoJSON.FeatureCollection,
  pane: string,
): L.LayerGroup {
  const group = L.layerGroup();
  geojson.features.forEach(f => {
    const p = f.properties as { name:string; width:string };
    const isHwy = p.width === 'primary';
    const isSec = p.width === 'secondary';
    if (isHwy) {
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color:'#0f2a3d', weight:7, opacity:0.9, lineCap:'round', lineJoin:'round' },
      }).addTo(group);
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color:C.highway, weight:4, opacity:1, lineCap:'round', lineJoin:'round' },
      })
      .bindTooltip(`<div class="tt-row"><span class="tt-hwy">HWY</span>${p.name}</div>`,
        { sticky:true, className:'map-tt', direction:'top' })
      .addTo(group);
    } else if (isSec) {
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color:C.majorRoad, weight:2.5, opacity:0.85, lineCap:'round', lineJoin:'round' },
      })
      .bindTooltip(`<div class="tt-row">${p.name}</div>`,
        { sticky:true, className:'map-tt', direction:'top' })
      .addTo(group);
    } else {
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color:C.minorRoad, weight:1.5, opacity:0.7, dashArray:'5 4',
                     lineCap:'round', lineJoin:'round' },
      })
      .bindTooltip(`<div class="tt-row">${p.name}</div>`,
        { sticky:true, className:'map-tt', direction:'top' })
      .addTo(group);
    }
  });
  return group;
}

/** Render rivers GeoJSON with glow casing */
function buildRiversGroup(
  map: L.Map,
  geojson: GeoJSON.FeatureCollection,
  pane: string,
): L.LayerGroup {
  const group = L.layerGroup();
  geojson.features.forEach(f => {
    const p = f.properties as { name:string; type:string };
    const isStream = p.type === 'stream' || p.type === 'wetland';
    if (!isStream) {
      L.geoJSON(f as GeoJSON.Feature, {
        pane, style:{ color:'#0369a1', weight:6, opacity:0.3, lineCap:'round' },
      }).addTo(group);
    }
    L.geoJSON(f as GeoJSON.Feature, {
      pane, style:{
        color: isStream ? C.stream : C.river,
        weight: isStream ? 1.5 : 3, opacity: isStream ? 0.7 : 0.95,
        dashArray: isStream ? '4 4' : undefined, lineCap:'round',
      },
    })
    .bindTooltip(
      `<div class="tt-row"><span class="tt-dot" style="background:#38bdf8"></span>${p.name}</div>`,
      { sticky:true, className:'map-tt', direction:'top' },
    )
    .addTo(group);
  });
  return group;
}

/** Render flood / hazard polygon zones */
function buildFloodGroup(
  map: L.Map,
  geojson: GeoJSON.FeatureCollection,
  pane: string,
): L.LayerGroup {
  const group = L.layerGroup();
  geojson.features.forEach(f => {
    const p = f.properties as { name:string; severity:string; description:string };
    const col = p.severity==='critical'?C.floodCrit : p.severity==='high'?C.floodHigh : C.floodMod;
    L.geoJSON(f as GeoJSON.Feature, {
      pane, style:{ color:col, fillColor:col, fillOpacity:0.18, weight:1.5, opacity:0.65, dashArray:'8 5' },
    })
    .bindTooltip(
      `<div class="tt-row"><span class="tt-dot" style="background:${col}"></span>
       <b>Flood Zone · ${p.severity.toUpperCase()}</b></div>${p.name}
       <div class="tt-sub">${(p.description||'').slice(0,80)}…</div>`,
      { sticky:true, className:'map-tt map-tt-wide', direction:'top' },
    )
    .addTo(group);
  });
  return group;
}

/** Place label DivIcon markers, zoom-gated */
function buildPlaceLabels(
  map: L.Map,
  labels: import('@/data/joshimath-map-data').PlaceLabel[],
  pane: string,
): L.LayerGroup {
  const group = L.layerGroup();
  type LS = { fontSize:number; fontWeight:string; color:string; subColor:string; subSize:number;
               bg:string; border:string; radius:number; px:number; py:number;
               shadowBlur:number; shadowColor:string; letterSpacing:string;
               iconChar?:string; iconColor?:string; };
  const TS: Record<string,LS> = {
    city:      { fontSize:14, fontWeight:'800', color:'#f1f5f9', subColor:'#64a8cc', subSize:9.5,
                 bg:'rgba(10,22,36,0.82)', border:'1px solid rgba(59,130,246,0.4)',
                 radius:6, px:7, py:3, shadowBlur:12, shadowColor:'rgba(0,0,0,0.8)', letterSpacing:'0.02em' },
    town:      { fontSize:11.5, fontWeight:'700', color:'#e2e8f0', subColor:'#5d8aaa', subSize:9,
                 bg:'rgba(10,22,36,0.75)', border:'1px solid rgba(45,95,130,0.35)',
                 radius:5, px:6, py:2.5, shadowBlur:8, shadowColor:'rgba(0,0,0,0.7)', letterSpacing:'0.01em' },
    village:   { fontSize:10, fontWeight:'600', color:'#cbd5e1', subColor:'#4a6a82', subSize:8.5,
                 bg:'rgba(10,22,36,0.65)', border:'1px solid rgba(35,70,100,0.3)',
                 radius:4, px:5, py:2, shadowBlur:6, shadowColor:'rgba(0,0,0,0.6)', letterSpacing:'0em' },
    locality:  { fontSize:9.5, fontWeight:'600', color:'#94a3b8', subColor:'#3a5a72', subSize:8,
                 bg:'rgba(10,22,36,0.60)', border:'1px solid rgba(30,58,82,0.25)',
                 radius:4, px:5, py:2, shadowBlur:4, shadowColor:'rgba(0,0,0,0.5)', letterSpacing:'0em' },
    landmark:  { fontSize:10, fontWeight:'600', color:'#fbbf24', subColor:'#78716c', subSize:8.5,
                 bg:'rgba(10,18,28,0.72)', border:'1px solid rgba(251,191,36,0.25)',
                 radius:4, px:5, py:2, shadowBlur:6, shadowColor:'rgba(0,0,0,0.6)', letterSpacing:'0em',
                 iconChar:'◆', iconColor:'#fbbf24' },
    confluence:{ fontSize:10, fontWeight:'700', color:'#38bdf8', subColor:'#0e4a6a', subSize:8.5,
                 bg:'rgba(7,18,28,0.72)', border:'1px solid rgba(56,189,248,0.3)',
                 radius:4, px:5, py:2, shadowBlur:6, shadowColor:'rgba(0,0,0,0.6)', letterSpacing:'0em',
                 iconChar:'~', iconColor:'#38bdf8' },
    pass:      { fontSize:10, fontWeight:'600', color:'#a3b4c2', subColor:'#4a6070', subSize:8.5,
                 bg:'rgba(10,20,30,0.65)', border:'1px solid rgba(80,110,140,0.25)',
                 radius:4, px:5, py:2, shadowBlur:5, shadowColor:'rgba(0,0,0,0.55)', letterSpacing:'0.02em',
                 iconChar:'▲', iconColor:'#a3b4c2' },
    glacier:   { fontSize:10, fontWeight:'600', color:'#bae6fd', subColor:'#1a4a60', subSize:8.5,
                 bg:'rgba(8,18,28,0.70)', border:'1px solid rgba(186,230,253,0.25)',
                 radius:4, px:5, py:2, shadowBlur:5, shadowColor:'rgba(0,0,0,0.55)', letterSpacing:'0em',
                 iconChar:'❄', iconColor:'#bae6fd' },
  };
  labels.forEach(place => {
    const st = TS[place.tier] ?? TS.village;
    const minZ = place.minZoom ?? 10;
    const iconPart = st.iconChar ? `<span style="margin-right:4px;font-size:${st.fontSize-2}px;color:${st.iconColor}">${st.iconChar}</span>` : '';
    const subPart  = place.subtext ? `<div style="font-size:${st.subSize}px;color:${st.subColor};margin-top:1px;line-height:1.2;font-weight:500">${place.subtext}</div>` : '';
    const dotPart  = (place.tier==='city'||place.tier==='town')
      ? `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${place.tier==='city'?'#3b82f6':'#475569'};margin-right:5px;vertical-align:middle;flex-shrink:0"></span>` : '';
    const html = `<div style="display:inline-flex;flex-direction:column;align-items:flex-start;
      background:${st.bg};border:${st.border};border-radius:${st.radius}px;padding:${st.py}px ${st.px}px;
      box-shadow:0 2px ${st.shadowBlur}px ${st.shadowColor};backdrop-filter:blur(6px);
      pointer-events:none;user-select:none;white-space:nowrap;">
      <div style="display:flex;align-items:center;line-height:1.25">${dotPart}${iconPart}
        <span style="font-family:'Inter',system-ui,sans-serif;font-size:${st.fontSize}px;
          font-weight:${st.fontWeight};color:${st.color};letter-spacing:${st.letterSpacing}">${place.name}</span>
      </div>${subPart}</div>`;
    const icon = L.divIcon({ html, className:`place-label place-label-${place.tier}`,
      iconSize:undefined as unknown as L.PointExpression, iconAnchor:[0,0] });
    const marker = L.marker(place.coords, { icon, pane,
      zIndexOffset:place.tier==='city'?1000:place.tier==='town'?500:0,
      interactive:false, keyboard:false });
    marker.addTo(group);
    map.on('zoomend', () => { const el=marker.getElement(); if(el) el.style.display=map.getZoom()>=minZ?'':'none'; });
    marker.once('add', () => { const el=marker.getElement(); if(el) el.style.display=map.getZoom()>=minZ?'':'none'; });
  });
  return group;
}

/** Road name badge labels */
function buildRoadLabels(
  map: L.Map,
  roadLabels: import('@/data/joshimath-map-data').RoadLabel[],
  pane: string,
): L.LayerGroup {
  const group = L.layerGroup();
  roadLabels.forEach(rl => {
    const isHwy = rl.type==='highway';
    const isSec = rl.type==='secondary';
    const bg    = isHwy?'rgba(12,42,62,0.92)':isSec?'rgba(10,28,46,0.88)':'rgba(8,22,36,0.82)';
    const border= isHwy?'1px solid rgba(200,212,232,0.5)':isSec?'1px solid rgba(143,163,188,0.4)':'1px solid rgba(92,112,128,0.35)';
    const color = isHwy?C.highway:isSec?C.majorRoad:C.minorRoad;
    const shield = isHwy
      ? `<span style="display:inline-flex;align-items:center;justify-content:center;
          background:rgba(59,130,246,0.25);border:1px solid rgba(59,130,246,0.4);
          border-radius:3px;padding:0 4px;margin-right:4px;
          font-size:9px;font-weight:800;color:#93c5fd;line-height:1.4">${rl.short}</span>` : '';
    const label = isHwy?'': `<span style="font-size:${isSec?10:9}px;color:${color};font-weight:${isHwy?'700':'600'}">${rl.short}</span>`;
    const html = `<div style="display:inline-flex;align-items:center;background:${bg};border:${border};
      border-radius:4px;padding:2px 6px;box-shadow:0 1px 6px rgba(0,0,0,0.5);backdrop-filter:blur(4px);
      pointer-events:none;user-select:none;white-space:nowrap;
      transform:rotate(${rl.rotation??0}deg);font-family:'Inter',system-ui,sans-serif;">
      ${shield}${label}</div>`;
    const icon = L.divIcon({ html, className:'road-label',
      iconSize:undefined as unknown as L.PointExpression, iconAnchor:[0,0] });
    const marker = L.marker(rl.coords, { icon, pane, interactive:false, keyboard:false });
    const minZ = rl.minZoom??12;
    marker.addTo(group);
    map.on('zoomend', ()=>{ const el=marker.getElement(); if(el) el.style.display=map.getZoom()>=minZ?'':'none'; });
    marker.once('add', ()=>{ const el=marker.getElement(); if(el) el.style.display=map.getZoom()>=minZ?'':'none'; });
  });
  return group;
}

/** Famous POI icon markers */
function buildPoisGroup(
  map: L.Map,
  pois: import('@/data/joshimath-map-data').FamousPoi[],
  pane: string,
): L.LayerGroup {
  const IC: Record<string,{sym:string;bg:string;border:string;textColor:string}> = {
    temple:        {sym:'🛕',bg:'rgba(146,64,14,0.85)',  border:'rgba(217,119,6,0.7)',  textColor:'#fde68a'},
    gurudwara:     {sym:'🏯',bg:'rgba(3,84,63,0.85)',    border:'rgba(6,182,212,0.5)',  textColor:'#a7f3d0'},
    government:    {sym:'🏛',bg:'rgba(5,46,22,0.85)',    border:'rgba(34,197,94,0.5)',  textColor:'#86efac'},
    school:        {sym:'🏫',bg:'rgba(7,89,133,0.85)',   border:'rgba(56,189,248,0.5)', textColor:'#bae6fd'},
    market:        {sym:'🏪',bg:'rgba(66,32,6,0.85)',    border:'rgba(234,179,8,0.5)',  textColor:'#fef08a'},
    hotel:         {sym:'🏨',bg:'rgba(30,27,75,0.85)',   border:'rgba(139,92,246,0.5)', textColor:'#ddd6fe'},
    infrastructure:{sym:'⚡',bg:'rgba(30,27,30,0.85)',   border:'rgba(161,161,170,0.5)',textColor:'#d4d4d8'},
    viewpoint:     {sym:'🔭',bg:'rgba(5,46,22,0.85)',    border:'rgba(52,211,153,0.5)', textColor:'#6ee7b7'},
    bus_stand:     {sym:'🚌',bg:'rgba(12,74,110,0.85)',  border:'rgba(14,165,233,0.5)', textColor:'#7dd3fc'},
    bank:          {sym:'🏦',bg:'rgba(5,46,22,0.85)',    border:'rgba(34,197,94,0.5)',  textColor:'#86efac'},
    post_office:   {sym:'📮',bg:'rgba(127,29,29,0.85)',  border:'rgba(248,113,113,0.5)',textColor:'#fca5a5'},
    locality:      {sym:'📍',bg:'rgba(30,40,60,0.85)',   border:'rgba(100,130,180,0.5)',textColor:'#93c5fd'},
  };
  const group = L.layerGroup();
  pois.forEach(poi => {
    const ic = IC[poi.category] ?? IC.government;
    const minZ = poi.minZoom??13;
    const iconHtml = `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
      <div style="width:28px;height:28px;border-radius:8px;background:${ic.bg};border:1.5px solid ${ic.border};
        display:flex;align-items:center;justify-content:center;font-size:14px;
        box-shadow:0 3px 10px rgba(0,0,0,0.55);">${ic.sym}</div>
      <div style="margin-top:2px;background:rgba(8,18,30,0.88);border:1px solid rgba(30,58,82,0.5);
        border-radius:3px;padding:1px 5px;font-family:'Inter',system-ui,sans-serif;
        font-size:8.5px;font-weight:600;color:${ic.textColor};white-space:nowrap;
        max-width:90px;overflow:hidden;text-overflow:ellipsis;">${poi.name}</div>
    </div>`;
    const popup = `<div style="width:230px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:32px;height:32px;border-radius:8px;background:${ic.bg};border:1.5px solid ${ic.border};
          display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">${ic.sym}</div>
        <div><p style="font-size:13px;font-weight:700;color:#f1f5f9;margin:0;line-height:1.3">${poi.name}</p>
          <p style="font-size:10px;color:${ic.textColor};margin:0;text-transform:capitalize">${poi.category.replace('_',' ')}</p>
        </div></div>
      ${poi.address?`<p style="font-size:10px;color:#64748b;margin:0 0 6px">📍 ${poi.address}</p>`:''}
      <p style="font-size:11px;color:#8fb4d4;margin:0 0 8px;line-height:1.6">${poi.note}</p>
      ${poi.phone&&poi.phone!=='—'?`<div style="padding-top:8px;border-top:1px solid #1e3a52;
        display:flex;align-items:center;gap:6px;font-size:11px;color:#5d8aaa">
        <span>📞</span><span style="color:#93c5fd">${poi.phone}</span></div>`:''}
    </div>`;
    const marker = L.marker(poi.coords, {
      icon:L.divIcon({html:iconHtml,className:'poi-marker',iconSize:[28,46],iconAnchor:[14,28],popupAnchor:[0,-32]}),
      pane, zIndexOffset:100,
    }).bindPopup(popup,{className:'map-popup',maxWidth:260});
    marker.addTo(group);
    map.on('zoomend',()=>{const el=marker.getElement();if(el)el.style.display=map.getZoom()>=minZ?'':'none';});
    marker.once('add',()=>{const el=marker.getElement();if(el)el.style.display=map.getZoom()>=minZ?'':'none';});
  });
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// MapView component
// ─────────────────────────────────────────────────────────────────────────────
export function MapView({ requests, isOnline, selectedId, onSelect, region }: MapViewProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<L.Map | null>(null);
  const groupsRef      = useRef<Record<string, L.LayerGroup>>({});
  const reqMarkersRef  = useRef<Record<string, L.Marker>>({});
  const gpsMarkerRef   = useRef<L.Marker | null>(null);

  // Region state is now controlled from outside — no local region state
  const [_regionMenuOpen, _setRegionMenuOpen] = useState(false); // kept for future use

  // Layer / UI state
  const [layers,       setLayers]       = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [legendOpen,   setLegendOpen]   = useState(true);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchResults,setSearchResults]= useState<SearchEntry[]>([]);
  const [selLoc,       setSelLoc]       = useState<EmergencyLocation | null>(null);
  const [gpsActive,    setGpsActive]    = useState(false);
  const [gpsError,     setGpsError]     = useState<string | null>(null);

  const rmeta = REGION_META[region];

  // ── Core map initialiser — re-runs when `region` changes ─────────────────
  useEffect(() => {
    // Destroy existing map instance
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    groupsRef.current  = {};
    reqMarkersRef.current = {};
    gpsMarkerRef.current  = null;
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: rmeta.center, zoom: rmeta.zoom,
      minZoom: rmeta.zoomMin, maxZoom: rmeta.zoomMax,
      zoomControl:false, attributionControl:false,
      preferCanvas:true,
    });

    containerRef.current.style.background =
      `radial-gradient(ellipse at 60% 40%, ${C.bgHill} 0%, ${C.bgMid} 45%, ${C.bgDeep} 100%)`;

    // Topo texture overlay (local SVG — no network)
    const terrainSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <pattern id="topo" width="80" height="80" patternUnits="userSpaceOnUse">
          <ellipse cx="40" cy="40" rx="36" ry="22" fill="none" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>
          <ellipse cx="40" cy="40" rx="24" ry="14" fill="none" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>
        </pattern>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0L0 0 0 40" fill="none" stroke="#ffffff" stroke-width="0.25" opacity="0.025"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)"/>
      <rect width="100%" height="100%" fill="url(#topo)"/>
    </svg>`;
    const terrainPane = map.createPane('terrain');
    terrainPane.style.zIndex = '100';
    terrainPane.style.pointerEvents = 'none';
    L.svgOverlay(
      new DOMParser().parseFromString(terrainSvg,'image/svg+xml').documentElement as unknown as SVGElement,
      map.getBounds().pad(10),
      { pane:'terrain', interactive:false, opacity:1 },
    ).addTo(map);

    // Custom z-ordered panes
    const hazardPane = map.createPane('hazard'); hazardPane.style.zIndex = '200';
    const bldPane    = map.createPane('buildings'); bldPane.style.zIndex = '280';
    const roadPane   = map.createPane('road');   roadPane.style.zIndex  = '300';
    const waterPane  = map.createPane('water');  waterPane.style.zIndex = '310';
    const rlPane     = map.createPane('roadLabels'); rlPane.style.zIndex= '320'; rlPane.style.pointerEvents='none';
    const labPane    = map.createPane('labels'); labPane.style.zIndex   = '350'; labPane.style.pointerEvents='none';
    const poiPane    = map.createPane('pois');   poiPane.style.zIndex   = '390';
    const mrkPane    = map.createPane('markerLayer'); mrkPane.style.zIndex='400';

    L.control.attribution({prefix:false})
      .addAttribution(`<span style="opacity:.4">Offline · ${rmeta.label}</span>`)
      .addTo(map);

    // ── Roads ──
    const roadsGroup = buildRoadsGroup(map, region==='ncr' ? NCR_ROADS_GEOJSON : ROADS_GEOJSON, 'road');

    // ── Rivers ──
    const riversGroup = buildRiversGroup(map, region==='ncr' ? NCR_RIVERS_GEOJSON : RIVERS_GEOJSON, 'water');

    // ── Flood zones ──
    const floodsGroup = buildFloodGroup(map, region==='ncr' ? NCR_FLOOD_ZONES_GEOJSON : FLOOD_ZONES_GEOJSON, 'hazard');

    // ── Badrinath-only hazard layers ──
    const landslidesGroup = L.layerGroup();
    const safeGroup       = L.layerGroup();
    if (region === 'badrinath') {
      LANDSLIDE_ZONES_GEOJSON.features.forEach(f => {
        const p = f.properties as {name:string;severity:string;description:string};
        const col = p.severity==='critical'?C.slideCrit:p.severity==='high'?C.slideHigh:C.slideMod;
        L.geoJSON(f as GeoJSON.Feature, {
          pane:'hazard', style:{color:col,fillColor:col,fillOpacity:0.22,weight:2,opacity:0.8},
        })
        .bindTooltip(`<div class="tt-row"><span class="tt-dot" style="background:${col}"></span>
          <b>Landslide · ${p.severity.toUpperCase()}</b></div>${p.name}
          <div class="tt-sub">${p.description.slice(0,80)}…</div>`,
          {sticky:true,className:'map-tt map-tt-wide',direction:'top'})
        .addTo(landslidesGroup);
      });
      SAFE_ZONES_GEOJSON.features.forEach(f => {
        const p = f.properties as {name:string;description:string;capacity:number};
        L.geoJSON(f as GeoJSON.Feature, {
          pane:'hazard', style:{color:C.safe,fillColor:C.safe,fillOpacity:0.12,weight:1.5,opacity:0.7,dashArray:'6 4'},
        })
        .bindTooltip(`<div class="tt-row"><span class="tt-dot" style="background:#16a34a"></span>
          <b>Safe Zone</b></div>${p.name}`,
          {sticky:true,className:'map-tt',direction:'top'})
        .addTo(safeGroup);
      });
    }

    // ── Emergency markers (Badrinath only) ──
    const sheltersGroup  = L.layerGroup();
    const hospitalsGroup = L.layerGroup();
    const responseGroup  = L.layerGroup();
    const risksGroup     = L.layerGroup();
    if (region === 'badrinath') {
      const addM = (locs: EmergencyLocation[], icon: L.DivIcon, grp: L.LayerGroup) =>
        locs.forEach(loc => L.marker(loc.coords,{icon,pane:'markerLayer',zIndexOffset:200})
          .bindPopup(buildPopupHtml(loc),{className:'map-popup',maxWidth:280}).addTo(grp));
      addM(EMERGENCY_SHELTERS, ICONS.shelter,  sheltersGroup);
      addM(HOSPITALS,          ICONS.hospital, hospitalsGroup);
      addM(EMERGENCY_RESPONSE, ICONS.response, responseGroup);
      addM(DISASTER_MARKERS,   ICONS.risk,     risksGroup);
    }

    // ── Building footprints (Badrinath only) ──
    const buildingsGroup = L.layerGroup();
    if (region === 'badrinath') {
      const BLD_COLORS: Record<string,{fill:string;stroke:string}> = {
        residential:{fill:'#1a3a5c',stroke:'#2a5a82'},government:{fill:'#1a3a2c',stroke:'#2a6a4a'},
        commercial:{fill:'#2a2a10',stroke:'#6a5a1a'},religious:{fill:'#2a1a08',stroke:'#b45309'},
        educational:{fill:'#0a2a3a',stroke:'#1e6a8a'},medical:{fill:'#1a0808',stroke:'#dc2626'},
        military:{fill:'#101a10',stroke:'#4a7a4a'},utility:{fill:'#1a1a2a',stroke:'#4a4a8a'},
      };
      type BP={id:string;name:string;type:string;floors?:number;note?:string;cracked?:boolean};
      BUILDINGS_GEOJSON.features.forEach(f => {
        const p=f.properties as BP;
        const col=BLD_COLORS[p.type]??{fill:'#1a2a3a',stroke:'#3a5a72'};
        const crack=p.cracked===true;
        L.geoJSON(f as GeoJSON.Feature,{pane:'buildings',style:{
          fillColor:crack?'#7c2020':col.fill,color:crack?'#ef4444':col.stroke,
          weight:crack?1.5:1,fillOpacity:0.75,opacity:1,dashArray:crack?'4 2':undefined,
        }})
        .bindTooltip(`<div class="tt-row"><span class="tt-dot" style="background:${crack?'#ef4444':col.stroke}"></span>
          <b>${p.name}</b></div>
          <div style="font-size:10px;color:#5d8aaa;margin-top:2px">${p.type}${p.floors?' · '+p.floors+' fl':''}</div>
          ${crack?'<div style="margin-top:5px;padding:3px 7px;background:#7c202060;border:1px solid #ef444460;border-radius:4px;font-size:10px;color:#ef4444;font-weight:700">⚠ CRACKED</div>':''}
          <div class="tt-sub">${p.note??''}</div>`,
          {sticky:true,className:'map-tt map-tt-wide',direction:'top'})
        .addTo(buildingsGroup);
      });
      map.on('zoomend',()=>{ const el=map.getPane('buildings'); if(el)el.style.display=map.getZoom()>=13?'':'none'; });
      const bpe=map.getPane('buildings'); if(bpe)bpe.style.display=map.getZoom()>=13?'':'none';
    }

    // ── Place labels ──
    const pl = region==='ncr' ? NCR_PLACE_LABELS : PLACE_LABELS;
    const labelsGroup = buildPlaceLabels(map, pl, 'labels');

    // ── Road labels ──
    const rl = region==='ncr' ? NCR_ROAD_LABELS : ROAD_LABELS;
    const roadLabelsGroup = buildRoadLabels(map, rl, 'roadLabels');

    // ── POI markers ──
    const pm = region==='ncr' ? NCR_FAMOUS_POIS : FAMOUS_POIS;
    const poisGroup = buildPoisGroup(map, pm, 'pois');

    // ── Aid request markers (empty — filled by separate effect) ──
    const requestsGroup = L.layerGroup();

    groupsRef.current = {
      safeZones:safeGroup, floods:floodsGroup, landslides:landslidesGroup,
      roads:roadsGroup, rivers:riversGroup,
      shelters:sheltersGroup, hospitals:hospitalsGroup,
      response:responseGroup, risks:risksGroup, requests:requestsGroup,
      labels:labelsGroup, roadLabels:roadLabelsGroup,
      buildings:buildingsGroup, pois:poisGroup,
    };
    Object.values(groupsRef.current).forEach(g => g.addTo(map));

    // Honour current layer visibility state
    Object.entries(layers).forEach(([key,on]) => {
      const g = groupsRef.current[key];
      if (!g) return;
      if (!on) map.removeLayer(g);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [region]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aid-request markers (region-aware coords) ───────────────────────────
  useEffect(() => {
    const map   = mapRef.current;
    const group = groupsRef.current['requests'];
    if (!map || !group) return;
    Object.values(reqMarkersRef.current).forEach(m => m.remove());
    reqMarkersRef.current = {};
    const center = rmeta.center;
    requests.forEach(r => {
      const meta   = CATEGORY_META[r.category];
      const isCrit = r.priority==='critical';
      const isSel  = selectedId===r.id;
      const fill   = isCrit?'#dc2626':meta.color==='warning'?'#f59e0b':meta.color==='info'?'#3b82f6':'#16a34a';
      const sym    = r.category==='medical'?'✚':r.category==='rescue'?'⛑':r.category==='food'?'💧':r.category==='shelter'?'⛺':'👥';
      const sz     = isSel?42:34;
      const pulse  = isCrit
        ? `<circle cx="${sz/2}" cy="${sz/2}" r="${sz/2-2}" fill="${fill}" opacity="0">
            <animate attributeName="r" values="${sz/2-2};${sz/2+6}" dur="1.4s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.4;0" dur="1.4s" repeatCount="indefinite"/></circle>` : '';
      const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sz} ${sz+8}" width="${sz}" height="${sz+8}">
        <defs><filter id="sh${r.id}" x="-40%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="${isSel?0.7:0.45}"/></filter></defs>
        ${pulse}
        <path d="M${sz/2} 1C${sz/2-8.5} 1 ${sz/2-14} ${sz/2-8} ${sz/2-14} ${sz/2}
                 c0 ${sz*0.3} ${sz/2-1} ${sz*0.54} ${sz/2-1} ${sz*0.54}
                 s${sz/2-1}-${sz*0.24} ${sz/2-1}-${sz*0.54}
                 C${sz/2+14} ${sz/2-8} ${sz/2+8.5} 1 ${sz/2} 1z"
              fill="${fill}" filter="url(#sh${r.id})"
              stroke="${isSel?'#fff':'rgba(255,255,255,0.3)'}" stroke-width="${isSel?2:1}"/>
        <text x="${sz/2}" y="${sz/2+4}" text-anchor="middle" dominant-baseline="middle"
              font-size="${sz*0.35}" fill="white" font-weight="700">${sym}</text></svg>`;
      const icon = L.divIcon({ html:iconSvg, className:'',
        iconSize:[sz,sz+8], iconAnchor:[sz/2,sz+8], popupAnchor:[0,-(sz+4)] });
      const marker = L.marker(
        [center[0]+(r.coords.y-50)*0.0012, center[1]+(r.coords.x-50)*0.0012],
        { icon, pane:'markerLayer', zIndexOffset:isSel?2000:500 },
      );
      const meta2 = CATEGORY_META[r.category];
      marker.bindPopup(
        `<div style="width:230px;font-family:'Inter',system-ui,sans-serif;color:#e2e8f0;line-height:1.5">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;
              text-transform:uppercase;background:${fill}20;color:${fill};border:1px solid ${fill}40">${meta2.label}</span>
            <span style="font-size:10px;color:#64748b">${r.distanceMiles}mi${r.peopleCount>0?' · '+r.peopleCount+' people':''}</span>
          </div>
          <p style="font-size:13px;font-weight:700;color:#f1f5f9;margin:0 0 4px">${r.title}</p>
          <p style="font-size:11px;color:#8fb4d4;margin:0 0 8px;line-height:1.6">${r.details}</p>
          ${r.items.length>0?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
            ${r.items.map(i=>`<span style="background:#162840;border:1px solid #2a4a68;border-radius:5px;padding:2px 7px;font-size:10px;color:#93c5fd">${i}</span>`).join('')}</div>`:''}
          <div style="padding-top:8px;border-top:1px solid #1e3a52;font-size:11px;color:#5d8aaa">📞 ${r.contactPhone}</div>
        </div>`,
        { className:'map-popup', maxWidth:260 },
      );
      marker.on('click',()=>onSelect(r.id));
      marker.addTo(group);
      reqMarkersRef.current[r.id] = marker;
    });
  }, [requests, selectedId, onSelect, region]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan to selected request ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const r = requests.find(req=>req.id===selectedId); if(!r) return;
    const center = rmeta.center;
    mapRef.current.panTo([center[0]+(r.coords.y-50)*0.0012, center[1]+(r.coords.x-50)*0.0012]);
  }, [selectedId, requests]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layer toggle ─────────────────────────────────────────────────────────
  const toggleLayer = useCallback((key: keyof LayerVisibility) => {
    const map  = mapRef.current;
    const grp  = groupsRef.current[key];
    if (!map || !grp) return;
    setLayers(prev => {
      const next = { ...prev, [key]:!prev[key] };
      next[key] ? grp.addTo(map) : map.removeLayer(grp);
      return next;
    });
  }, []);

  // ── GPS (works in both regions) ──────────────────────────────────────────
  const handleGps = useCallback(() => {
    const map = mapRef.current; if(!map) return;
    setGpsError(null);
    if (!navigator.geolocation) { setGpsError('GPS unavailable on this device'); return; }
    setGpsActive(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        if (gpsMarkerRef.current) gpsMarkerRef.current.remove();
        gpsMarkerRef.current = L.marker([latitude,longitude],{icon:ICONS.gps})
          .bindPopup(
            `<b style="color:#93c5fd">Your Location</b><br>
             <span style="font-size:11px;color:#94a3b8">${latitude.toFixed(5)}°N, ${longitude.toFixed(5)}°E</span>`,
            {className:'map-popup'},
          ).addTo(map).openPopup();
        map.setView([latitude,longitude],15);
        setGpsActive(false);
      },
      err => { setGpsError(err.message); setGpsActive(false); },
      { enableHighAccuracy:true, timeout:10000 },
    );
  }, []);

  const handleRecenter = useCallback(() => mapRef.current?.setView(rmeta.center, rmeta.zoom), [rmeta]);
  const handleZoomIn   = useCallback(() => mapRef.current?.zoomIn(),  []);
  const handleZoomOut  = useCallback(() => mapRef.current?.zoomOut(), []);

  // ── Offline search ───────────────────────────────────────────────────────
  const activeIndex = region==='ncr' ? NCR_SEARCH_INDEX : SEARCH_INDEX;

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.trim().length<2) { setSearchResults([]); return; }
    const lc = q.toLowerCase();
    setSearchResults(activeIndex.filter(e=>
      e.name.toLowerCase().includes(lc)||e.type.toLowerCase().includes(lc)
    ).slice(0,8));
  }, [activeIndex]);

  const flyTo = useCallback((entry: SearchEntry) => {
    mapRef.current?.setView(entry.coords,14);
    setSearchOpen(false); setSearchQuery(''); setSearchResults([]);
    if (region==='badrinath') {
      const loc=[...EMERGENCY_SHELTERS,...HOSPITALS,...EMERGENCY_RESPONSE,...DISASTER_MARKERS]
        .find(l=>l.id===entry.id);
      if(loc) setSelLoc(loc);
    }
  }, [region]);

  // ── Region switch — no longer needed here (handled in StatusBanner) ───────

  // ── Layer defs for legend ────────────────────────────────────────────────
  type LayerDef = { key: keyof LayerVisibility; label:string; color:string; group:string };
  const layerDefs: LayerDef[] = [
    { key:'roads',      label:'Roads & Highways', color:'#c8d4e8', group:'base'     },
    { key:'rivers',     label:'Rivers & Water',   color:'#38bdf8', group:'base'     },
    { key:'labels',     label:'Place Names',      color:'#94a3b8', group:'base'     },
    { key:'buildings',  label:'Buildings',        color:'#2a5a82', group:'base'     },
    { key:'pois',       label:'Famous Locations', color:'#fbbf24', group:'base'     },
    { key:'floods',     label:'Flood Zones',      color:'#2563eb', group:'hazard'   },
    ...(region==='badrinath' ? [
      { key:'landslides' as keyof LayerVisibility, label:'Landslide Risk', color:'#f97316', group:'hazard' },
      { key:'safeZones'  as keyof LayerVisibility, label:'Safe Zones',     color:'#16a34a', group:'hazard' },
    ] : []),
    { key:'shelters',   label:'Shelters',         color:'#2563eb', group:'location' },
    { key:'hospitals',  label:'Hospitals',        color:'#dc2626', group:'location' },
    { key:'response',   label:'Response Posts',   color:'#d97706', group:'location' },
    { key:'risks',      label:'Risk Markers',     color:'#b91c1c', group:'location' },
    { key:'requests',   label:'Aid Requests',     color:'#a855f7', group:'location' },
  ];
  const grouped = {
    base:     layerDefs.filter(l=>l.group==='base'),
    hazard:   layerDefs.filter(l=>l.group==='hazard'),
    location: layerDefs.filter(l=>l.group==='location'),
  };

  // Quick hazard toggles (toolbar)
  type QT = { key: keyof LayerVisibility; icon: React.ReactNode; label: string; color: string };
  const quickToggles: QT[] = [
    { key:'floods', icon:<Droplets className="h-3.5 w-3.5"/>, label:'Flood', color:'#2563eb' },
    ...(region==='badrinath' ? [
      { key:'landslides' as keyof LayerVisibility, icon:<TriangleAlert className="h-3.5 w-3.5"/>, label:'Slide', color:'#f97316' },
      { key:'safeZones'  as keyof LayerVisibility, icon:<ShieldCheck   className="h-3.5 w-3.5"/>, label:'Safe',  color:'#16a34a' },
    ] : []),
  ];

  const coordLine = region==='ncr'
    ? '28.5500°N 77.2500°E · Delhi NCR'
    : '30.5560°N 79.5640°E · Chamoli District';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border">

      {/* Leaflet map container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* ── TOP BAR ── */}
      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none flex items-start justify-between gap-2 px-2 pt-2 sm:px-3">

        {/* Title pill */}
        <div className="pointer-events-none flex items-center gap-2 rounded-lg
          border border-[#1e3a52] bg-[#0c1827]/90 px-3 py-1.5 shadow-xl backdrop-blur-md">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-alert/20 text-alert">
            <TriangleAlert className="h-3 w-3" />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-alert leading-none">
              Offline Disaster Map
            </p>
            <p className="text-[9px] text-[#5d8aaa] leading-none mt-0.5">
              {rmeta.sublabel}
            </p>
          </div>
        </div>

        {/* Right: offline badge + quick toggles */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
            'border shadow-md backdrop-blur-md',
            isOnline ? 'border-success/30 bg-success/10 text-success'
                     : 'border-warning/40 bg-[#0c1827]/90 text-warning',
          )}>
            {isOnline
              ? <><Wifi className="h-3 w-3"/><span>Online</span></>
              : <><WifiOff className="h-3 w-3"/><span>OFFLINE — Local Data</span>
                  <span className="relative ml-0.5 flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75"/>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning"/>
                  </span>
                </>
            }
          </div>

          {/* Quick hazard toggles */}
          {quickToggles.length > 0 && (
            <div className="flex items-center gap-1">
              {quickToggles.map(({ key, icon, label, color }) => (
                <button key={key} onClick={()=>toggleLayer(key)}
                  title={`${layers[key]?'Hide':'Show'} ${label}`}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold
                    border backdrop-blur-md shadow transition-all active:scale-95"
                  style={{
                    borderColor:layers[key]?color+'60':'#1e3a52',
                    background: layers[key]?color+'18':'#0c182790',
                    color:      layers[key]?color:'#4a6a82',
                  }}>
                  <span style={{color:layers[key]?color:'#4a6a82'}}>{icon}</span>{label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT TOOLBAR ── */}
      <div className="absolute right-2 sm:right-3 top-[72px] z-20 flex flex-col gap-1.5">
        <button onClick={handleZoomIn}  title="Zoom in"  className="map-ctrl-btn" aria-label="Zoom in">
          <span className="text-base font-bold leading-none text-foreground">+</span>
        </button>
        <button onClick={handleZoomOut} title="Zoom out" className="map-ctrl-btn" aria-label="Zoom out">
          <span className="text-base font-bold leading-none text-foreground">−</span>
        </button>
        <div className="my-0.5 h-px bg-border/50" />
        <button onClick={handleRecenter} title="Re-centre" className="map-ctrl-btn" aria-label="Re-centre">
          <Crosshair className="h-4 w-4 text-info" />
        </button>
        <button onClick={handleGps}
          title={gpsError ?? 'Locate me'}
          className={cn('map-ctrl-btn', gpsActive && 'border-info bg-info/15 animate-pulse')}
          aria-label="Locate me">
          <Locate className={cn('h-4 w-4', gpsActive ? 'text-info' : 'text-muted-foreground')} />
        </button>
        <div className="my-0.5 h-px bg-border/50" />
        <button onClick={()=>setSearchOpen(v=>!v)} title="Search"
          className={cn('map-ctrl-btn', searchOpen && 'border-info bg-info/15')} aria-label="Search">
          <Search className={cn('h-4 w-4', searchOpen ? 'text-info' : 'text-muted-foreground')} />
        </button>
        <button onClick={()=>setLegendOpen(v=>!v)} title="Legend"
          className={cn('map-ctrl-btn', legendOpen && 'border-info bg-info/15')} aria-label="Legend">
          <Layers className={cn('h-4 w-4', legendOpen ? 'text-info' : 'text-muted-foreground')} />
        </button>
      </div>

      {/* ── SEARCH PANEL ── */}
      {searchOpen && (
        <div className="absolute right-[3.25rem] sm:right-[3.5rem] top-[100px] z-30 w-64 sm:w-72
          rounded-xl border border-[#1e3a52] bg-[#0d1f33]/96 shadow-2xl backdrop-blur-xl
          animate-float-up overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#1e3a52] px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-[#4a6a82]" />
            <input autoFocus type="text"
              placeholder={region==='ncr' ? 'Delhi, Faridabad, Kabulpur…' : 'Shelters, hospitals…'}
              value={searchQuery}
              onChange={e=>handleSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-[#3a5a72] outline-none"
            />
            {searchQuery && (
              <button onClick={()=>handleSearch('')} className="text-[#4a6a82] hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchResults.length > 0 && (
            <ul className="max-h-56 overflow-y-auto divide-y divide-[#122033]">
              {searchResults.map(r => (
                <li key={r.id}>
                  <button onClick={()=>flyTo(r)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#162840] transition-colors">
                    <TypeBadge type={r.type} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{r.name}</p>
                      <p className="text-[10px] capitalize text-[#4a6a82]">{r.type.replace('_',' ')}</p>
                    </div>
                    <Navigation className="ml-auto h-3.5 w-3.5 shrink-0 text-[#2a4a68]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchQuery.length>=2 && searchResults.length===0 && (
            <p className="py-4 text-center text-xs text-[#4a6a82]">No results found</p>
          )}
          {!searchQuery && (
            <p className="px-3 py-2 text-[10px] text-[#3a5a72]">
              Type to search {activeIndex.length} locations
            </p>
          )}
        </div>
      )}

      {/* ── LEGEND ── */}
      {legendOpen && (
        <div className="absolute left-2 sm:left-3 top-[100px] z-20 w-52
          rounded-xl border border-[#1e3a52] bg-[#0d1f33]/96 shadow-2xl backdrop-blur-xl
          animate-float-up overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1e3a52] px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-info" />
              <span className="text-[11px] font-bold text-foreground">Map Layers</span>
            </div>
            <button onClick={()=>setLegendOpen(false)} className="text-[#4a6a82] hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2 space-y-3">
            <LayerGroupUI label="Base"      layers={grouped.base}     active={layers} onToggle={toggleLayer} />
            <LayerGroupUI label="Hazards"   layers={grouped.hazard}   active={layers} onToggle={toggleLayer} />
            <LayerGroupUI label="Locations" layers={grouped.location} active={layers} onToggle={toggleLayer} />
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-[#4a6a82]">Severity</p>
              <div className="space-y-1">
                <SeverityRow color="#dc2626" label="Critical" />
                <SeverityRow color="#f97316" label="High" />
                <SeverityRow color="#fbbf24" label="Moderate" />
                <SeverityRow color="#16a34a" label="Safe / Clear" />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-[#4a6a82]">Markers</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <MarkerKey color="#2563eb" sym="⛺" label="Shelter" />
                <MarkerKey color="#dc2626" sym="✚"  label="Hospital" />
                <MarkerKey color="#d97706" sym="★"  label="Response" />
                <MarkerKey color="#b91c1c" sym="!"  label="Risk Zone" />
                <MarkerKey color="#16a34a" sym="✓"  label="Safe Zone" />
                <MarkerKey color="#a855f7" sym="●"  label="Aid Request" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPS error */}
      {gpsError && (
        <div className="absolute bottom-16 right-2 z-30 flex items-center gap-2 rounded-lg
          border border-alert/30 bg-[#0c1827]/95 px-3 py-2 text-xs text-alert
          shadow-xl backdrop-blur-md animate-float-up">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[200px]">{gpsError}</span>
          <button onClick={()=>setGpsError(null)} className="ml-1 hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Selected location card (Badrinath only) */}
      {selLoc && (
        <div className="absolute inset-x-2 bottom-2 z-30 sm:inset-x-3 sm:bottom-3
          rounded-xl border border-[#1e3a52] bg-[#0d1f33]/97 shadow-2xl backdrop-blur-xl
          animate-float-up max-h-[55vh] overflow-y-auto">
          <button onClick={()=>setSelLoc(null)}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-[#4a6a82] hover:bg-[#162840] hover:text-foreground transition-colors"
            aria-label="Close"><X className="h-4 w-4" /></button>
          <LocDetail loc={selLoc} />
        </div>
      )}

      {/* Coordinate footer */}
      <div className="pointer-events-none absolute bottom-1 left-2 z-10 text-[9px] font-mono text-[#2a4a68]">
        {coordLine}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LayerGroupUI({
  label, layers, active, onToggle,
}: {
  label: string;
  layers: { key: keyof LayerVisibility; label: string; color: string }[];
  active: LayerVisibility;
  onToggle: (k: keyof LayerVisibility) => void;
}) {
  if (!layers.length) return null;
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#4a6a82]">{label}</p>
      <div className="space-y-0.5">
        {layers.map(({ key, label: lbl, color }) => (
          <button key={key} onClick={()=>onToggle(key)}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#162840] transition-colors">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: active[key] ? color : '#2a4a68' }} />
            <span className={cn('flex-1 text-left text-[11px] leading-tight',
              active[key] ? 'text-foreground' : 'text-[#3a5a72]')}>{lbl}</span>
            <span className={cn('h-3.5 w-3.5 shrink-0 rounded border text-[8px] font-bold flex items-center justify-center',
              active[key] ? 'border-info/50 bg-info/15 text-info' : 'border-[#1e3a52] text-[#2a4a68]')}>
              {active[key] ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SeverityRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-5 rounded-sm" style={{ background:color+'60', borderLeft:`3px solid ${color}` }} />
      <span className="text-[11px] text-[#8fb4d4]">{label}</span>
    </div>
  );
}

function MarkerKey({ color, sym, label }: { color: string; sym: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
        style={{ background:color+'30', color }}>{sym}</span>
      <span className="text-[10px] text-[#8fb4d4]">{label}</span>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const m: Record<string,{color:string;label:string}> = {
    shelter:{color:'#2563eb',label:'S'}, hospital:{color:'#dc2626',label:'H'},
    response:{color:'#d97706',label:'R'}, risk:{color:'#b91c1c',label:'!'},
    safe_zone:{color:'#16a34a',label:'✓'},
  };
  const t = m[type] ?? { color:'#64748b', label:'?' };
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
      style={{ background:t.color+'25', color:t.color }}>{t.label}</span>
  );
}

function LocDetail({ loc }: { loc: EmergencyLocation }) {
  const typeConf: Record<string,{icon:React.ReactNode;color:string}> = {
    hospital: { icon:<Hospital     className="h-4 w-4"/>, color:'#dc2626' },
    shelter:  { icon:<Tent         className="h-4 w-4"/>, color:'#2563eb' },
    response: { icon:<Radio        className="h-4 w-4"/>, color:'#d97706' },
    risk:     { icon:<TriangleAlert className="h-4 w-4"/>, color:'#b91c1c' },
    safe_zone:{ icon:<ShieldCheck  className="h-4 w-4"/>, color:'#16a34a' },
  };
  const conf = typeConf[loc.type] ?? { icon:<MapPin className="h-4 w-4"/>, color:'#64748b' };
  const statusConf: Record<string,string> = {
    open:'text-success bg-success/10 border-success/30',
    danger:'text-alert bg-alert/10 border-alert/30',
    warning:'text-warning bg-warning/10 border-warning/30',
    full:'text-orange-400 bg-orange-400/10 border-orange-400/30',
    limited:'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    closed:'text-muted-foreground bg-muted/10 border-border',
  };
  const pct = loc.capacity && loc.occupied!=null ? Math.round((loc.occupied/loc.capacity)*100) : null;
  return (
    <div className="p-3 sm:p-4 pr-10">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background:conf.color+'20', color:conf.color }}>{conf.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground leading-tight">{loc.name}</h3>
            <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
              statusConf[loc.status] ?? statusConf.closed)}>{loc.status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{loc.details}</p>
        </div>
      </div>
      {pct !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-foreground">{loc.occupied}/{loc.capacity} beds</span>
            <span className={pct>80?'text-orange-400':'text-success'}>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#1e3a52]">
            <div className={cn('h-full rounded-full', pct>80?'bg-orange-400':'bg-success')}
              style={{width:`${pct}%`}} />
          </div>
        </div>
      )}
      {loc.amenities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {loc.amenities.map((a,i) => (
            <span key={i} className="rounded-md border border-[#1e3a52] bg-[#0d2033] px-2 py-0.5
              text-[11px] font-medium text-[#93c5fd]">{a}</span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-[#1e3a52]">
        <HeartPulse className="h-3.5 w-3.5 shrink-0 text-[#4a6a82]" />
        <span className="text-xs text-[#93c5fd] font-medium">{loc.phone}</span>
      </div>
    </div>
  );
}
