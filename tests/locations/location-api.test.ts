
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi
} from "vitest";

import request from "supertest";
import { randomUUID } from "node:crypto";

const { geocodeAddressMock } = vi.hoisted(() => ({
  geocodeAddressMock: vi.fn()
}));

vi.mock("../../src/modules/locations/location.dependencies.js", () => ({
  locationService: {
    geocodeAddress: geocodeAddressMock
  }
}));

import app from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { hashPassword } from "../../src/modules/auth/password.js";
import { generateAccessToken } from "../../src/modules/auth/token.js";

describe("Location API", () => {
  const adminEmail = `location-admin-${randomUUID()}@test.com`;
  const customerEmail = `location-customer-${randomUUID()}@test.com`;

  let adminUserId: string;
  let customerUserId: string;

  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("StrongPassword123");

    const admin = await prisma.user.create({
      data: {
        name: "Location Test Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN"
      }
    });

    adminUserId = admin.id;

    const customer = await prisma.user.create({
      data: {
        name: "Location Test Customer",
        email: customerEmail,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerUserId = customer.id;

    adminToken = generateAccessToken({
      sub: admin.id,
      role: admin.role
    });

    customerToken = generateAccessToken({
      sub: customer.id,
      role: customer.role
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [adminUserId, customerUserId].filter(Boolean)
        }
      }
    });
  });

  it("should successfully geocode an address", async () => {
    geocodeAddressMock.mockResolvedValueOnce({
      id: randomUUID(),
      inputAddress: "Salt Lake, Kolkata",
      formattedAddress: "Salt Lake, Kolkata, West Bengal, India",
      latitude: "22.5800",
      longitude: "88.4200",
      geocodingStatus: "SUCCEEDED",
      provider: "NOMINATIM",
      providerPlaceId: "12345",
      geocodedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await request(app)
      .post("/api/v1/locations/geocode")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        address: "Salt Lake, Kolkata"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.location.geocodingStatus).toBe("SUCCEEDED");

    expect(geocodeAddressMock).toHaveBeenCalledWith(
      "Salt Lake, Kolkata"
    );
  });

  it("should return a failed geocoding result when address is not found", async () => {
    geocodeAddressMock.mockResolvedValueOnce({
      id: randomUUID(),
      inputAddress: "Unknown Address, Kolkata",
      formattedAddress: null,
      latitude: null,
      longitude: null,
      geocodingStatus: "FAILED",
      provider: "NOMINATIM",
      providerPlaceId: null,
      geocodedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await request(app)
      .post("/api/v1/locations/geocode")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        address: "Unknown Address, Kolkata"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.location.geocodingStatus).toBe("FAILED");
  });

  it("should reject requests without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/locations/geocode")
      .send({
        address: "Salt Lake, Kolkata"
      });

    expect(response.status).toBe(401);
    expect(geocodeAddressMock).not.toHaveBeenCalled();
  });

  it("should reject CUSTOMER access", async () => {
    const response = await request(app)
      .post("/api/v1/locations/geocode")
      .set("Cookie", `accessToken=${customerToken}`)
      .send({
        address: "Salt Lake, Kolkata"
      });

    expect(response.status).toBe(403);
    expect(geocodeAddressMock).not.toHaveBeenCalled();
  });

  it("should reject an invalid address", async () => {
    const response = await request(app)
      .post("/api/v1/locations/geocode")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        address: "abc"
      });

    expect(response.status).toBe(400);
    expect(geocodeAddressMock).not.toHaveBeenCalled();
  });
});
