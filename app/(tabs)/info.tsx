import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;

interface PollutionData {
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  co: number;
  so2: number;
  dt: number;
}

const getAqiColor = (aqi: number, scheme: 'light' | 'dark') => {
  const colors = Colors[scheme].airColors;
  const map: Record<number, string> = {
    1: colors.good,
    2: colors.moderate,
    3: colors.unhealthySensitive,
    4: colors.unhealthy,
    5: colors.veryUnhealthy,
  };
  return map[aqi] ?? colors.good;
};

const getAqiLabel = (aqi: number) => {
  switch (aqi) {
    case 1: return 'Жақсы';
    case 2: return 'Қалыпты';
    case 3: return 'Сезімтал топтар үшін зиянды';
    case 4: return 'Зиянды';
    case 5: return 'Өте зиянды';
    default: return 'Белгісіз';
  }
};

const getAqiDescription = (aqi: number) => {
  switch (aqi) {
    case 1: return 'Ауа өте таза. Денсаулыққа ешқандай қауіп жоқ.';
    case 2: return 'Ауа сапасы қанағаттанарлық. Сезімтал адамдарда шамалы әсер болуы мүмкін.';
    case 3: return 'Сезімтал топтар үшін зиянды.';
    case 4: return 'Барлық адамдар үшін денсаулыққа зиянды.';
    case 5: return 'Өте қауіпті! Тыныс алу жолдарының ауыр зардаптары.';
    default: return '';
  }
};

const knowledgeBase = [
  {
    title: 'AQI (Ауа сапасы индексі)',
    content:
      'AQI — ауаның қаншалықты ластанғанын көрсететін сандық көрсеткіш. 1-ден 5-ке дейінгі шкала: 1 – өте жақсы, 2 – қанағаттанарлық, 3 – сезімтал топтар үшін зиянды, 4 – зиянды, 5 – өте қауіпті.\n\nЕсептеу кезінде PM2.5, PM10, NO₂, O₃, SO₂, CO сияқты негізгі ластаушылар ескеріледі. Деректер OpenWeatherMap API арқылы алынады.',
  },
  {
    title: 'PM2.5 және PM10',
    content:
      'PM (Particulate Matter) — ауадағы ұсақ түйіршіктер. PM2.5 диаметрі 2.5 мкм-ден кіші, PM10 10 мкм-ден кіші.\n\n• PM2.5 өкпеге терең еніп, қан айналымына өтіп, жүрек-қан тамырлары және тыныс алу жүйесіне ауыр әсер етеді.\n• PM10 негізінен жоғарғы тыныс жолдарына әсер етеді.',
  },
  {
    title: 'NO₂ (Азот диоксиді)',
    content:
      'Автокөліктер мен өнеркәсіптен бөлінеді. Тыныс алу жолдарының тітіркенуін, астма ұстамаларын тудыруы мүмкін. Ұзақ әсер ету өкпе функциясының төмендеуіне әкеледі.',
  },
  {
    title: 'O₃ (Озон)',
    content:
      'Жер бетіндегі озон – күн сәулесі әсерінен NOx және VOC ластаушыларынан түзіледі. Тыныс алу жолдарын зақымдайды, әсіресе ыстық күндері жоғары болады.',
  },
  {
    title: 'CO (Көміртек тотығы)',
    content:
      'Түссіз, иіссіз газ, жану процестерінен (автокөлік, пеш) бөлінеді. Қандағы оттегі тасымалын төмендетіп, жүрек-қан тамырлары жүйесіне салмақ түсіреді.',
  },
  {
    title: 'SO₂ (Күкірт диоксиді)',
    content:
      'Көмір мен мұнай өнімдерін жағудан пайда болады. Тыныс алу жолдарын тітіркендіреді, астма ұстамаларын күшейтеді.',
  },
  {
    title: 'Қалай қорғануға болады?',
    content:
      '• Ерте таңертең немесе кешке серуендеу (күн ыстықта озон жоғары).\n• Қозғалыс көп көшелерден аулақ болыңыз, аулалар мен саябақтарды таңдаңыз.\n• AQI 3-тен жоғары болса, респиратор немесе N95 маскасын қолданыңыз.\n• Тыныс алу жолдары аурулары бар болса, ұзақ серуендемеңіз.',
  },
  {
    title: 'Дереккөздер',
    content:
      'Барлық көрсеткіштер OpenWeatherMap Air Pollution API арқылы алынады (нақты уақытқа жақын). Ұсыныстар ДДСҰ (WHO) нұсқауларына негізделген. Қосымша ақпарат: waqi.info, iqair.com.',
  },
];

