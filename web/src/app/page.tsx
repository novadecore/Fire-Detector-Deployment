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

    map.once('load', () => {
      map.resize();

      // ===== 🔥 Fire Risk overlays start =====

      // A) CWFIS Fire Danger（全国 WMS；日级火险等级）
      map.addSource('risk-cwfis', {
        type: 'raster',
        tiles: [
          'https://cwfis.cfs.nrcan.gc.ca/geoserver/ows'
          + '?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1'
          + '&FORMAT=image/png&TRANSPARENT=true&STYLES='
          + '&SRS=EPSG:3857&LAYERS=fdr_current'   // fire danger 当前图层
          + '&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'
        ],
        tileSize: 256,
        attribution: 'Fire Danger © NRCan CWFIS'
      } as mapboxgl.RasterSourceSpecification);
      map.addLayer({
        id: 'risk-cwfis',
        type: 'raster',
        source: 'risk-cwfis',
        paint: { 'raster-opacity': 0.1 }
      });

      // B) BC PSTA Fire Threat（省级长期威胁；ArcGIS Export 当作瓦片）
      const bcPstaExport =
        'https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_land_and_natural_resource/MapServer/export'
        + '?f=image&format=png32&transparent=true'
        + '&bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256'
        + '&layers=show:17'; // 17 = BC Wildfire PSTA Fire Threat Rating
      map.addSource('risk-psta', {
        type: 'raster',
        tiles: [bcPstaExport],
        tileSize: 256,
        attribution: 'PSTA © Province of BC'
      } as mapboxgl.RasterSourceSpecification);
      map.addLayer({
        id: 'risk-psta',
        type: 'raster',
        source: 'risk-psta',
        paint: { 'raster-opacity': 0.6 }
      });

      // ===== 🔥 Fire Risk overlays end =====
    });

    // 右上角的缩放/旋转控件
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // 左上角的绘制控件
    const Draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
    });
    map.addControl(Draw, 'top-left');

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

  return (
    <main style={{ margin: 0, padding: 0 }}>
      <div ref={mapDiv} style={{ height: '100vh', width: '100vw' }} />
    </main>
  );
}
