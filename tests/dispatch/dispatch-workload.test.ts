
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll
} from "vitest";

import { randomUUID } from "node:crypto";

import { prisma } from "../../src/infrastructure/database/prisma.js";
import { getRecentWorkloads } from "../../src/modules/dispatch/dispatch.workload.js";

describe("Dispatch Workload Aggregation", () => {
  const orderIds: string[] = [];
  const driverIds: string[] = [];
  const driverUserIds: string[] = [];
  const vehicleIds: string[] = [];
  const assignmentIds: string[] = [];
  const customerIds: string[] = [];
  const customerUserIds: string[] = [];

  let customerProfileId: string;

  const referenceDate = new Date();
  const sevenDaysAgo = new Date(
    referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000
  );

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: "Workload Test Customer",
        email: `workload-customer-${randomUUID()}@test.com`,
        passwordHash: "test-hash",
        role: "CUSTOMER"
      }
    });

    customerUserIds.push(user.id);

    const customer = await prisma.customer.create({
      data: {
        userId: user.id
      }
    });

    customerProfileId = customer.id;
    customerIds.push(customer.id);
  });

  async function createOrder() {
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
    return order;
  }

  async function createDriver() {
    const user = await prisma.user.create({
      data: {
        name: "Workload Test Driver",
        email: `workload-driver-${randomUUID()}@test.com`,
        passwordHash: "test-hash",
        role: "DRIVER"
      }
    });

    driverUserIds.push(user.id);

    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        licenseNumber: `LIC-${randomUUID()}`,
        status: "AVAILABLE"
      }
    });

    driverIds.push(driver.id);
    return driver;
  }

  async function createVehicle() {
    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `WB-${randomUUID().slice(0, 8)}`,
        capacityKg: 100,
        status: "AVAILABLE"
      }
    });

    vehicleIds.push(vehicle.id);
    return vehicle;
  }

  async function createAssignment(
    driverId: string,
    vehicleId: string,
    status: "ACTIVE" | "COMPLETED",
    releasedAt: Date | null
  ) {
    const order = await createOrder();

    const assignment = await prisma.deliveryAssignment.create({
      data: {
        orderId: order.id,
        driverId,
        vehicleId,
        status,
        releasedAt
      }
    });

    assignmentIds.push(assignment.id);
    return assignment;
  }

  afterAll(async () => {
    await prisma.deliveryAssignment.deleteMany({
      where: { id: { in: assignmentIds } }
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
      where: { id: { in: customerIds } }
    });

    await prisma.user.deleteMany({
      where: { id: { in: customerUserIds } }
    });
  });

  it("counts recent completed deliveries for drivers and vehicles", async () => {
    const driver = await createDriver();
    const vehicle = await createVehicle();

    const recentCompletion = new Date(
      referenceDate.getTime() - 24 * 60 * 60 * 1000
    );

    await createAssignment(
      driver.id,
      vehicle.id,
      "COMPLETED",
      recentCompletion
    );

    await createAssignment(
      driver.id,
      vehicle.id,
      "COMPLETED",
      recentCompletion
    );

    const result = await getRecentWorkloads(sevenDaysAgo);

    expect(result.driverWorkloads.get(driver.id)).toBe(2);
    expect(result.vehicleWorkloads.get(vehicle.id)).toBe(2);
  });

  it("excludes completed assignments older than seven days", async () => {
    const driver = await createDriver();
    const vehicle = await createVehicle();

    const oldCompletion = new Date(
      referenceDate.getTime() - 8 * 24 * 60 * 60 * 1000
    );

    await createAssignment(
      driver.id,
      vehicle.id,
      "COMPLETED",
      oldCompletion
    );

    const result = await getRecentWorkloads(sevenDaysAgo);

    expect(result.driverWorkloads.has(driver.id)).toBe(false);
    expect(result.vehicleWorkloads.has(vehicle.id)).toBe(false);
  });

  it("excludes active assignments from workload counts", async () => {
    const driver = await createDriver();
    const vehicle = await createVehicle();

    await createAssignment(
      driver.id,
      vehicle.id,
      "ACTIVE",
      null
    );

    const result = await getRecentWorkloads(sevenDaysAgo);

    expect(result.driverWorkloads.has(driver.id)).toBe(false);
    expect(result.vehicleWorkloads.has(vehicle.id)).toBe(false);
  });

  
it("returns zero workload for drivers and vehicles without completed assignments", async () => {
    const driver = await createDriver();
    const vehicle = await createVehicle();

    const result = await getRecentWorkloads(sevenDaysAgo);

    expect(result.driverWorkloads.has(driver.id)).toBe(false);
    expect(result.vehicleWorkloads.has(vehicle.id)).toBe(false);

    expect(result.driverWorkloads.get(driver.id) ?? 0).toBe(0);
    expect(result.vehicleWorkloads.get(vehicle.id) ?? 0).toBe(0);
  });   

});
