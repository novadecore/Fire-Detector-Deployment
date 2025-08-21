'use client';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';

export default function Page() {
  const mapDiv = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapDiv.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string;

    const bcBounds: mapboxgl.LngLatBoundsLike = [[-139.1, 48.2], [-114.05, 60.1]];

    const map = new mapboxgl.Map({
      container: mapDiv.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      projection: 'mercator',
      bounds: bcBounds
    });

    // 保底：等地图加载完后按容器尺寸再算一遍
    map.once('load', () => {
      map.resize();
    });

    // 右上角的缩放/旋转控件
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // 左上角的绘制控件
    const Draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
    });
    map.addControl(Draw, 'top-left');



    // …你的 onCreate 原样保留 …
    const onCreate = async (e: any) => {
      const polygon = e.features[0];

      const preview = turf.buffer(polygon, 0.3, { units: 'kilometers' });
      const prevSrc = map.getSource('preview') as mapboxgl.GeoJSONSource | undefined;
      if (prevSrc) prevSrc.setData(preview as any);
      else {
        map.addSource('preview', { type: 'geojson', data: preview as any });
        map.addLayer({ id: 'preview-fill', type: 'fill', source: 'preview',
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } });
        map.addLayer({ id: 'preview-line', type: 'line', source: 'preview',
          paint: { 'line-color': '#3b82f6', 'line-width': 2 } });
      }

      const resp = await fetch('/api/sensors/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygon, spacing_m: 200, sensor_radius_m: 300 }),
      });
      const fc = await resp.json();

      const sensorsSrc = map.getSource('sensors') as mapboxgl.GeoJSONSource | undefined;
      if (sensorsSrc) sensorsSrc.setData(fc);
      else {
        map.addSource('sensors', { type: 'geojson', data: fc });
        map.addLayer({ id: 'sensors', type: 'circle', source: 'sensors',
          paint: { 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } });
      }
    };

    map.on('draw.create', onCreate);
    return () => { map.off('draw.create', onCreate); map.remove(); };
  }, []);

  // ✅ 让容器占满视口；避免 main 的 padding 挤压
  return (
    <main style={{ margin: 0, padding: 0 }}>
      <div ref={mapDiv} style={{ height: '100vh', width: '100vw' }} />
    </main>
  );
}
