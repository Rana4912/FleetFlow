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

describe("Driver Profile API", () => {
  const driverEmail = `driver-${randomUUID()}@example.com`;
  const secondDriverEmail = `driver-${randomUUID()}@example.com`;
  const customerEmail = `customer-${randomUUID()}@example.com`;

  const licenseNumber = `WB-${randomUUID().slice(0, 8)}`;

  let driverUserId: string;
  let secondDriverUserId: string;
  let customerUserId: string;

  let driverToken: string;
  let secondDriverToken: string;
  let customerToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("StrongPassword123");

    const driver = await prisma.user.create({
      data: {
        name: "Test Driver",
        email: driverEmail,
        passwordHash,
        role: "DRIVER"
      }
    });

    driverUserId = driver.id;

    const secondDriver = await prisma.user.create({
      data: {
        name: "Second Test Driver",
        email: secondDriverEmail,
        passwordHash,
        role: "DRIVER"
      }
    });

    secondDriverUserId = secondDriver.id;

    const customer = await prisma.user.create({
      data: {
        name: "Test Customer",
        email: customerEmail,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerUserId = customer.id;

    driverToken = generateAccessToken({
      sub: driver.id,
      role: driver.role
    });

    secondDriverToken = generateAccessToken({
      sub: secondDriver.id,
      role: secondDriver.role
    });

    customerToken = generateAccessToken({
      sub: customer.id,
      role: customer.role
    });
  });

  afterAll(async () => {
    // Delete dependent driver profiles before deleting users.
    await prisma.driver.deleteMany({
      where: {
        userId: {
          in: [driverUserId, secondDriverUserId].filter(Boolean)
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            driverUserId,
            secondDriverUserId,
            customerUserId
          ].filter(Boolean)
        }
      }
    });
  });

  it("should reject requests without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/drivers/profile")
      .send({ licenseNumber });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject CUSTOMER access", async () => {
    const response = await request(app)
      .post("/api/v1/drivers/profile")
      .set("Cookie", `accessToken=${customerToken}`)
      .send({ licenseNumber });

    expect(response.status).toBe(403);
  });

  it("should create a driver profile successfully", async () => {
    const response = await request(app)
      .post("/api/v1/drivers/profile")
      .set("Cookie", `accessToken=${driverToken}`)
      .send({
        licenseNumber: licenseNumber.toLowerCase()
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.driver.userId).toBe(driverUserId);
    expect(response.body.data.driver.licenseNumber).toBe(
      licenseNumber.toUpperCase()
    );
    expect(response.body.data.driver.status).toBe("OFFLINE");

    // Verify that the profile was saved in PostgreSQL.
    const savedDriver = await prisma.driver.findUnique({
      where: {
        userId: driverUserId
      }
    });

    expect(savedDriver).not.toBeNull();
    expect(savedDriver?.licenseNumber).toBe(
      licenseNumber.toUpperCase()
    );
  });

  it("should reject duplicate driver profile creation", async () => {
    const response = await request(app)
      .post("/api/v1/drivers/profile")
      .set("Cookie", `accessToken=${driverToken}`)
      .send({ licenseNumber: "WB-99999-2026" });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Driver profile already exists"
    );
  });

  it("should reject a license number already registered to another driver", async () => {
    const response = await request(app)
      .post("/api/v1/drivers/profile")
      .set("Cookie", `accessToken=${secondDriverToken}`)
      .send({ licenseNumber });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "License number is already registered"
    );
  });

  it("should reject an invalid license number", async () => {
    const response = await request(app)
      .post("/api/v1/drivers/profile")
      .set("Cookie", `accessToken=${secondDriverToken}`)
      .send({ licenseNumber: "AB" });

    expect(response.status).toBe(400);
  });

  it("should reject unexpected request fields", async () => {
    const response = await request(app)
      .post("/api/v1/drivers/profile")
      .set("Cookie", `accessToken=${secondDriverToken}`)
      .send({
        licenseNumber: "WB-88888-2026",
        userId: driverUserId,
        status: "AVAILABLE"
      });

    expect(response.status).toBe(400);
  });
});