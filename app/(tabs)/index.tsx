import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { AirData, Segment, useRoute } from '@/contexts/RouteContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import polyline from '@mapbox/polyline';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;

// Тёмный стиль Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

const OSRM_WALKING_URL = 'https://router.project-osrm.org/route/v1/walking';

// Утилиты (без изменений)
const getAqiColor = (aqi: number, scheme: 'light' | 'dark'): string => {
  const colors = Colors[scheme].airColors;
  switch (aqi) {
    case 1: return colors.good;
    case 2: return colors.moderate;
    case 3: return colors.unhealthySensitive;
    case 4: return colors.unhealthy;
    case 5: return colors.veryUnhealthy;
    default: return colors.good;
  }
};

const haversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const interpolateRoute = (coords: { latitude: number; longitude: number }[], step: number) => {
  if (coords.length < 2) return coords;
  const result = [coords[0]];
  let accumulated = 0;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const dist = haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    if (accumulated + dist < step) {
      accumulated += dist;
      continue;
    }
    const ratio = (step - accumulated) / dist;
    result.push({
      latitude: prev.latitude + (curr.latitude - prev.latitude) * ratio,
      longitude: prev.longitude + (curr.longitude - prev.longitude) * ratio,
    });
    accumulated = 0;
  }
  if (result[result.length - 1] !== coords[coords.length - 1]) result.push(coords[coords.length - 1]);
  return result;
};

