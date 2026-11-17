export interface GeocodingResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  provider: string;
  providerPlaceId: string | null;
}

export interface GeocodingProvider {
  readonly name: string;
  geocode(address: string): Promise<GeocodingResult | null>;
}