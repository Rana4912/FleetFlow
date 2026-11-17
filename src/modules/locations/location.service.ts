import { prisma } from "../../infrastructure/database/prisma.js";

import type {
  GeocodingProvider
} from "../../infrastructure/geocoding/geocoding.types.js";

export class LocationService {
  constructor(
    private readonly geocodingProvider: GeocodingProvider
  ) {}

  async geocodeAddress(address: string) {
    const result = await this.geocodingProvider.geocode(address);

    if (!result) {
      return prisma.location.create({
        data: {
          inputAddress: address,
          geocodingStatus: "FAILED",
          provider: this.geocodingProvider.name
        }
      });
    }

    return prisma.location.create({
      data: {
        inputAddress: address,
        formattedAddress: result.formattedAddress,
        latitude: result.latitude,
        longitude: result.longitude,
        geocodingStatus: "SUCCEEDED",
        provider: result.provider,
        providerPlaceId: result.providerPlaceId,
        geocodedAt: new Date()
      }
    });
  }
}