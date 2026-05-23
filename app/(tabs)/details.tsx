import { Colors } from '@/constants/theme';
import { useRoute } from '@/contexts/RouteContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ---------- Утилиты (при необходимости можно вынести в общий файл) ----------
const getAqiColor = (aqi: number, scheme: 'light' | 'dark') => {
  const colors = Colors[scheme].airColors;
  const mapping: Record<number, string> = {
    1: colors.good,
    2: colors.moderate,
    3: colors.unhealthySensitive,
    4: colors.unhealthy,
    5: colors.veryUnhealthy,
  };
  return mapping[aqi] ?? colors.good;
};

const getAqiLabel = (aqi: number): string => {
  switch (aqi) {
    case 1: return 'Жақсы';
    case 2: return 'Қалыпты';
    case 3: return 'Сезімтал топтар үшін зиянды';
    case 4: return 'Зиянды';
    case 5: return 'Өте зиянды';
    default: return 'Белгісіз';
  }
};

const getAqiDescription = (aqi: number): string => {
  switch (aqi) {
    case 1: return 'Ауа өте таза, денсаулыққа қауіп жоқ.';
    case 2: return 'Ауа сапасы қанағаттанарлық, бірақ сезімтал адамдарда жеңіл әсер болуы мүмкін.';
    case 3: return 'Сезімтал топтар (балалар, егде жастағы адамдар, астмамен ауыратындар) үшін қауіпті.';
    case 4: return 'Барлық адамдар үшін денсаулыққа зиянды әсер етуі мүмкін.';
    case 5: return 'Өте қауіпті! Тыныс алу жолдарының ауыр зардаптарына әкелуі мүмкін.';
    default: return '';
  }
};

const getAdvice = (aqi: number): string => {
  if (aqi <= 2) return 'Серуендеуге болады.';
  if (aqi === 3) return 'Мүмкіндік болса, қысқа уақытқа ғана болыңыз.';
  if (aqi >= 4) return 'Бұл учаскеден аулақ болу ұсынылады.';
  return '';
};

