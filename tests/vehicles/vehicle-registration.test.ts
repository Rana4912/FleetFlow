import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll
} from "vitest";

import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { hashPassword } from "../../src/modules/auth/password.js";
import { generateAccessToken } from "../../src/modules/auth/token.js";

describe("Vehicle Registration API", () => {
  const adminEmail = `admin-${randomUUID()}@example.com`;
  const customerEmail = `customer-${randomUUID()}@example.com`;
  const driverEmail = `driver-${randomUUID()}@example.com`;

  const registrationNumber = `WB-${randomUUID().slice(0, 8)}`;

  let adminUserId: string;
  let customerUserId: string;
  let driverUserId: string;

  let adminToken: string;
  let customerToken: string;
  let driverToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("StrongPassword123");

    const admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN"
      }
    });

    adminUserId = admin.id;

    const customer = await prisma.user.create({
      data: {
        name: "Test Customer",
        email: customerEmail,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerUserId = customer.id;

    const driver = await prisma.user.create({
      data: {
        name: "Test Driver",
        email: driverEmail,
        passwordHash,
        role: "DRIVER"
      }
    });

    driverUserId = driver.id;

    adminToken = generateAccessToken({
      sub: admin.id,
      role: admin.role
    });

    customerToken = generateAccessToken({
      sub: customer.id,
      role: customer.role
    });

    driverToken = generateAccessToken({
      sub: driver.id,
      role: driver.role
    });
  });

  afterAll(async () => {
    // Delete vehicles before deleting users.
    await prisma.vehicle.deleteMany({
      where: {
        registrationNumber: registrationNumber.toUpperCase()
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            adminUserId,
            customerUserId,
            driverUserId
          ].filter(Boolean)
        }
      }
    });
  });

  it("should reject requests without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/vehicles")
      .send({
        registrationNumber,
        capacityKg: 2500
      });

    expect(response.status).toBe(401);
  });

  it("should reject CUSTOMER access", async () => {
    const response = await request(app)
      .post("/api/v1/vehicles")
      .set("Cookie", `accessToken=${customerToken}`)
      .send({
        registrationNumber,
        capacityKg: 2500
      });

    expect(response.status).toBe(403);
  });

  it("should reject DRIVER access", async () => {
    const response = await request(app)
      .post("/api/v1/vehicles")
      .set("Cookie", `accessToken=${driverToken}`)
      .send({
        registrationNumber,
        capacityKg: 2500
      });

    expect(response.status).toBe(403);
  });

  it("should register a vehicle successfully", async () => {
    const response = await request(app)
      .post("/api/v1/vehicles")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        registrationNumber: registrationNumber.toLowerCase(),
        capacityKg: 2500
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.vehicle.registrationNumber).toBe(
      registrationNumber.toUpperCase()
    );

    expect(response.body.data.vehicle.status).toBe("AVAILABLE");

    // Verify persistence in PostgreSQL.
    const savedVehicle = await prisma.vehicle.findUnique({
      where: {
        registrationNumber: registrationNumber.toUpperCase()
      }
    });

    expect(savedVehicle).not.toBeNull();
    expect(savedVehicle?.capacityKg.toString()).toBe("2500");
    expect(savedVehicle?.status).toBe("AVAILABLE");
  });

  it("should reject duplicate vehicle registration", async () => {
    const response = await request(app)
      .post("/api/v1/vehicles")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        registrationNumber,
        capacityKg: 3000
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Vehicle registration number already exists"
    );
  });

  it("should reject invalid vehicle capacity", async () => {
    const response = await request(app)
      .post("/api/v1/vehicles")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        registrationNumber: `WB-${randomUUID().slice(0, 8)}`,
        capacityKg: -100
      });

    expect(response.status).toBe(400);
  });

  it("should reject unexpected request fields", async () => {
    const response = await request(app)
      .post("/api/v1/vehicles")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        registrationNumber: `WB-${randomUUID().slice(0, 8)}`,
        capacityKg: 2500,
        status: "IN_USE"
      });

    expect(response.status).toBe(400);
  });
});