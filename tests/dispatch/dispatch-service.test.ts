
import {
  describe,
  it,
  expect,
  afterAll
} from "vitest";

import { randomUUID } from "node:crypto";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import {
  getDispatchRecommendations
} from "../../src/modules/dispatch/dispatch.service.js";

describe("Automated Dispatch Service", () => {
  const userIds: string[] = [];
  const customerIds: string[] = [];
  const driverIds: string[] = [];
  const vehicleIds: string[] = [];
  const orderIds: string[] = [];
  const assignmentIds: string[] = [];

  it("generates and ranks candidates using actual database workloads", async () => {
    // 1. Create customer
    const customerUser = await prisma.user.create({
      data: {
        name: "Dispatch Service Customer",
        email: `service-customer-${randomUUID()}@test.com`,
        passwordHash: "test-hash",
        role: "CUSTOMER"
      }
    });

    userIds.push(customerUser.id);

    const customer = await prisma.customer.create({
      data: {
        userId: customerUser.id
      }
    });

    customerIds.push(customer.id);

    // 2. Create confirmed order
    const order = await prisma.deliveryOrder.create({
      data: {
        customerId: customer.id,
        pickupAddress: "Salt Lake, Kolkata",
        deliveryAddress: "New Town, Kolkata",
        recipientName: "Test Recipient",
        recipientPhone: "+919876543210",
        weightKg: 50,
        status: "CONFIRMED"
      }
    });

    orderIds.push(order.id);

    // 3. Create eligible driver
    const driverUser = await prisma.user.create({
      data: {
        name: "Dispatch Service Driver",
        email: `service-driver-${randomUUID()}@test.com`,
        passwordHash: "test-hash",
        role: "DRIVER"
      }
    });

    userIds.push(driverUser.id);

    const driver = await prisma.driver.create({
      data: {
        userId: driverUser.id,
        licenseNumber: `LIC-${randomUUID()}`,
        status: "AVAILABLE"
      }
    });

    driverIds.push(driver.id);

    // 4. Create eligible vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: `WB-${randomUUID().slice(0, 8)}`,
        capacityKg: 100,
        status: "AVAILABLE"
      }
    });

    vehicleIds.push(vehicle.id);

    // 5. Create a completed historical assignment
    const previousOrder = await prisma.deliveryOrder.create({
      data: {
        customerId: customer.id,
        pickupAddress: "Salt Lake, Kolkata",
        deliveryAddress: "New Town, Kolkata",
        recipientName: "Previous Recipient",
        recipientPhone: "+919876543210",
        weightKg: 30,
        status: "DELIVERED"
      }
    });

    orderIds.push(previousOrder.id);

    const assignment = await prisma.deliveryAssignment.create({
      data: {
        orderId: previousOrder.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        status: "COMPLETED",
        releasedAt: new Date()
      }
    });

    assignmentIds.push(assignment.id);

    // 6. Execute complete dispatch pipeline
    const result = await getDispatchRecommendations(order.id);

    // 7. Verify order
    expect(result.order.id).toBe(order.id);

    // 8. Find our driver-vehicle combination
    const candidate = result.candidates.find(
      item =>
        item.driverId === driver.id &&
        item.vehicleId === vehicle.id
    );

    expect(candidate).toBeDefined();

    // 9. Verify actual database workload
    expect(candidate?.driverCompletedDeliveries).toBe(1);
    expect(candidate?.vehicleCompletedDeliveries).toBe(1);

    // 10. Verify ranking order
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].totalScore)
        .toBeLessThanOrEqual(result.candidates[i].totalScore);
    }
  });

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

    await prisma.vehicle.deleteMany({
      where: { id: { in: vehicleIds } }
    });

    await prisma.customer.deleteMany({
      where: { id: { in: customerIds } }
    });

    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });
  });
});
