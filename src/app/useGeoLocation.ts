import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { Map as LeafletMap } from "leaflet";
import type { UserLocation } from "../lib/geo";

export type GeoStatus = "idle" | "loading" | "ready" | "denied" | "error";
type ToastTone = "info" | "success" | "error";

type LocationMessages = {
  permissionDenied: string;
  fetchError: string;
  notSupported: string;
  toastUnavailable: string;
  centered: string;
};

type RequestLocationOptions = {
  flyTo?: boolean;
  showToast?: boolean;
  forceFresh?: boolean;
  silent?: boolean;
};

type UseGeoLocationInput = {
  mapRef: MutableRefObject<LeafletMap | null>;
  showLocationToast: (message: string, tone?: ToastTone) => void;
  locationFocusZoom: number;
  locationRefreshMs: number;
  messages: LocationMessages;
};

type UseGeoLocationOutput = {
  userLocation: UserLocation | null;
  geoStatus: GeoStatus;
  geoError: string | null;
  followMode: boolean;
  requestLocation: (options?: RequestLocationOptions) => void;
  handleLocateClick: () => void;
  handleUserLocationPinTap: () => void;
  handleUserInteract: () => void;
};

export const useGeoLocation = ({
  mapRef,
  showLocationToast,
  locationFocusZoom,
  locationRefreshMs,
  messages,
}: UseGeoLocationInput): UseGeoLocationOutput => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const followInitializedRef = useRef(false);
  const followModeRef = useRef(false);

  useEffect(() => {
    followModeRef.current = followMode;
  }, [followMode]);

  const handleGeoError = useCallback((error: GeolocationPositionError | null) => {
    if (error && error.code === error.PERMISSION_DENIED) {
      setGeoStatus("denied");
      setGeoError(messages.permissionDenied);
      return;
    }
    setGeoStatus("error");
    setGeoError(messages.fetchError);
  }, [messages.fetchError, messages.permissionDenied]);

  const updateLocation = useCallback((position: GeolocationPosition) => {
    const nextLocation: UserLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      ts: position.timestamp,
    };
    setUserLocation(nextLocation);
    setGeoStatus("ready");
    setGeoError(null);
    return nextLocation;
  }, []);

  const focusMapOnLocation = useCallback(
    (location: UserLocation, preferredZoom = locationFocusZoom) => {
      const map = mapRef.current;
      if (!map) return;
      const currentZoom = map.getZoom();
      const nextZoom = Number.isFinite(currentZoom)
        ? Math.max(currentZoom, preferredZoom)
        : preferredZoom;
      map.flyTo([location.lat, location.lng], nextZoom, {
        animate: true,
        duration: 0.9,
        easeLinearity: 0.25,
      });
    },
    [locationFocusZoom, mapRef],
  );

  const requestLocation = useCallback(
    (options?: RequestLocationOptions) => {
      if (!navigator.geolocation) {
        setGeoStatus("error");
        setGeoError(messages.notSupported);
        if (options?.showToast) {
          showLocationToast(messages.toastUnavailable, "info");
        }
        return;
      }
      if (!options?.silent) {
        setGeoStatus("loading");
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = updateLocation(position);
          if (options?.flyTo) {
            focusMapOnLocation(nextLocation);
          }
          if (options?.showToast) {
            showLocationToast(messages.centered, "success");
          }
        },
        (error) => {
          handleGeoError(error);
          if (options?.showToast) {
            showLocationToast(messages.toastUnavailable, "info");
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: options?.forceFresh ? 0 : 15000,
          timeout: 8000,
        },
      );
    },
    [
      focusMapOnLocation,
      handleGeoError,
      messages.centered,
      messages.notSupported,
      messages.toastUnavailable,
      showLocationToast,
      updateLocation,
    ],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      requestLocation();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [requestLocation]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      requestLocation({ silent: true, forceFresh: true });
    }, locationRefreshMs);
    return () => window.clearInterval(intervalId);
  }, [locationRefreshMs, requestLocation]);

  useEffect(() => {
    if (!followMode) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      followInitializedRef.current = false;
      return;
    }

    if (!navigator.geolocation) {
      showLocationToast(messages.toastUnavailable, "info");
      const timeoutId = window.setTimeout(() => {
        handleGeoError(null);
        setFollowMode(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const loadingTimeoutId = window.setTimeout(() => {
      setGeoStatus("loading");
    }, 0);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = updateLocation(position);
        const map = mapRef.current;
        if (!map || !followModeRef.current) return;
        if (!followInitializedRef.current) {
          map.flyTo([nextLocation.lat, nextLocation.lng], 16, { animate: true });
          followInitializedRef.current = true;
        } else {
          map.setView([nextLocation.lat, nextLocation.lng], map.getZoom(), {
            animate: true,
          });
        }
      },
      (error) => {
        handleGeoError(error);
        showLocationToast(messages.toastUnavailable, "info");
        setFollowMode(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 },
    );

    return () => {
      window.clearTimeout(loadingTimeoutId);
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [followMode, handleGeoError, mapRef, messages.toastUnavailable, showLocationToast, updateLocation]);

  const handleLocateClick = useCallback(() => {
    if (followModeRef.current) {
      setFollowMode(false);
    }
    if (userLocation) {
      focusMapOnLocation(userLocation);
      requestLocation({
        flyTo: true,
        forceFresh: true,
        silent: true,
        showToast: true,
      });
      return;
    }

    requestLocation({ flyTo: true, showToast: true, forceFresh: true });
  }, [focusMapOnLocation, requestLocation, userLocation]);

  const handleUserLocationPinTap = useCallback(() => {
    handleLocateClick();
  }, [handleLocateClick]);

  const handleUserInteract = useCallback(() => {
    if (followModeRef.current) {
      setFollowMode(false);
    }
  }, []);

  return {
    userLocation,
    geoStatus,
    geoError,
    followMode,
    requestLocation,
    handleLocateClick,
    handleUserLocationPinTap,
    handleUserInteract,
  };
};
