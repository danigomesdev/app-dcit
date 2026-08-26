import * as Location from "expo-location";

export function formatAddress(address: Location.LocationGeocodedAddress): string {
  const street = [address.street, address.streetNumber].filter(Boolean).join(", ");
  // Some geocoders (notably on Android) leave `city` null and put the
  // actual city name in `subregion` or `district` instead — fall back
  // through them so the city shows up either way.
  const cityName = address.city ?? address.subregion ?? address.district;
  const cityLine = [cityName, address.region].filter(Boolean).join(" - ");
  return [street, cityLine].filter(Boolean).join(", ") || "Endereço não identificado";
}

/**
 * Non-blocking by design: geolocation here is captured for audit/visibility
 * only (spec §4.1/§5) and must never gate the punch button. Returns null on
 * any denial or failure instead of throwing, so callers can just show a
 * fallback message.
 */
export async function captureCurrentAddress(): Promise<string | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const [address] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    return address ? formatAddress(address) : null;
  } catch {
    return null;
  }
}
