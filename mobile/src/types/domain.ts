export type CrowdLevel = 1 | 2 | 3 | 4;
export type WaterLevel = 1 | 2 | 3 | 4;
export type BeachLevel = 1 | 2 | 3;

export type Beach = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
};

export type MobileReport = {
  id: string;
  beachId: string;
  createdAt: number;
  crowdLevel: CrowdLevel;
  waterCondition?: WaterLevel;
  beachCondition?: BeachLevel;
};

export type WeatherSnapshot = {
  fetchedAt: number;
  expiresAt: number;
  timezone: string;
  current: {
    ts: number;
    temperatureC: number;
    windKmh: number;
    windDirectionDeg: number | null;
    windDirectionLabel: string | null;
    rainProbability: number | null;
    weatherCode: number;
    conditionLabel: string;
  };
  nextHours: Array<{
    ts: number;
    temperatureC: number;
    rainProbability: number | null;
    weatherCode: number;
    conditionLabel: string;
  }>;
};
