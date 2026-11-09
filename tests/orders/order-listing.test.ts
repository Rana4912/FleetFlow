
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

describe("Order Listing API", () => {
  const suffix = randomUUID();

  let customer1Id: string;
  let customer2Id: string;
  let adminId: string;
  let driverId: string;

  let customer1Token: string;
  let customer2Token: string;
  let adminToken: string;
  let driverToken: string;

  let customer1Orders: string[] = [];
  let customer2Orders: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword("TestPassword123!");

    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: "Listing Customer One",
          email: `listing-customer1-${suffix}@test.com`,
          passwordHash,
          role: "CUSTOMER"
        }
      }),
      prisma.user.create({
        data: {
          name: "Listing Customer Two",
          email: `listing-customer2-${suffix}@test.com`,
          passwordHash,
          role: "CUSTOMER"
        }
      }),
      prisma.user.create({
        data: {
          name: "Listing Admin",
          email: `listing-admin-${suffix}@test.com`,
          passwordHash,
          role: "ADMIN"
        }
      }),
      prisma.user.create({
        data: {
          name: "Listing Driver",
          email: `listing-driver-${suffix}@test.com`,
          passwordHash,
          role: "DRIVER"
        }
      })
    ]);

    [customer1Id, customer2Id, adminId, driverId] =
      users.map((user) => user.id);

    const customers = await Promise.all([
      prisma.customer.create({
        data: { userId: customer1Id }
      }),
      prisma.customer.create({
        data: { userId: customer2Id }
      })
    ]);

    const createTestOrders = async (
      customerId: string,
      count: number
    ) => {
      const ids: string[] = [];

      for (let i = 0; i < count; i++) {
        const order = await prisma.deliveryOrder.create({
          data: {
            customerId,
            pickupAddress: `Pickup ${i} ${suffix}`,
            deliveryAddress: `Delivery ${i} ${suffix}`,
            recipientName: `Recipient ${i}`,
            recipientPhone: "+919876543210",
            weightKg: 5 + i,
            status: i % 2 === 0 ? "CREATED" : "CONFIRMED"
          }
        });

        ids.push(order.id);
      }

      return ids;
    };

    customer1Orders = await createTestOrders(customers[0].id, 5);
    customer2Orders = await createTestOrders(customers[1].id, 3);

    customer1Token = generateAccessToken({
      sub: customer1Id,
      role: "CUSTOMER"
    });

    customer2Token = generateAccessToken({
      sub: customer2Id,
      role: "CUSTOMER"
    });

    adminToken = generateAccessToken({
      sub: adminId,
      role: "ADMIN"
    });

    driverToken = generateAccessToken({
      sub: driverId,
      role: "DRIVER"
    });
  });

  afterAll(async () => {
    await prisma.deliveryOrder.deleteMany({
      where: {
        id: {
          in: [...customer1Orders, ...customer2Orders]
        }
      }
    });

    await prisma.customer.deleteMany({
      where: {
        userId: {
          in: [customer1Id, customer2Id]
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [customer1Id, customer2Id, adminId, driverId]
        }
      }
    });
  });

  it("should reject unauthenticated requests", async () => {
    const response = await request(app)
      .get("/api/v1/orders");

    expect(response.status).toBe(401);
  });

  it("should reject drivers", async () => {
    const response = await request(app)
      .get("/api/v1/orders")
      .set("Cookie", `accessToken=${driverToken}`);

    expect(response.status).toBe(403);
  });

  it("should list only the authenticated customer's orders", async () => {
    const response = await request(app)
      .get("/api/v1/orders")
      .set("Cookie", `accessToken=${customer1Token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.orders).toHaveLength(5);
    expect(response.body.data.pagination.total).toBe(5);

    for (const order of response.body.data.orders) {
      expect(customer1Orders).toContain(order.id);
    }
  });

  it("should allow admins to list all customers' orders", async () => {
    const response = await request(app)
      .get("/api/v1/orders")
      .set("Cookie", `accessToken=${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(8);
  });

  it("should paginate orders correctly", async () => {
    const response = await request(app)
      .get("/api/v1/orders?page=1&limit=2")
      .set("Cookie", `accessToken=${customer1Token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.orders).toHaveLength(2);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3
    });
  });

  it("should filter orders by status", async () => {
    const response = await request(app)
      .get("/api/v1/orders?status=CREATED")
      .set("Cookie", `accessToken=${customer1Token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.orders).toHaveLength(3);

    for (const order of response.body.data.orders) {
      expect(order.status).toBe("CREATED");
    }
  });

  it("should reject invalid page numbers", async () => {
    const response = await request(app)
      .get("/api/v1/orders?page=0")
      .set("Cookie", `accessToken=${customer1Token}`);

    expect(response.status).toBe(400);
  });

  it("should reject limits greater than 100", async () => {
    const response = await request(app)
      .get("/api/v1/orders?limit=101")
      .set("Cookie", `accessToken=${customer1Token}`);

    expect(response.status).toBe(400);
  });

  it("should reject invalid order statuses", async () => {
    const response = await request(app)
      .get("/api/v1/orders?status=INVALID")
      .set("Cookie", `accessToken=${customer1Token}`);

    expect(response.status).toBe(400);
  });

  it("should reject unexpected query parameters", async () => {
    const response = await request(app)
      .get("/api/v1/orders?unknown=value")
      .set("Cookie", `accessToken=${customer1Token}`);

    expect(response.status).toBe(400);
  });
});