async function fetchAqiForPoints(points: { latitude: number; longitude: number }[], apiKey: string): Promise<AirData[]> {
  const results: AirData[] = [];
  for (let i = 0; i < points.length; i += 10) {
    const chunk = points.slice(i, i + 10);
    const promises = chunk.map(async (p) => {
      try {
        const resp = await fetch(
          `https://api.openweathermap.org/data/2.5/air_pollution?lat=${p.latitude}&lon=${p.longitude}&appid=${apiKey}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const comp = json.list[0].components;
        return { lat: p.latitude, lng: p.longitude, aqi: json.list[0].main.aqi, pm25: comp.pm2_5 };
      } catch (err) {
        console.warn('AQI fetch error', err);
        return { lat: p.latitude, lng: p.longitude, aqi: 1, pm25: 0 };
      }
    });
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }
  return results;
}

const buildOsrmUrl = (orig: { latitude: number; longitude: number }, dest: { latitude: number; longitude: number }) =>
  `${OSRM_WALKING_URL}/${orig.longitude},${orig.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=polyline`;

export default function MapScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const mapRef = useRef<MapView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const { setRouteData, destination: ctxDestination, requestAlternative, resetAlternative } = useRoute();

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeSegments, setRouteSegments] = useState<Segment[]>([]);
  const [overallAqi, setOverallAqi] = useState<number | null>(null);

  // Быстрая геолокация
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Рұқсат жоқ', 'Геолокацияға рұқсат беріңіз');
          setLoadingLocation(false);
          return;
        }
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        Alert.alert('Қате', 'Орынды анықтау мүмкін болмады');
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, []);

  // Автоматически центрируем карту на пользователе
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  }, [userLocation]);

  // Обработка альтернативного маршрута
  useEffect(() => {
    if (requestAlternative && ctxDestination && userLocation) {
      buildRoute(ctxDestination.coordinates, ctxDestination);
      resetAlternative();
    }
  }, [requestAlternative]);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=5&addressdetails=1&accept-language=kk`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'PurePathApp/1.0' } });
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      const list = data.map((item: any) => ({
        placeId: item.place_id,
        description: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }));
      setPredictions(list);
      setShowPredictions(true);
    } catch (e) {
      console.warn('Nominatim search error', e);
      setPredictions([]);
      setShowPredictions(false);
    }
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchPredictions(text), 600);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPredictions([]);
    setShowPredictions(false);
    Keyboard.dismiss();
  };

  const dismissSearch = () => {
    Keyboard.dismiss();
    setShowPredictions(false);
  };

  const selectPlace = (item: any) => {
    dismissSearch();
    setSearchQuery(item.description);
    setPredictions([]);
    const coords = { latitude: item.lat, longitude: item.lon };
    const dest = { description: item.description, placeId: String(item.placeId), coordinates: coords };
    setRouteData([], [], 0, dest);
    buildRoute(coords, dest);
  };

  const handleMapLongPress = useCallback(async (event: any) => {
    dismissSearch();
    const coords = event.nativeEvent.coordinate;
    try {
      const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=kk`;
      const resp = await fetch(reverseUrl, { headers: { 'User-Agent': 'PurePathApp/1.0' } });
      const data = await resp.json();
      const description = data.display_name || 'Таңдалған нүкте';
      const dest = { description, placeId: String(data.place_id || ''), coordinates: coords };
      setRouteData([], [], 0, dest);
      buildRoute(coords, dest);
    } catch {
      const dest = { description: 'Таңдалған нүкте', placeId: '', coordinates: coords };
      setRouteData([], [], 0, dest);
      buildRoute(coords, dest);
    }
  }, [userLocation, setRouteData]);

  const buildRoute = async (destCoords: { latitude: number; longitude: number }, dest?: any) => {
    if (!userLocation) {
      Alert.alert('Орын анықталмады', 'Сіздің орналасқан жеріңіз белгісіз');
      return;
    }
    setLoadingRoute(true);
    try {
      const url = buildOsrmUrl(userLocation, destCoords);
      const resp = await fetch(url);
      const data = await resp.json();
      if (!data.routes || data.routes.length === 0) {
        Alert.alert('Маршрут табылмады');
        setLoadingRoute(false);
        return;
      }
      const points = polyline.decode(data.routes[0].geometry).map(([lat, lng]: number[]) => ({ latitude: lat, longitude: lng }));
      if (points.length < 2) {
        Alert.alert('Маршрут тым қысқа');
        setLoadingRoute(false);
        return;
      }
      const samplePoints = interpolateRoute(points, 200);
      const aqiData = await fetchAqiForPoints(samplePoints, OPENWEATHER_API_KEY!);

      const segments: Segment[] = [];
      let curColor = '';
      let curCoords: { latitude: number; longitude: number }[] = [];
      for (const pt of points) {
        let minDist = Infinity, closestAqi = 1;
        for (const a of aqiData) {
          const d = haversine(pt.latitude, pt.longitude, a.lat, a.lng);
          if (d < minDist) { minDist = d; closestAqi = a.aqi; }
        }
        const color = getAqiColor(closestAqi, colorScheme);
        if (color !== curColor) {
          if (curCoords.length) segments.push({ color: curColor, coordinates: [...curCoords] });
          curColor = color;
          curCoords = [pt];
        } else curCoords.push(pt);
      }
      if (curCoords.length) segments.push({ color: curColor, coordinates: [...curCoords] });

      setRouteSegments(segments);
      const avgAqi = Math.round(aqiData.reduce((s, d) => s + d.aqi, 0) / aqiData.length);
      setOverallAqi(avgAqi);
      const finalDest = dest || ctxDestination;
      if (finalDest) setRouteData(aqiData, segments, avgAqi, finalDest);

      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 120, right: 50, bottom: 150, left: 50 },
        animated: true,
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Қате', 'Маршрутты жүктеу сәтсіз');
    } finally {
      setLoadingRoute(false);
    }
  };

  const handleMyLocation = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  };

  const legendItems = [
    { color: Colors[colorScheme].airColors.good, label: 'Жақсы' },
    { color: Colors[colorScheme].airColors.moderate, label: 'Қалыпты' },
    { color: Colors[colorScheme].airColors.unhealthySensitive, label: 'Сезімтал' },
    { color: Colors[colorScheme].airColors.unhealthy, label: 'Зиянды' },
    { color: Colors[colorScheme].airColors.veryUnhealthy, label: 'Өте зиянды' },
  ];

  const initialRegion = userLocation
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: 43.238949, longitude: 76.889709, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            ref={searchInputRef}
            style={[
              styles.searchInput,
              { backgroundColor: isDark ? Colors.dark.card : Colors.light.card, color: isDark ? Colors.dark.text : Colors.light.text },
            ]}
            placeholder="Мекен-жайды іздеу..."
            placeholderTextColor={isDark ? '#aaa' : '#888'}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => { if (searchQuery.length >= 3 && predictions.length > 0) setShowPredictions(true); }}
            returnKeyType="search"
            onSubmitEditing={() => { if (predictions.length > 0) selectPlace(predictions[0]); }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol name="xmark.circle.fill" size={20} color={isDark ? '#aaa' : '#888'} />
            </TouchableOpacity>
          )}
        </View>
        {showPredictions && predictions.length > 0 && (
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.placeId.toString()}
            style={[styles.predictionsList, { backgroundColor: isDark ? Colors.dark.card : Colors.light.card }]}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.predictionItem} onPress={() => selectPlace(item)}>
                <Text style={[styles.predictionText, { color: isDark ? Colors.dark.text : Colors.light.text }]}>{item.description}</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          showsUserLocation={!!userLocation}
          showsMyLocationButton={false}
          loadingEnabled
          onLongPress={handleMapLongPress}
          onPress={() => dismissSearch()}
          customMapStyle={isDark ? darkMapStyle : []}
        >
          {userLocation && <Marker coordinate={userLocation} title="Мен" pinColor="blue" />}
          {ctxDestination && <Marker coordinate={ctxDestination.coordinates} title={ctxDestination.description} />}
          {routeSegments.map((seg, idx) => (
            <Polyline key={idx} coordinates={seg.coordinates} strokeColor={seg.color} strokeWidth={6} lineCap="round" lineJoin="round" />
          ))}
        </MapView>

        {loadingRoute && (
          <View style={[styles.routeLoader, { backgroundColor: isDark ? '#333' : '#fff' }]}>
            <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: isDark ? Colors.dark.text : Colors.light.text }]}>Маршрут есептелуде...</Text>
          </View>
        )}

        {userLocation && (
          <TouchableOpacity
            style={[styles.myLocationButton, { backgroundColor: isDark ? Colors.dark.card : Colors.light.card }]}
            onPress={handleMyLocation}
            activeOpacity={0.8}
          >
            <IconSymbol name="location.fill" size={22} color={Colors[colorScheme].tint} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.legendContainer, { backgroundColor: isDark ? Colors.dark.card : Colors.light.card }]}>
        <View style={styles.legendRow}>
          {legendItems.map((item, idx) => (
            <View key={idx} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
              <Text style={[styles.legendLabel, { color: isDark ? Colors.dark.text : Colors.light.text }]}>{item.label}</Text>
            </View>
          ))}
        </View>
        {overallAqi !== null && (
          <Text style={[styles.aqiSummary, { color: isDark ? Colors.dark.text : Colors.light.text }]}>
            Жалпы ауа сапасы: {overallAqi}/5 ({overallAqi <= 2 ? 'Жақсы' : 'Нашар'})
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 60,
    left: 10,
    right: 10,
    zIndex: 10,
  },
  searchInputWrapper: {
    position: 'relative',
  },
  searchInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    paddingRight: 40, // место под крестик
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  predictionsList: { maxHeight: 200, marginTop: 4, borderRadius: 12, overflow: 'hidden' },
  predictionItem: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  predictionText: { fontSize: 15 },
  mapContainer: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  routeLoader: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5,
  },
  loadingText: { fontSize: 14 },
  myLocationButton: {
    position: 'absolute', right: 16, bottom: 130,
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  legendContainer: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 8,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  legendItem: { alignItems: 'center', width: 55 },
  legendColor: { width: 14, height: 14, borderRadius: 7, marginBottom: 2 },
  legendLabel: { fontSize: 10 },
  aqiSummary: { textAlign: 'center', marginTop: 6, fontWeight: '600', fontSize: 13 },
});