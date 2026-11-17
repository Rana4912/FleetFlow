import {
  describe,
  it,
  expect,
  afterAll
} from "vitest";

import { randomUUID } from "node:crypto";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { LocationService } from "../../src/modules/locations/location.service.js";

import type {
  GeocodingProvider
} from "../../src/infrastructure/geocoding/geocoding.types.js";

import { GeocodingProviderError } from "../../src/infrastructure/geocoding/geocoding.errors.js";

describe("LocationService", () => {
  const testAddresses: string[] = [];

  afterAll(async () => {
    await prisma.location.deleteMany({
      where: {
        inputAddress: {
          in: testAddresses
        }
      }
    });
  });

  it("should create a location successfully after geocoding", async () => {
    const address = `Salt Lake, Kolkata ${randomUUID()}`;
    testAddresses.push(address);

    const mockProvider: GeocodingProvider = {
      name: "TEST_PROVIDER",

      async geocode() {
        return {
          formattedAddress: "Salt Lake, Kolkata, India",
          latitude: 22.5726,
          longitude: 88.3639,
          provider: "TEST_PROVIDER",
          providerPlaceId: "test-place-123"
        };
      }
    };

    const locationService = new LocationService(mockProvider);

    const location = await locationService.geocodeAddress(address);

    expect(location.inputAddress).toBe(address);
    expect(location.formattedAddress).toBe("Salt Lake, Kolkata, India");
    expect(Number(location.latitude)).toBeCloseTo(22.5726);
    expect(Number(location.longitude)).toBeCloseTo(88.3639);
    expect(location.geocodingStatus).toBe("SUCCEEDED");
    expect(location.provider).toBe("TEST_PROVIDER");
    expect(location.providerPlaceId).toBe("test-place-123");
    expect(location.geocodedAt).not.toBeNull();
  });

  it("should save FAILED status when address is not found", async () => {
    const address = `Unknown Place ${randomUUID()}`;
    testAddresses.push(address);

    const mockProvider: GeocodingProvider = {
      name: "TEST_PROVIDER",

      async geocode() {
        return null;
      }
    };

    const locationService = new LocationService(mockProvider);

    const location = await locationService.geocodeAddress(address);

    expect(location.inputAddress).toBe(address);
    expect(location.geocodingStatus).toBe("FAILED");
    expect(location.latitude).toBeNull();
    expect(location.longitude).toBeNull();
    expect(location.provider).toBe("TEST_PROVIDER");
    expect(location.geocodedAt).toBeNull();
  });

  it("should propagate provider errors without creating a location", async () => {
    const address = `Provider Failure ${randomUUID()}`;

    const mockProvider: GeocodingProvider = {
      name: "TEST_PROVIDER",

      async geocode() {
        throw new GeocodingProviderError(
          "Geocoding provider is unavailable",
          "PROVIDER_UNAVAILABLE"
        );
      }
    };

    const locationService = new LocationService(mockProvider);

    await expect(
      locationService.geocodeAddress(address)
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE"
    });

    const savedLocation = await prisma.location.findFirst({
      where: {
        inputAddress: address
      }
    });

    expect(savedLocation).toBeNull();
  });
});