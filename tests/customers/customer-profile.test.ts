
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

describe("Customer Profile API", () => {
  const customerEmail = `customer-${randomUUID()}@example.com`;
  const driverEmail = `driver-${randomUUID()}@example.com`;

  let customerUserId: string;
  let driverUserId: string;

  let customerToken: string;
  let driverToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("StrongPassword123");

    // Create a CUSTOMER test user.
    const customer = await prisma.user.create({
      data: {
        name: "Test Customer",
        email: customerEmail,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerUserId = customer.id;

    // Create a DRIVER test user.
    const driver = await prisma.user.create({
      data: {
        name: "Test Driver",
        email: driverEmail,
        passwordHash,
        role: "DRIVER"
      }
    });

    driverUserId = driver.id;

    // Generate authentication tokens.
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
    // Delete dependent records before deleting users.
    if (customerUserId) {
      await prisma.customer.deleteMany({
        where: { userId: customerUserId }
      });
    }

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [customerUserId, driverUserId].filter(Boolean)
        }
      }
    });
  });

  it("should reject requests without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/customers/profile");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject DRIVER access", async () => {
    const response = await request(app)
      .post("/api/v1/customers/profile")
      .set("Cookie", `accessToken=${driverToken}`);

    expect(response.status).toBe(403);
  });

  it("should create a customer profile successfully", async () => {
    const response = await request(app)
      .post("/api/v1/customers/profile")
      .set("Cookie", `accessToken=${customerToken}`);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.customer.userId).toBe(
      customerUserId
    );

    // Verify that the profile actually exists in PostgreSQL.
    const savedCustomer = await prisma.customer.findUnique({
      where: {
        userId: customerUserId
      }
    });

    expect(savedCustomer).not.toBeNull();
    expect(savedCustomer?.userId).toBe(customerUserId);
  });

  it("should reject duplicate customer profile creation", async () => {
    const response = await request(app)
      .post("/api/v1/customers/profile")
      .set("Cookie", `accessToken=${customerToken}`);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Customer profile already exists"
    );
  });
});
