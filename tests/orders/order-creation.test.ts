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

describe("Order Creation API", () => {
  const customerEmail = `customer-${randomUUID()}@example.com`;
  const customerWithoutProfileEmail = `customer-${randomUUID()}@example.com`;
  const driverEmail = `driver-${randomUUID()}@example.com`;
  const adminEmail = `admin-${randomUUID()}@example.com`;

  let customerUserId: string;
  let customerWithoutProfileUserId: string;
  let driverUserId: string;
  let adminUserId: string;

  let customerId: string;

  let customerToken: string;
  let customerWithoutProfileToken: string;
  let driverToken: string;
  let adminToken: string;

  const createdOrderIds: string[] = [];

  const validOrder = {
    pickupAddress: "Salt Lake Sector V, Kolkata",
    deliveryAddress: "New Town, Kolkata",
    recipientName: "Rahul Sharma",
    recipientPhone: "9876543210",
    weightKg: 5,
    deadline: "2026-11-10T18:00:00.000Z"
  };

  beforeAll(async () => {
    const passwordHash = await hashPassword("StrongPassword123");

    const customer = await prisma.user.create({
      data: {
        name: "Test Customer",
        email: customerEmail,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerUserId = customer.id;

    const customerWithoutProfile = await prisma.user.create({
      data: {
        name: "Customer Without Profile",
        email: customerWithoutProfileEmail,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerWithoutProfileUserId = customerWithoutProfile.id;

    const driver = await prisma.user.create({
      data: {
        name: "Test Driver",
        email: driverEmail,
        passwordHash,
        role: "DRIVER"
      }
    });

    driverUserId = driver.id;

    const admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN"
      }
    });

    adminUserId = admin.id;

    // Create a profile only for the first customer.
    const customerProfile = await prisma.customer.create({
      data: {
        userId: customerUserId
      }
    });

    customerId = customerProfile.id;

    customerToken = generateAccessToken({
      sub: customer.id,
      role: customer.role
    });

    customerWithoutProfileToken = generateAccessToken({
      sub: customerWithoutProfile.id,
      role: customerWithoutProfile.role
    });

    driverToken = generateAccessToken({
      sub: driver.id,
      role: driver.role
    });

    adminToken = generateAccessToken({
      sub: admin.id,
      role: admin.role
    });
  });

  afterAll(async () => {
    // Delete orders before deleting customer profiles.
    await prisma.deliveryOrder.deleteMany({
      where: {
        id: {
          in: createdOrderIds
        }
      }
    });

    await prisma.customer.deleteMany({
      where: {
        userId: {
          in: [customerUserId, customerWithoutProfileUserId].filter(Boolean)
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            customerUserId,
            customerWithoutProfileUserId,
            driverUserId,
            adminUserId
          ].filter(Boolean)
        }
      }
    });
  });

  it("should reject requests without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .send(validOrder);

    expect(response.status).toBe(401);
  });

  it("should reject DRIVER access", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Cookie", `accessToken=${driverToken}`)
      .send(validOrder);

    expect(response.status).toBe(403);
  });

  it("should reject ADMIN access", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Cookie", `accessToken=${adminToken}`)
      .send(validOrder);

    expect(response.status).toBe(403);
  });

  it("should reject customers without a profile", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Cookie", `accessToken=${customerWithoutProfileToken}`)
      .send(validOrder);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      "Customer profile not found. Create your customer profile first."
    );
  });

  it("should create an order successfully", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Cookie", `accessToken=${customerToken}`)
      .send(validOrder);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const order = response.body.data.order;

    createdOrderIds.push(order.id);

    expect(order.customerId).toBe(customerId);
    expect(order.pickupAddress).toBe(validOrder.pickupAddress);
    expect(order.deliveryAddress).toBe(validOrder.deliveryAddress);
    expect(order.recipientName).toBe(validOrder.recipientName);
    expect(order.recipientPhone).toBe(validOrder.recipientPhone);
    expect(Number(order.weightKg)).toBe(5);
    expect(order.status).toBe("CREATED");

    // Verify persistence in PostgreSQL.
    const savedOrder = await prisma.deliveryOrder.findUnique({
      where: {
        id: order.id
      }
    });

    expect(savedOrder).not.toBeNull();
    expect(savedOrder?.customerId).toBe(customerId);
    expect(savedOrder?.status).toBe("CREATED");
  });

  it("should reject invalid order weight", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Cookie", `accessToken=${customerToken}`)
      .send({
        ...validOrder,
        weightKg: -5
      });

    expect(response.status).toBe(400);
  });

  it("should reject invalid recipient phone number", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Cookie", `accessToken=${customerToken}`)
      .send({
        ...validOrder,
        recipientPhone: "abc123"
      });

    expect(response.status).toBe(400);
  });

  it("should reject unexpected request fields", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Cookie", `accessToken=${customerToken}`)
      .send({
        ...validOrder,
        customerId: randomUUID(),
        status: "DELIVERED"
      });

    expect(response.status).toBe(400);
  });
});