export default function InfoScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pollution, setPollution] = useState<PollutionData | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingPollution, setLoadingPollution] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateLastUpdated = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    setLastUpdated(`${hours}:${minutes}`);
  };

  const fetchPollution = async (lat: number, lng: number) => {
    try {
      setLoadingPollution(true);
      const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error();
      const json = await resp.json();
      const comp = json.list[0].components;
      const data: PollutionData = {
        aqi: json.list[0].main.aqi,
        pm25: comp.pm2_5,
        pm10: comp.pm10,
        no2: comp.no2,
        o3: comp.o3,
        co: comp.co,
        so2: comp.so2,
        dt: json.list[0].dt,
      };
      setPollution(data);
      updateLastUpdated(data.dt);
      setErrorMsg(null);
    } catch {
      setErrorMsg('Деректерді жүктеу мүмкін болмады');
    } finally {
      setLoadingPollution(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Геолокацияға рұқсат берілмеді');
          setLoadingLocation(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        setErrorMsg('Орынды анықтау мүмкін болмады');
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (location) {
      fetchPollution(location.lat, location.lng);
    }
  }, [location]);

  useEffect(() => {
    if (location) {
      intervalRef.current = setInterval(() => {
        fetchPollution(location.lat, location.lng);
      }, 300000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [location]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.mainTitle, { color: Colors[colorScheme].text }]}>Ауа сапасы туралы</Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme].icon }]}>Толық ақпарат және кеңестер</Text>

        {loadingLocation ? (
          <View style={[styles.aqiCard, { backgroundColor: Colors[colorScheme].card }]}>
            <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
            <Text style={[styles.loadingText, { color: Colors[colorScheme].icon }]}>Орын анықталуда...</Text>
          </View>
        ) : errorMsg && !pollution ? (
          <View style={[styles.aqiCard, { backgroundColor: Colors[colorScheme].card }]}>
            <Text style={[styles.errorText, { color: Colors[colorScheme].icon }]}>{errorMsg}</Text>
          </View>
        ) : pollution ? (
          <View style={[styles.aqiCard, { backgroundColor: Colors[colorScheme].card }]}>
            <Text style={[styles.cardTitle, { color: Colors[colorScheme].text }]}>Қазіргі ауа сапасы</Text>
            {loadingPollution && !pollution ? (
              <ActivityIndicator size="small" color={Colors[colorScheme].tint} style={{ marginVertical: 12 }} />
            ) : (
              <>
                <View style={styles.aqiMain}>
                  <View style={[styles.aqiBadge, { backgroundColor: getAqiColor(pollution.aqi, colorScheme) }]}>
                    <Text style={styles.aqiBadgeValue}>{pollution.aqi}</Text>
                    <Text style={styles.aqiBadgeMax}>/5</Text>
                  </View>
                  <View style={styles.aqiTextCol}>
                    <Text style={[styles.aqiStatus, { color: Colors[colorScheme].text }]}>{getAqiLabel(pollution.aqi)}</Text>
                    <Text style={[styles.aqiDesc, { color: Colors[colorScheme].icon }]}>{getAqiDescription(pollution.aqi)}</Text>
                  </View>
                </View>

                <View style={styles.pollutantsGrid}>
                  <PollutantRow label="PM2.5" value={pollution.pm25} unit="µg/m³" colorScheme={colorScheme} />
                  <PollutantRow label="PM10" value={pollution.pm10} unit="µg/m³" colorScheme={colorScheme} />
                  <PollutantRow label="NO₂" value={pollution.no2} unit="µg/m³" colorScheme={colorScheme} />
                  <PollutantRow label="O₃" value={pollution.o3} unit="µg/m³" colorScheme={colorScheme} />
                  <PollutantRow label="CO" value={pollution.co} unit="µg/m³" colorScheme={colorScheme} />
                  <PollutantRow label="SO₂" value={pollution.so2} unit="µg/m³" colorScheme={colorScheme} />
                </View>

                <View style={styles.updateRow}>
                  <Text style={[styles.updateText, { color: Colors[colorScheme].icon }]}>
                    Соңғы жаңарту: {lastUpdated}
                  </Text>
                  <Text style={[styles.updateNote, { color: Colors[colorScheme].icon }]}>
                    (әр 5 минут сайын автоматты)
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : null}

        {knowledgeBase.map((item, idx) => (
          <View key={idx} style={[styles.infoCard, { backgroundColor: Colors[colorScheme].card }]}>
            <Text style={[styles.infoCardTitle, { color: Colors[colorScheme].text }]}>{item.title}</Text>
            <Text style={[styles.infoCardContent, { color: Colors[colorScheme].text }]}>{item.content}</Text>
          </View>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PollutantRow({ label, value, unit, colorScheme }: { label: string; value: number; unit: string; colorScheme: 'light' | 'dark' }) {
  return (
    <View style={styles.pollutantItem}>
      <Text style={[styles.pollutantLabel, { color: Colors[colorScheme].icon }]}>{label}</Text>
      <Text style={[styles.pollutantValue, { color: Colors[colorScheme].text }]}>{value.toFixed(1)} {unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  mainTitle: { fontSize: 28, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 20 },
  aqiCard: { borderRadius: 16, padding: 18, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, alignSelf: 'flex-start' },
  aqiMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, width: '100%' },
  aqiBadge: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', marginRight: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  aqiBadgeValue: { color: '#fff', fontSize: 32, fontWeight: '800' },
  aqiBadgeMax: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginLeft: 2, alignSelf: 'flex-end', marginBottom: 6 },
  aqiTextCol: { flex: 1 },
  aqiStatus: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  aqiDesc: { fontSize: 13, lineHeight: 18 },
  pollutantsGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  pollutantItem: { width: '48%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(128,128,128,0.08)', marginBottom: 8 },
  pollutantLabel: { fontSize: 13, marginBottom: 4 },
  pollutantValue: { fontSize: 15, fontWeight: '500' },
  updateRow: { marginTop: 16, alignItems: 'center' },
  updateText: { fontSize: 12, fontWeight: '500' },
  updateNote: { fontSize: 10, marginTop: 2 },
  infoCard: { borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  infoCardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  infoCardContent: { fontSize: 14, lineHeight: 22 },
});