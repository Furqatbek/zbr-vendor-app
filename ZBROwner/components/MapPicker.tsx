import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import { useT } from '../i18n';

const TASHKENT = { lat: 41.311158, lng: 69.279737 };

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
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #f5f5f5; }
  .leaflet-control-attribution { font-size: 10px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map').setView([${lat}, ${lng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
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

export default function MapPicker({ visible, initialLat, initialLng, onConfirm, onClose }: Props) {
  const t = useT();
  const startLat = typeof initialLat === 'number' && !Number.isNaN(initialLat) ? initialLat : TASHKENT.lat;
  const startLng = typeof initialLng === 'number' && !Number.isNaN(initialLng) ? initialLng : TASHKENT.lng;
  const html = useMemo(() => buildHtml(startLat, startLng), [startLat, startLng]);
  const [coords, setCoords] = useState({ lat: startLat, lng: startLng });

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        setCoords({ lat: data.lat, lng: data.lng });
      }
    } catch {
      // ignore malformed messages
    }
  };

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
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            onMessage={handleMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            )}
            style={styles.webview}
          />
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
  mapWrap: { flex: 1, backgroundColor: Colors.gray100 },
  webview: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
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
