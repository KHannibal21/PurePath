import React, { createContext, useCallback, useContext, useState } from 'react';

// Типы
export interface AirData {
  lat: number;
  lng: number;
  aqi: number;   // 1..5
  pm25: number;
}

export interface Segment {
  color: string;
  coordinates: { latitude: number; longitude: number }[];
}

interface Destination {
  description: string;
  placeId: string;
  coordinates: { latitude: number; longitude: number };
}

interface RouteContextType {
  aqiPoints: AirData[];
  routeSegments: Segment[];
  overallAqi: number | null;
  destination: Destination | null;
  requestAlternative: boolean;
  setRouteData: (
    aqi: AirData[],
    segments: Segment[],
    avgAqi: number,
    dest: Destination
  ) => void;
  clearRoute: () => void;
  triggerAlternative: () => void;
  resetAlternative: () => void;
}

const RouteContext = createContext<RouteContextType>({
  aqiPoints: [],
  routeSegments: [],
  overallAqi: null,
  destination: null,
  requestAlternative: false,
  setRouteData: () => {},
  clearRoute: () => {},
  triggerAlternative: () => {},
  resetAlternative: () => {},
});

export const RouteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [aqiPoints, setAqiPoints] = useState<AirData[]>([]);
  const [routeSegments, setRouteSegments] = useState<Segment[]>([]);
  const [overallAqi, setOverallAqi] = useState<number | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [requestAlternative, setRequestAlternative] = useState(false);

  const setRouteData = useCallback(
    (aqi: AirData[], segments: Segment[], avgAqi: number, dest: Destination) => {
      setAqiPoints(aqi);
      setRouteSegments(segments);
      setOverallAqi(avgAqi);
      setDestination(dest);
    },
    []
  );

  const clearRoute = useCallback(() => {
    setAqiPoints([]);
    setRouteSegments([]);
    setOverallAqi(null);
    setDestination(null);
    setRequestAlternative(false);
  }, []);

  const triggerAlternative = useCallback(() => setRequestAlternative(true), []);
  const resetAlternative = useCallback(() => setRequestAlternative(false), []);

  return (
    <RouteContext.Provider
      value={{
        aqiPoints,
        routeSegments,
        overallAqi,
        destination,
        requestAlternative,
        setRouteData,
        clearRoute,
        triggerAlternative,
        resetAlternative,
      }}
    >
      {children}
    </RouteContext.Provider>
  );
};

export const useRoute = () => useContext(RouteContext);