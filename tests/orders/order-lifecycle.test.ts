
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

describe("Order Lifecycle API", () => {
  const suffix = randomUUID();

  let customerId: string;
  let anotherCustomerId: string;
  let adminId: string;
  let driverId: string;

  let customerToken: string;
  let anotherCustomerToken: string;
  let adminToken: string;
  let driverToken: string;

  let customerOrderId: string;
  let anotherCustomerOrderId: string;
  let confirmedOrderId: string;
  let cancelledOrderId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("TestPassword123!");

    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: "Lifecycle Customer",
          email: `lifecycle-customer-${suffix}@test.com`,
          passwordHash,
          role: "CUSTOMER"
        }
      }),
      prisma.user.create({
        data: {
          name: "Another Lifecycle Customer",
          email: `lifecycle-other-${suffix}@test.com`,
          passwordHash,
          role: "CUSTOMER"
        }
      }),
      prisma.user.create({
        data: {
          name: "Lifecycle Admin",
          email: `lifecycle-admin-${suffix}@test.com`,
          passwordHash,
          role: "ADMIN"
        }
      }),
      prisma.user.create({
        data: {
          name: "Lifecycle Driver",
          email: `lifecycle-driver-${suffix}@test.com`,
          passwordHash,
          role: "DRIVER"
        }
      })
    ]);

    [customerId, anotherCustomerId, adminId, driverId] =
      users.map((user) => user.id);

    const customers = await Promise.all([
      prisma.customer.create({
        data: { userId: customerId }
      }),
      prisma.customer.create({
        data: { userId: anotherCustomerId }
      })
    ]);

    const createOrder = async (customerProfileId: string) => {
      return prisma.deliveryOrder.create({
        data: {
          customerId: customerProfileId,
          pickupAddress: "Salt Lake, Kolkata",
          deliveryAddress: "New Town, Kolkata",
          recipientName: "Test Recipient",
          recipientPhone: "+919876543210",
          weightKg: 5
        }
      });
    };

    const orders = await Promise.all([
      createOrder(customers[0].id),
      createOrder(customers[1].id),
      createOrder(customers[0].id),
      createOrder(customers[0].id)
    ]);

    customerOrderId = orders[0].id;
    anotherCustomerOrderId = orders[1].id;
    confirmedOrderId = orders[2].id;
    cancelledOrderId = orders[3].id;

    // Prepare a terminal order.
    await prisma.deliveryOrder.update({
      where: { id: cancelledOrderId },
      data: { status: "CANCELLED" }
    });

    customerToken = generateAccessToken({
      sub: customerId,
      role: "CUSTOMER"
    });

    anotherCustomerToken = generateAccessToken({
      sub: anotherCustomerId,
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
    const orderIds = [
      customerOrderId,
      anotherCustomerOrderId,
      confirmedOrderId,
      cancelledOrderId
    ];

    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: orderIds } }
    });

    await prisma.deliveryOrder.deleteMany({
      where: { id: { in: orderIds } }
    });

    await prisma.customer.deleteMany({
      where: {
        userId: { in: [customerId, anotherCustomerId] }
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [customerId, anotherCustomerId, adminId, driverId] }
      }
    });
  });

  it("should reject unauthenticated requests", async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${customerOrderId}/status`)
      .send({ status: "CANCELLED" });

    expect(response.status).toBe(401);
  });

  it("should allow a customer to cancel their own CREATED order", async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${customerOrderId}/status`)
      .set("Cookie", `accessToken=${customerToken}`)
      .send({ status: "CANCELLED" });

    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe("CANCELLED");

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: customerOrderId }
    });

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("CANCELLED");
    expect(history[0].note).toContain("CREATED");
  });

  it("should prevent a customer from cancelling another customer's order", async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${anotherCustomerOrderId}/status`)
      .set("Cookie", `accessToken=${customerToken}`)
      .send({ status: "CANCELLED" });

    expect(response.status).toBe(404);
  });

  it("should allow an admin to confirm an order but reject direct assignment", async () => {
    // First, admin confirms the CREATED order.
    const confirmResponse = await request(app)
      .patch(`/api/v1/orders/${confirmedOrderId}/status`)
      .set("Cookie", `accessToken=${adminToken}`)
      .send({ status: "CONFIRMED" });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.data.order.status).toBe("CONFIRMED");

    // Admin must not bypass the assignment workflow.
    const assignmentResponse = await request(app)
      .patch(`/api/v1/orders/${confirmedOrderId}/status`)
      .set("Cookie", `accessToken=${adminToken}`)
      .send({ status: "ASSIGNED" });

    expect(assignmentResponse.status).toBe(409);

    // Verify that the order remains CONFIRMED.
    const order = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: confirmedOrderId }
    });

    expect(order.status).toBe("CONFIRMED");

    // Verify that no assignment was created.
    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { orderId: confirmedOrderId }
    });

    expect(assignment).toBeNull();

    // Verify the status history contains only the confirmation.
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: confirmedOrderId }
    });

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("CONFIRMED");
  });

  it("should reject drivers until assignment authorization is implemented", async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${customerOrderId}/status`)
      .set("Cookie", `accessToken=${driverToken}`)
      .send({ status: "IN_TRANSIT" });

    expect(response.status).toBe(403);
  });

  it("should reject invalid order IDs", async () => {
    const response = await request(app)
      .patch("/api/v1/orders/invalid-id/status")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({ status: "CONFIRMED" });

    expect(response.status).toBe(400);
  });

  it("should reject invalid status values", async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${customerOrderId}/status`)
      .set("Cookie", `accessToken=${adminToken}`)
      .send({ status: "UNKNOWN" });

    expect(response.status).toBe(400);
  });

  it("should reject unexpected request properties", async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${customerOrderId}/status`)
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        status: "CONFIRMED",
        customerId
      });

    expect(response.status).toBe(400);
  });
});
