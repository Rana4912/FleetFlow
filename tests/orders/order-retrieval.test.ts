
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

describe("Order Retrieval API", () => {
  const suffix = randomUUID();

  let customerUserId: string;
  let anotherCustomerUserId: string;
  let adminUserId: string;
  let driverUserId: string;

  let customerToken: string;
  let anotherCustomerToken: string;
  let adminToken: string;
  let driverToken: string;

  let customerOrderId: string;
  let anotherCustomerOrderId: string;

  const createdOrderIds: string[] = [];
  const createdCustomerIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword("StrongPassword123");

    const customer = await prisma.user.create({
      data: {
        name: "Retrieval Customer",
        email: `retrieval-${suffix}@example.com`,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerUserId = customer.id;

    const anotherCustomer = await prisma.user.create({
      data: {
        name: "Another Customer",
        email: `another-${suffix}@example.com`,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    anotherCustomerUserId = anotherCustomer.id;

    const admin = await prisma.user.create({
      data: {
        name: "Retrieval Admin",
        email: `admin-${suffix}@example.com`,
        passwordHash,
        role: "ADMIN"
      }
    });

    adminUserId = admin.id;

    const driver = await prisma.user.create({
      data: {
        name: "Retrieval Driver",
        email: `driver-${suffix}@example.com`,
        passwordHash,
        role: "DRIVER"
      }
    });

    driverUserId = driver.id;

    const customerProfile = await prisma.customer.create({
      data: { userId: customerUserId }
    });

    createdCustomerIds.push(customerProfile.id);

    const anotherCustomerProfile = await prisma.customer.create({
      data: { userId: anotherCustomerUserId }
    });

    createdCustomerIds.push(anotherCustomerProfile.id);

    const customerOrder = await prisma.deliveryOrder.create({
      data: {
        customerId: customerProfile.id,
        pickupAddress: "Salt Lake Sector V, Kolkata",
        deliveryAddress: "New Town, Kolkata",
        recipientName: "Customer Recipient",
        recipientPhone: "9876543210",
        weightKg: 5
      }
    });

    customerOrderId = customerOrder.id;
    createdOrderIds.push(customerOrder.id);

    const anotherCustomerOrder = await prisma.deliveryOrder.create({
      data: {
        customerId: anotherCustomerProfile.id,
        pickupAddress: "Park Street, Kolkata",
        deliveryAddress: "Howrah, West Bengal",
        recipientName: "Another Recipient",
        recipientPhone: "9876543211",
        weightKg: 8
      }
    });

    anotherCustomerOrderId = anotherCustomerOrder.id;
    createdOrderIds.push(anotherCustomerOrder.id);

    customerToken = generateAccessToken({
      sub: customer.id,
      role: customer.role
    });

    anotherCustomerToken = generateAccessToken({
      sub: anotherCustomer.id,
      role: anotherCustomer.role
    });

    adminToken = generateAccessToken({
      sub: admin.id,
      role: admin.role
    });

    driverToken = generateAccessToken({
      sub: driver.id,
      role: driver.role
    });
  });

  afterAll(async () => {
    await prisma.deliveryOrder.deleteMany({
      where: { id: { in: createdOrderIds } }
    });

    await prisma.customer.deleteMany({
      where: { id: { in: createdCustomerIds } }
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            customerUserId,
            anotherCustomerUserId,
            adminUserId,
            driverUserId
          ].filter(Boolean)
        }
      }
    });
  });

  it("should reject unauthenticated requests", async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${customerOrderId}`);

    expect(response.status).toBe(401);
  });

  it("should allow a customer to retrieve their own order", async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${customerOrderId}`)
      .set("Cookie", `accessToken=${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.order.id).toBe(customerOrderId);
    expect(response.body.data.order.pickupAddress)
      .toBe("Salt Lake Sector V, Kolkata");
  });

  it("should hide another customer's order", async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${anotherCustomerOrderId}`)
      .set("Cookie", `accessToken=${customerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Order not found");
  });

  it("should allow ADMIN to retrieve any customer's order", async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${anotherCustomerOrderId}`)
      .set("Cookie", `accessToken=${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.order.id).toBe(anotherCustomerOrderId);
  });

  it("should reject DRIVER access", async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${customerOrderId}`)
      .set("Cookie", `accessToken=${driverToken}`);

    expect(response.status).toBe(403);
  });

  it("should reject invalid UUIDs", async () => {
    const response = await request(app)
      .get("/api/v1/orders/not-a-valid-uuid")
      .set("Cookie", `accessToken=${customerToken}`);

    expect(response.status).toBe(400);
  });

  it("should return 404 for a nonexistent order", async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${randomUUID()}`)
      .set("Cookie", `accessToken=${customerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Order not found");
  });
});
