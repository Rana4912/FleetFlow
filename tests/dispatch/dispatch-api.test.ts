
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

const { autoDispatchOrderMock } = vi.hoisted(() => ({
  autoDispatchOrderMock: vi.fn()
}));

vi.mock("../../src/modules/dispatch/dispatch.service.js", () => ({
  autoDispatchOrder: autoDispatchOrderMock
}));

import app from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { hashPassword } from "../../src/modules/auth/password.js";
import { generateAccessToken } from "../../src/modules/auth/token.js";
import { AppError } from "../../src/shared/errors/app-error.js";

describe("Automated Dispatch API", () => {
  const suffix = randomUUID();

  let adminId: string;
  let customerId: string;
  let customerProfileId: string;

  let adminToken: string;
  let customerToken: string;

  const orderIds: string[] = [];
  const driverIds: string[] = [];
  const driverUserIds: string[] = [];
  const vehicleIds: string[] = [];

  async function createScenario(options?: {
    driverStatus?: "AVAILABLE" | "OFFLINE";
    vehicleStatus?: "AVAILABLE" | "IN_USE";
    capacityKg?: number;
  }) {
    const order = await prisma.deliveryOrder.create({
      data: {
        customerId: customerProfileId,
        pickupAddress: "Salt Lake, Kolkata",
        deliveryAddress: "New Town, Kolkata",
        recipientName: "Test Recipient",
        recipientPhone: "+919876543210",
        weightKg: 50,
        status: "CONFIRMED"
      }
    });

    orderIds.push(order.id);

    const driverUser = await prisma.user.create({
      data: {
        name: "Dispatch Driver",
        email: `dispatch-driver-${randomUUID()}@test.com`,
        passwordHash: "test-hash",
        role: "DRIVER"
      }
    });

    driverUserIds.push(driverUser.id);

    const driver = await prisma.driver.create({
      data: {
        userId: driverUser.id,
        licenseNumber: `LIC-${randomUUID()}`,
        status: options?.driverStatus ?? "AVAILABLE"
      }
    });

    driverIds.push(driver.id);

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `WB-${randomUUID().slice(0, 8)}`,
        capacityKg: options?.capacityKg ?? 100,
        status: options?.vehicleStatus ?? "AVAILABLE"
      }
    });

    vehicleIds.push(vehicle.id);

    return {
      orderId: order.id,
      driverId: driver.id,
      vehicleId: vehicle.id
    };
  }

  async function dispatch(orderId: string, token = adminToken) {
    return request(app)
      .post(`/api/v1/dispatch/${orderId}`)
      .set("Cookie", `accessToken=${token}`);
  }

  beforeAll(async () => {
    const passwordHash = await hashPassword("TestPassword123!");

    const admin = await prisma.user.create({
      data: {
        name: "Dispatch Admin",
        email: `dispatch-admin-${suffix}@test.com`,
        passwordHash,
        role: "ADMIN"
      }
    });

    adminId = admin.id;

    const customer = await prisma.user.create({
      data: {
        name: "Dispatch Customer",
        email: `dispatch-customer-${suffix}@test.com`,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerId = customer.id;

    const customerProfile = await prisma.customer.create({
      data: {
        userId: customer.id
      }
    });

    customerProfileId = customerProfile.id;

    adminToken = generateAccessToken({
      sub: admin.id,
      role: "ADMIN"
    });

    customerToken = generateAccessToken({
      sub: customer.id,
      role: "CUSTOMER"
    });
  });

  beforeEach(() => {
    autoDispatchOrderMock.mockReset();
    autoDispatchOrderMock.mockResolvedValue({});
  });

  afterAll(async () => {
    await prisma.deliveryAssignment.deleteMany({
      where: { orderId: { in: orderIds } }
    });

    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: { in: orderIds } }
    });

    await prisma.deliveryOrder.deleteMany({
      where: { id: { in: orderIds } }
    });

    await prisma.driver.deleteMany({
      where: { id: { in: driverIds } }
    });

    await prisma.user.deleteMany({
      where: { id: { in: driverUserIds } }
    });

    await prisma.vehicle.deleteMany({
      where: { id: { in: vehicleIds } }
    });

    await prisma.customer.deleteMany({
      where: { id: customerProfileId }
    });

    await prisma.user.deleteMany({
      where: { id: { in: [adminId, customerId] } }
    });
  });

  it("should allow an admin to access the dispatch endpoint", async () => {
    const scenario = await createScenario();

    const response = await dispatch(scenario.orderId);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(autoDispatchOrderMock).toHaveBeenCalledWith(
      scenario.orderId
    );
  });

  it("should reject a customer from accessing dispatch", async () => {
    const scenario = await createScenario();

    const response = await dispatch(
      scenario.orderId,
      customerToken
    );

    expect(response.status).toBe(403);
    expect(autoDispatchOrderMock).not.toHaveBeenCalled();
  });

  it("should reject an invalid order ID", async () => {
    const response = await dispatch("invalid-order-id");

    expect(response.status).toBe(400);
    expect(autoDispatchOrderMock).not.toHaveBeenCalled();
  });

  it("should reject unauthenticated requests", async () => {
    const scenario = await createScenario();

    const response = await request(app)
      .post(`/api/v1/dispatch/${scenario.orderId}`);

    expect(response.status).toBe(401);
    expect(autoDispatchOrderMock).not.toHaveBeenCalled();
  });

  it("should return 409 when no eligible drivers exist", async () => {
    const scenario = await createScenario({
      driverStatus: "OFFLINE"
    });

    autoDispatchOrderMock.mockRejectedValueOnce(
      new AppError(
        "No eligible driver and vehicle combinations found",
        409
      )
    );

    const response = await dispatch(scenario.orderId);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "No eligible driver and vehicle combinations found"
    );
  });

  it("should return 409 when no vehicle has sufficient capacity", async () => {
    const scenario = await createScenario({
      capacityKg: 20
    });

    autoDispatchOrderMock.mockRejectedValueOnce(
      new AppError(
        "No eligible driver and vehicle combinations found",
        409
      )
    );

    const response = await dispatch(scenario.orderId);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "No eligible driver and vehicle combinations found"
    );
  });

  it("should reject dispatching an order that is not CONFIRMED", async () => {
    const scenario = await createScenario();

    autoDispatchOrderMock.mockRejectedValueOnce(
      new AppError(
        "Only confirmed orders can be dispatched",
        409
      )
    );

    const response = await dispatch(scenario.orderId);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Only confirmed orders can be dispatched"
    );
  });
});
