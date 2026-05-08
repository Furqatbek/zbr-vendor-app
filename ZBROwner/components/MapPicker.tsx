import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useT } from '../i18n';

const TASHKENT = { lat: 41.311158, lng: 69.279737 };
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

interface Props {
  visible: boolean;
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

function buildHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f5f5f5; }
  .leaflet-control-attribution { font-size: 10px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET_JS}"></script>
<script>
  var map = L.map('map').setView([${lat}, ${lng}], 16);
  L.tileLayer('${TILE_URL}', { maxZoom: 19, attribution: '${TILE_ATTRIBUTION}' }).addTo(map);
  var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
  function send(latlng) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
    }
  }
  marker.on('dragend', function (e) { send(e.target.getLatLng()); });
  map.on('click', function (e) { marker.setLatLng(e.latlng); send(e.latlng); });
  send({ lat: ${lat}, lng: ${lng} });
</script>
</body>
</html>`;
}

// Lazy-load Leaflet on web (via CDN). Resolves once window.L is available.
function ensureLeafletLoaded(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w: any = window as any;
    if (w.L) {
      resolve(w.L);
      return;
    }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    let script = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (script) {
      script.addEventListener('load', () => resolve((window as any).L));
      script.addEventListener('error', () => reject(new Error('Failed to load Leaflet')));
      return;
    }
    script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = LEAFLET_JS;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });
}

function WebMap({
  startLat,
  startLng,
  onChange,
}: {
  startLat: number;
  startLng: number;
  onChange: (c: { lat: number; lng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: any = null;
    ensureLeafletLoaded()
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        map = L.map(containerRef.current).setView([startLat, startLng], 16);
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
        const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
        marker.on('dragend', (e: any) => onChange(e.target.getLatLng()));
        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          onChange(e.latlng);
        });
        // Leaflet sometimes mis-measures inside a Modal; force a resize after mount.
        setTimeout(() => map.invalidateSize(), 50);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load map');
      });
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use a raw <div> via createElement to avoid TS typing issues in a RN project.
  const mapDiv = React.createElement('div', {
    ref: containerRef,
    style: { width: '100%', height: '100%', minHeight: 300 },
  });

  return (
    <View style={styles.webMapWrap}>
      {mapDiv}
      {loading && !error && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={Colors.accent} />
        </View>
      )}
      {error && (
        <View style={styles.loading}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

// Native map uses react-native-webview. We require it lazily so the web bundle
// doesn't break if the package isn't installed there.
function NativeMap({
  startLat,
  startLng,
  onChange,
}: {
  startLat: number;
  startLng: number;
  onChange: (c: { lat: number; lng: number }) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require('react-native-webview');
  const html = useMemo(() => buildHtml(startLat, startLng), [startLat, startLng]);
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      onMessage={(e: any) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          if (typeof data.lat === 'number' && typeof data.lng === 'number') {
            onChange({ lat: data.lat, lng: data.lng });
          }
        } catch {
          // ignore malformed
        }
      }}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      )}
      style={styles.webview}
    />
  );
}

export default function MapPicker({ visible, initialLat, initialLng, onConfirm, onClose }: Props) {
  const t = useT();
  const startLat = typeof initialLat === 'number' && !Number.isNaN(initialLat) ? initialLat : TASHKENT.lat;
  const startLng = typeof initialLng === 'number' && !Number.isNaN(initialLng) ? initialLng : TASHKENT.lng;
  const [coords, setCoords] = useState({ lat: startLat, lng: startLng });

  // Reset coords when re-opened with different initial values.
  useEffect(() => {
    if (visible) setCoords({ lat: startLat, lng: startLng });
  }, [visible, startLat, startLng]);

  const handleConfirm = () => {
    onConfirm({
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('location.pickOnMap')}</Text>
          <TouchableOpacity onPress={handleConfirm} hitSlop={8}>
            <Text style={styles.done}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapWrap}>
          {visible && (Platform.OS === 'web' ? (
            <WebMap startLat={startLat} startLng={startLng} onChange={setCoords} />
          ) : (
            <NativeMap startLat={startLat} startLng={startLng} onChange={setCoords} />
          ))}
        </View>

        <View style={styles.footer}>
          <Ionicons name="pin" size={16} color={Colors.accent} />
          <Text style={styles.coords}>
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </Text>
          <Text style={styles.hint}>{t('location.mapHint')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    paddingTop: Spacing.xl + Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  cancel: { ...Typography.body, color: Colors.gray700 },
  done: { ...Typography.body, color: Colors.accent, fontWeight: '600' as const },
  title: { ...Typography.headline, color: Colors.black },
  mapWrap: { flex: 1, backgroundColor: Colors.gray100, overflow: 'hidden' },
  webview: { flex: 1 },
  webMapWrap: { flex: 1, position: 'relative' },
  loading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)' },
  errorText: { ...Typography.body, color: Colors.danger },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  coords: { ...Typography.body, color: Colors.black, fontWeight: '600' as const },
  hint: { ...Typography.caption1, color: Colors.gray500, flex: 1, textAlign: 'right' },
});
