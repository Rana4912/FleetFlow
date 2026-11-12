
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll
} from "vitest";

import { randomUUID } from "node:crypto";

import { prisma } from "../../src/infrastructure/database/prisma.js";
import { findEligibleResources } from "../../src/modules/dispatch/dispatch.eligibility.js";

describe("Dispatch Eligibility Engine", () => {
  const orderIds: string[] = [];
  const driverIds: string[] = [];
  const driverUserIds: string[] = [];
  const vehicleIds: string[] = [];
  const assignmentIds: string[] = [];
  const customerIds: string[] = [];
  const customerUserIds: string[] = [];

  let customerProfileId: string;

  beforeAll(async () => {
    const customerUser = await prisma.user.create({
      data: {
        name: "Dispatch Test Customer",
        email: `dispatch-customer-${randomUUID()}@test.com`,
        passwordHash: "test-hash",
        role: "CUSTOMER"
      }
    });

    customerUserIds.push(customerUser.id);

    const customer = await prisma.customer.create({
      data: {
        userId: customerUser.id
      }
    });

    customerProfileId = customer.id;
    customerIds.push(customer.id);
  });

  async function createOrder(
    status: "CREATED" | "CONFIRMED" | "ASSIGNED" = "CONFIRMED",
    weightKg = 50
  ) {
    const order = await prisma.deliveryOrder.create({
      data: {
        customerId: customerProfileId,
        pickupAddress: "Salt Lake, Kolkata",
        deliveryAddress: "New Town, Kolkata",
        recipientName: "Test Recipient",
        recipientPhone: "+919876543210",
        weightKg,
        status
      }
    });

    orderIds.push(order.id);
    return order;
  }

  async function createDriver(options?: {
    status?: "AVAILABLE" | "OFFLINE" | "ON_DELIVERY" | "SUSPENDED";
    isActive?: boolean;
  }) {
    const user = await prisma.user.create({
      data: {
        name: "Dispatch Driver",
        email: `dispatch-driver-${randomUUID()}@test.com`,
        passwordHash: "test-hash",
        role: "DRIVER",
        isActive: options?.isActive ?? true
      }
    });

    driverUserIds.push(user.id);

    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        licenseNumber: `LIC-${randomUUID()}`,
        status: options?.status ?? "AVAILABLE"
      }
    });

    driverIds.push(driver.id);
    return driver;
  }

  async function createVehicle(options?: {
    status?: "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "INACTIVE";
    capacityKg?: number;
  }) {
    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `WB-${randomUUID().slice(0, 8)}`,
        capacityKg: options?.capacityKg ?? 100,
        status: options?.status ?? "AVAILABLE"
      }
    });

    vehicleIds.push(vehicle.id);
    return vehicle;
  }

  afterAll(async () => {
    await prisma.deliveryAssignment.deleteMany({
      where: {
        id: { in: assignmentIds }
      }
    });

    await prisma.orderStatusHistory.deleteMany({
      where: {
        orderId: { in: orderIds }
      }
    });

    await prisma.deliveryOrder.deleteMany({
      where: {
        id: { in: orderIds }
      }
    });

    await prisma.driver.deleteMany({
      where: {
        id: { in: driverIds }
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: driverUserIds }
      }
    });

    await prisma.vehicle.deleteMany({
      where: {
        id: { in: vehicleIds }
      }
    });

    await prisma.customer.deleteMany({
      where: {
        id: { in: customerIds }
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: customerUserIds }
      }
    });
  });



  it("returns eligible drivers and vehicles", async () => {
    const order = await createOrder();

    const driver = await createDriver();
    const vehicle = await createVehicle({
      capacityKg: 100
    });

    const result = await findEligibleResources(order.id);

    expect(result.order.id).toBe(order.id);

    expect(result.drivers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: driver.id,
          name: "Dispatch Driver"
        })
      ])
    );

    expect(result.vehicles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: vehicle.id,
          capacityKg: 100
        })
      ])
    );
  });

  it("excludes drivers who are not AVAILABLE", async () => {
    const order = await createOrder();

    const offlineDriver = await createDriver({
      status: "OFFLINE"
    });

    const result = await findEligibleResources(order.id);

    expect(
      result.drivers.some(
        (driver) => driver.id === offlineDriver.id
      )
    ).toBe(false);
  });

  it("excludes drivers with inactive accounts", async () => {
    const order = await createOrder();

    const inactiveDriver = await createDriver({
      isActive: false
    });

    const result = await findEligibleResources(order.id);

    expect(
      result.drivers.some(
        (driver) => driver.id === inactiveDriver.id
      )
    ).toBe(false);
  });

  it("excludes vehicles with insufficient capacity", async () => {
    const order = await createOrder("CONFIRMED", 80);

    const smallVehicle = await createVehicle({
      capacityKg: 50
    });

    const result = await findEligibleResources(order.id);

    expect(
      result.vehicles.some(
        (vehicle) => vehicle.id === smallVehicle.id
      )
    ).toBe(false);
  });

  it("excludes vehicles that are not AVAILABLE", async () => {
    const order = await createOrder();

    const vehicle = await createVehicle({
      status: "MAINTENANCE"
    });

    const result = await findEligibleResources(order.id);

    expect(
      result.vehicles.some(
        (item) => item.id === vehicle.id
      )
    ).toBe(false);
  });

  it("rejects orders that are not CONFIRMED", async () => {
    const order = await createOrder("CREATED");

    await expect(
      findEligibleResources(order.id)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Only confirmed orders can be dispatched"
    });
  });

  it("returns 404 for a nonexistent order", async () => {
    await expect(
      findEligibleResources(randomUUID())
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Order not found"
    });
  });

  it("excludes drivers with an active assignment", async () => {
    const assignedOrder = await createOrder();
    const targetOrder = await createOrder();

    const driver = await createDriver();
    const vehicle = await createVehicle();

    const assignment = await prisma.deliveryAssignment.create({
      data: {
        orderId: assignedOrder.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        status: "ACTIVE"
      }
    });

    assignmentIds.push(assignment.id);

    const result = await findEligibleResources(targetOrder.id);

    expect(
      result.drivers.some(item => item.id === driver.id)
    ).toBe(false);
  });

  it("excludes vehicles with an active assignment", async () => {
    const assignedOrder = await createOrder();
    const targetOrder = await createOrder();

    const driver = await createDriver();
    const vehicle = await createVehicle();

    const assignment = await prisma.deliveryAssignment.create({
      data: {
        orderId: assignedOrder.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        status: "ACTIVE"
      }
    });

    assignmentIds.push(assignment.id);

    const result = await findEligibleResources(targetOrder.id);

    expect(
      result.vehicles.some(item => item.id === vehicle.id)
    ).toBe(false);
  });
});
