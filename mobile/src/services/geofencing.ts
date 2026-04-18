/**
 * Registers geofences for the N nearest beaches to the user's current location.
 * iOS supports max 20 simultaneous geofences; we use 18 to leave headroom.
 * Call this whenever the user's location changes significantly.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { NEARBY_BEACH_TASK } from "../tasks/nearbyBeachTask";
import type { Beach } from "../types";

const MAX_GEOFENCES = 18;
const GEOFENCE_RADIUS_M = 500;

type BeachEntry = { id: string; name: string; lat: number; lng: number };

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function updateNearbyGeofences(
  userLat: number,
  userLng: number,
  beaches: BeachEntry[],
): Promise<void> {
  try {
    // Check if background location is available
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== "granted") return;

    // Sort beaches by distance and take the nearest N
    const sorted = [...beaches]
      .map((b) => ({ ...b, dist: distanceM(userLat, userLng, b.lat, b.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, MAX_GEOFENCES);

    const regions: Location.LocationRegion[] = sorted.map((b) => ({
      identifier: b.id,
      latitude: b.lat,
      longitude: b.lng,
      radius: GEOFENCE_RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: false,
      // Attach beach name via custom property (accessed in task)
      _name: b.name,
    } as Location.LocationRegion & { _name: string }));

    await Location.startGeofencingAsync(NEARBY_BEACH_TASK, regions);
  } catch {
    // Non-fatal
  }
}

export async function stopGeofencing(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(NEARBY_BEACH_TASK);
    if (isRegistered) {
      await Location.stopGeofencingAsync(NEARBY_BEACH_TASK);
    }
  } catch {
    // Non-fatal
  }
}

export async function requestBackgroundLocationPermission(): Promise<boolean> {
  try {
    // Must have foreground permission first
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return false;

    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === "granted";
  } catch {
    return false;
  }
}