// ---------- Компонент ----------
export default function DetailsScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const { aqiPoints, overallAqi, destination, triggerAlternative, loading } = useRoute();

  // Группировка точек в последовательные участки с одинаковым AQI
  const groupedSegments = useMemo(() => {
    if (!aqiPoints || aqiPoints.length === 0) return [];

    const groups: {
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
      aqi: number;
      avgPm25: number;
    }[] = [];

    let currentAqi = aqiPoints[0].aqi;
    let start = aqiPoints[0];
    let pm25Sum = aqiPoints[0].pm25;
    let count = 1;

    for (let i = 1; i < aqiPoints.length; i++) {
      const point = aqiPoints[i];
      if (point.aqi === currentAqi) {
        pm25Sum += point.pm25;
        count++;
      } else {
        // Завершаем предыдущий участок
        groups.push({
          startLat: start.lat,
          startLng: start.lng,
          endLat: aqiPoints[i - 1].lat,
          endLng: aqiPoints[i - 1].lng,
          aqi: currentAqi,
          avgPm25: +(pm25Sum / count).toFixed(1),
        });
        // Начинаем новый
        currentAqi = point.aqi;
        start = point;
        pm25Sum = point.pm25;
        count = 1;
      }
    }
    // Последний участок
    const last = aqiPoints[aqiPoints.length - 1];
    groups.push({
      startLat: start.lat,
      startLng: start.lng,
      endLat: last.lat,
      endLng: last.lng,
      aqi: currentAqi,
      avgPm25: +(pm25Sum / count).toFixed(1),
    });

    return groups;
  }, [aqiPoints]);

  // Если нет данных маршрута, показываем подсказку
  if (!destination || aqiPoints.length === 0) {
    return (
      <SafeAreaView
        style={[styles.emptyContainer, { backgroundColor: Colors[colorScheme].background }]}
        edges={['top', 'left', 'right']}
      >
        <Text style={[styles.emptyTitle, { color: Colors[colorScheme].text }]}>
          Маршрут салынбады
        </Text>
        <Text style={[styles.emptyDesc, { color: Colors[colorScheme].icon }]}>
          «Маршрут» қойындысына өтіп, бағытты енгізіңіз.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}
      edges={['top', 'left', 'right']}
    >
      <FlatList
        data={groupedSegments}
        keyExtractor={(_, index) => `segment-${index}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Заголовок */}
            <View style={styles.headerSection}>
              <Text style={[styles.mainTitle, { color: Colors[colorScheme].text }]}>
                Ауа сапасының талдауы
              </Text>
              {destination && (
                <Text style={[styles.destination, { color: Colors[colorScheme].icon }]}>
                  {destination.description}
                </Text>
              )}
            </View>

            {/* Общий AQI */}
            <View style={[styles.overallCard, { backgroundColor: Colors[colorScheme].card }]}>
              <Text style={[styles.overallLabel, { color: Colors[colorScheme].icon }]}>
                Жалпы маршрут бойынша AQI
              </Text>
              <View style={styles.overallRow}>
                <View
                  style={[
                    styles.overallBadge,
                    {
                      backgroundColor: getAqiColor(overallAqi ?? 1, colorScheme),
                    },
                  ]}
                >
                  <Text style={styles.overallBadgeText}>
                    {overallAqi ?? '?'}/5
                  </Text>
                </View>
                <Text style={[styles.overallStatus, { color: Colors[colorScheme].text }]}>
                  {getAqiLabel(overallAqi ?? 1)}
                </Text>
              </View>
              <Text style={[styles.overallAdvice, { color: Colors[colorScheme].icon }]}>
                {getAqiDescription(overallAqi ?? 1)}
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>
              Учаскелер бойынша бөлу
            </Text>
          </>
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.segmentCard,
              {
                backgroundColor: Colors[colorScheme].card,
                borderLeftColor: getAqiColor(item.aqi, colorScheme),
              },
            ]}
          >
            <View style={styles.segmentHeader}>
              <Text style={[styles.segmentIndex, { color: Colors[colorScheme].text }]}>
                {index + 1}-ші учаске
              </Text>
              <View
                style={[
                  styles.segmentBadge,
                  { backgroundColor: getAqiColor(item.aqi, colorScheme) },
                ]}
              >
                <Text style={styles.segmentBadgeText}>AQI {item.aqi}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors[colorScheme].icon }]}>Бастапқы нүкте:</Text>
              <Text style={[styles.detailValue, { color: Colors[colorScheme].text }]}>
                {item.startLat.toFixed(4)}, {item.startLng.toFixed(4)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors[colorScheme].icon }]}>Соңғы нүкте:</Text>
              <Text style={[styles.detailValue, { color: Colors[colorScheme].text }]}>
                {item.endLat.toFixed(4)}, {item.endLng.toFixed(4)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors[colorScheme].icon }]}>PM2.5 (орташа):</Text>
              <Text style={[styles.detailValue, { color: Colors[colorScheme].text }]}>
                {item.avgPm25} µg/m³
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: Colors[colorScheme].icon }]}>Сипаттамасы:</Text>
              <Text style={[styles.detailValue, { color: Colors[colorScheme].text }]}>
                {getAqiLabel(item.aqi)}
              </Text>
            </View>

            <View style={[styles.adviceBox, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
              <Text style={[styles.adviceText, { color: Colors[colorScheme].text }]}>
                💡 {getAdvice(item.aqi)}
              </Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.alternativeButton,
                { backgroundColor: Colors[colorScheme].tint },
              ]}
              onPress={() => {
                triggerAlternative();
                // Переключение на первый таб (индекс или путь)
                router.replace('/(tabs)');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Альтернативті таза жолды табу</Text>
            </TouchableOpacity>
            {loading && (
              <ActivityIndicator
                size="small"
                color={Colors[colorScheme].tint}
                style={{ marginTop: 12 }}
              />
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  headerSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  destination: {
    fontSize: 15,
    lineHeight: 20,
  },
  overallCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  overallLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overallBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  overallBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  overallStatus: {
    fontSize: 18,
    fontWeight: '600',
  },
  overallAdvice: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  segmentCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  segmentIndex: {
    fontSize: 16,
    fontWeight: '600',
  },
  segmentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  segmentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    width: 130,
    fontSize: 13,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  adviceBox: {
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
  },
  adviceText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingTop: 8,
    alignItems: 'center',
  },
  alternativeButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});