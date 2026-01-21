export type CrowdLevel = 1 | 2 | 3 | 4;

export type Beach = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  baselineLevel?: CrowdLevel;
};

export type Report = {
  id: string;
  beachId: string;
  createdAt: number;
  crowdLevel: CrowdLevel;
  reporterHash: string;
};

export type BeachState = "LIVE" | "RECENT" | "PRED";

export type BeachStats = {
  crowdLevel: CrowdLevel;
  state: BeachState;
  confidence: number;
  updatedAt: number | null;
  reportsCount: number;
};

export type BeachWithStats = Beach & BeachStats & { distanceM: number | null };
