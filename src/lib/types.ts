export type CrowdLevel = 1 | 2 | 3 | 4;
export type WaterLevel = 1 | 2 | 3 | 4;
export type BeachLevel = 1 | 2 | 3;

export type AttributionSnapshot = {
  v: 1;
  src?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  first_seen_at: string;
  last_seen_at: string;
};

export type Beach = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  baselineLevel?: CrowdLevel;
  address?: string;
  hours?: string;
  phone?: string;
  website?: string;
  services?: string[];
};

export type Report = {
  id: string;
  beachId: string;
  createdAt: number;
  crowdLevel: CrowdLevel;
  waterCondition?: WaterLevel;
  beachCondition?: BeachLevel;
  reporterHash?: string;
  attribution?: AttributionSnapshot;
};

export type BeachState = "LIVE" | "RECENT" | "PRED";

export type Review = {
  id: string;
  beachId: string;
  authorName: string;
  content: string;
  rating: number;
  createdAt: number;
};

export type BeachStats = {
  crowdLevel: CrowdLevel;
  waterCondition?: WaterLevel;
  beachCondition?: BeachLevel;
  state: BeachState;
  confidence: number;
  updatedAt: number | null;
  reportsCount: number;
};

export type BeachWithStats = Beach & BeachStats & { distanceM: number | null };
