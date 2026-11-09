
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

describe("Assignment Lifecycle API", () => {
  const suffix = randomUUID();

  let customerId: string;
  let customerProfileId: string;

  const driverIds: string[] = [];
  const driverUserIds: string[] = [];
  const vehicleIds: string[] = [];
  const orderIds: string[] = [];
  const assignmentIds: string[] = [];

  let passwordHash: string;

  async function createDriver() {
    const user = await prisma.user.create({
      data: {
        name: "Lifecycle Driver",
        email: `lifecycle-driver-${randomUUID()}@test.com`,
        passwordHash,
        role: "DRIVER"
      }
    });

    driverUserIds.push(user.id);

    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        licenseNumber: `LIC-${randomUUID()}`,
        status: "ON_DELIVERY"
      }
    });

    driverIds.push(driver.id);

    return {
      id: driver.id,
      userId: user.id,
      token: generateAccessToken({
        sub: user.id,
        role: "DRIVER"
      })
    };
  }

  async function createScenario() {
    const driver = await createDriver();

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `WB-${randomUUID().slice(0, 8)}`,
        capacityKg: 100,
        status: "IN_USE"
      }
    });

    vehicleIds.push(vehicle.id);

    const order = await prisma.deliveryOrder.create({
      data: {
        customerId: customerProfileId,
        pickupAddress: "Salt Lake, Kolkata",
        deliveryAddress: "New Town, Kolkata",
        recipientName: "Test Recipient",
        recipientPhone: "+919876543210",
        weightKg: 50,
        status: "ASSIGNED"
      }
    });

    orderIds.push(order.id);

    const assignment = await prisma.deliveryAssignment.create({
      data: {
        orderId: order.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        status: "ACTIVE"
      }
    });

    assignmentIds.push(assignment.id);

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: "ASSIGNED",
        note: "Order assigned to a driver and vehicle"
      }
    });

    return {
      driver,
      vehicleId: vehicle.id,
      orderId: order.id,
      assignmentId: assignment.id
    };
  }

  async function updateStatus(
    assignmentId: string,
    token: string,
    status: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "FAILED"
  ) {
    return request(app)
      .patch(`/api/v1/assignments/${assignmentId}/status`)
      .set("Cookie", `accessToken=${token}`)
      .send({ status });
  }

  beforeAll(async () => {
    passwordHash = await hashPassword("TestPassword123!");

    const customer = await prisma.user.create({
      data: {
        name: "Lifecycle Test Customer",
        email: `lifecycle-customer-${suffix}@test.com`,
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
  });

  afterAll(async () => {
    await prisma.deliveryAssignment.deleteMany({
      where: { id: { in: assignmentIds } }
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

    await prisma.vehicle.deleteMany({
      where: { id: { in: vehicleIds } }
    });

    await prisma.user.deleteMany({
      where: { id: { in: driverUserIds } }
    });

    await prisma.customer.deleteMany({
      where: { id: customerProfileId }
    });

    await prisma.user.deleteMany({
      where: { id: customerId }
    });
  });

  it("should allow the assigned driver to pick up an order", async () => {
    const scenario = await createScenario();

    const response = await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "PICKED_UP"
    );

    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe("PICKED_UP");
    expect(response.body.data.assignment.status).toBe("ACTIVE");
  });

  it("should allow the assigned driver to start transit after pickup", async () => {
    const scenario = await createScenario();

    await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "PICKED_UP"
    );

    const response = await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "IN_TRANSIT"
    );

    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe("IN_TRANSIT");
    expect(response.body.data.assignment.status).toBe("ACTIVE");
  });

  it("should reject another driver's attempt to update the assignment", async () => {
    const scenario = await createScenario();
    const anotherDriver = await createDriver();

    const response = await updateStatus(
      scenario.assignmentId,
      anotherDriver.token,
      "PICKED_UP"
    );

    expect(response.status).toBe(404);

    const order = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: scenario.orderId }
    });

    expect(order.status).toBe("ASSIGNED");
  });

  it("should reject invalid status transitions", async () => {
    const scenario = await createScenario();

    const response = await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "IN_TRANSIT"
    );

    expect(response.status).toBe(409);

    const order = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: scenario.orderId }
    });

    expect(order.status).toBe("ASSIGNED");

    const assignment = await prisma.deliveryAssignment.findUniqueOrThrow({
      where: { id: scenario.assignmentId }
    });

    expect(assignment.status).toBe("ACTIVE");
  });

  it("should complete a successful delivery and release resources", async () => {
    const scenario = await createScenario();

    await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "PICKED_UP"
    );

    await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "IN_TRANSIT"
    );

    const response = await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "DELIVERED"
    );

    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe("DELIVERED");
    expect(response.body.data.assignment.status).toBe("COMPLETED");
    expect(response.body.data.assignment.releasedAt).not.toBeNull();

    const driver = await prisma.driver.findUniqueOrThrow({
      where: { id: scenario.driver.id }
    });

    expect(driver.status).toBe("AVAILABLE");

    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: scenario.vehicleId }
    });

    expect(vehicle.status).toBe("AVAILABLE");

    const order = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: scenario.orderId }
    });

    expect(order.status).toBe("DELIVERED");

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: scenario.orderId },
      orderBy: { changedAt: "asc" }
    });

    expect(history.map((entry) => entry.status)).toEqual([
      "ASSIGNED",
      "PICKED_UP",
      "IN_TRANSIT",
      "DELIVERED"
    ]);
  });

  it("should complete a failed delivery and release resources", async () => {
    const scenario = await createScenario();

    await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "PICKED_UP"
    );

    const response = await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "FAILED"
    );

    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe("FAILED");
    expect(response.body.data.assignment.status).toBe("COMPLETED");

    const driver = await prisma.driver.findUniqueOrThrow({
      where: { id: scenario.driver.id }
    });

    expect(driver.status).toBe("AVAILABLE");

    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: scenario.vehicleId }
    });

    expect(vehicle.status).toBe("AVAILABLE");
  });

  it("should reject updates to a completed assignment", async () => {
    const scenario = await createScenario();

    await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "PICKED_UP"
    );

    await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "IN_TRANSIT"
    );

    await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "DELIVERED"
    );

    const response = await updateStatus(
      scenario.assignmentId,
      scenario.driver.token,
      "FAILED"
    );

    expect(response.status).toBe(404);
  });
});
