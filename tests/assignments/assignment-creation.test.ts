
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

describe("Delivery Assignment API", () => {
  const suffix = randomUUID();

  let adminId: string;
  let customerId: string;
  let customerProfileId: string;

  let adminToken: string;
  let customerToken: string;

  const orderIds: string[] = [];
  const driverIds: string[] = [];
  const vehicleIds: string[] = [];
  const driverUserIds: string[] = [];

  async function createScenario(options?: {
    orderStatus?: "CREATED" | "CONFIRMED";
    driverStatus?: "AVAILABLE" | "OFFLINE" | "ON_DELIVERY";
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
        status: options?.orderStatus ?? "CONFIRMED"
      }
    });

    orderIds.push(order.id);

    const driverUser = await prisma.user.create({
      data: {
        name: "Assignment Driver",
        email: `driver-${randomUUID()}@test.com`,
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

  async function assign(scenario: {
    orderId: string;
    driverId: string;
    vehicleId: string;
  }) {
    return request(app)
      .post("/api/v1/assignments")
      .set("Cookie", `accessToken=${adminToken}`)
      .send(scenario);
  }

  beforeAll(async () => {
    const passwordHash = await hashPassword("TestPassword123!");

    const admin = await prisma.user.create({
      data: {
        name: "Assignment Admin",
        email: `assignment-admin-${suffix}@test.com`,
        passwordHash,
        role: "ADMIN"
      }
    });

    adminId = admin.id;

    const customer = await prisma.user.create({
      data: {
        name: "Assignment Customer",
        email: `assignment-customer-${suffix}@test.com`,
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
      where: {
        id: { in: [adminId, customerId] }
      }
    });
  });

  it("should reject unauthenticated requests", async () => {
    const response = await request(app)
      .post("/api/v1/assignments")
      .send({
        orderId: randomUUID(),
        driverId: randomUUID(),
        vehicleId: randomUUID()
      });

    expect(response.status).toBe(401);
  });

  it("should reject CUSTOMER access", async () => {
    const response = await request(app)
      .post("/api/v1/assignments")
      .set("Cookie", `accessToken=${customerToken}`)
      .send({
        orderId: randomUUID(),
        driverId: randomUUID(),
        vehicleId: randomUUID()
      });

    expect(response.status).toBe(403);
  });

  it("should reject invalid UUIDs", async () => {
    const response = await request(app)
      .post("/api/v1/assignments")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        orderId: "invalid",
        driverId: randomUUID(),
        vehicleId: randomUUID()
      });

    expect(response.status).toBe(400);
  });

  it("should reject unexpected request properties", async () => {
    const response = await request(app)
      .post("/api/v1/assignments")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        orderId: randomUUID(),
        driverId: randomUUID(),
        vehicleId: randomUUID(),
        status: "ACTIVE"
      });

    expect(response.status).toBe(400);
  });

  it("should reject orders that are not CONFIRMED", async () => {
    const scenario = await createScenario({
      orderStatus: "CREATED"
    });

    const response = await assign(scenario);

    expect(response.status).toBe(409);
  });

  it("should return 404 when the order does not exist", async () => {
    const scenario = await createScenario();

    const response = await assign({
      ...scenario,
      orderId: randomUUID()
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when the driver does not exist", async () => {
    const scenario = await createScenario();

    const response = await assign({
      ...scenario,
      driverId: randomUUID()
    });

    expect(response.status).toBe(404);
  });

  it("should return 404 when the vehicle does not exist", async () => {
    const scenario = await createScenario();

    const response = await assign({
      ...scenario,
      vehicleId: randomUUID()
    });

    expect(response.status).toBe(404);
  });

  it("should reject unavailable drivers", async () => {
    const scenario = await createScenario({
      driverStatus: "OFFLINE"
    });

    const response = await assign(scenario);

    expect(response.status).toBe(409);
  });

  it("should reject unavailable vehicles and roll back driver changes", async () => {
    const scenario = await createScenario({
      vehicleStatus: "IN_USE"
    });

    const response = await assign(scenario);

    expect(response.status).toBe(409);

    const driver = await prisma.driver.findUniqueOrThrow({
      where: { id: scenario.driverId }
    });

    expect(driver.status).toBe("AVAILABLE");

    const order = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: scenario.orderId }
    });

    expect(order.status).toBe("CONFIRMED");

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { orderId: scenario.orderId }
    });

    expect(assignment).toBeNull();
  });

  it("should reject vehicles with insufficient capacity and roll back all changes", async () => {
    const scenario = await createScenario({
      capacityKg: 25
    });

    const response = await assign(scenario);

    expect(response.status).toBe(409);

    // Driver was claimed before vehicle capacity was checked.
    // The transaction must roll back that change.
    const driver = await prisma.driver.findUniqueOrThrow({
      where: { id: scenario.driverId }
    });

    expect(driver.status).toBe("AVAILABLE");

    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: scenario.vehicleId }
    });

    expect(vehicle.status).toBe("AVAILABLE");

    const order = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: scenario.orderId }
    });

    expect(order.status).toBe("CONFIRMED");

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { orderId: scenario.orderId }
    });

    expect(assignment).toBeNull();
  });

  it("should successfully assign an order to a driver and vehicle", async () => {
    const scenario = await createScenario();

    const response = await assign(scenario);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.assignment).toMatchObject({
      orderId: scenario.orderId,
      driverId: scenario.driverId,
      vehicleId: scenario.vehicleId,
      status: "ACTIVE"
    });

    const driver = await prisma.driver.findUniqueOrThrow({
      where: { id: scenario.driverId }
    });

    expect(driver.status).toBe("ON_DELIVERY");

    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: scenario.vehicleId }
    });

    expect(vehicle.status).toBe("IN_USE");

    const order = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: scenario.orderId }
    });

    expect(order.status).toBe("ASSIGNED");

    const assignment = await prisma.deliveryAssignment.findUnique({
      where: {
        id: response.body.data.assignment.id
      }
    });

    expect(assignment).not.toBeNull();

    const history = await prisma.orderStatusHistory.findMany({
      where: {
        orderId: scenario.orderId
      }
    });

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("ASSIGNED");
  });

  it("should reject assigning an already assigned order", async () => {
    const first = await createScenario();
    const second = await createScenario();

    const firstResponse = await assign(first);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await assign({
      ...second,
      orderId: first.orderId
    });

    expect(secondResponse.status).toBe(409);

    const assignments = await prisma.deliveryAssignment.findMany({
      where: {
        orderId: first.orderId,
        status: "ACTIVE"
      }
    });

    expect(assignments).toHaveLength(1);

    const secondDriver = await prisma.driver.findUniqueOrThrow({
      where: { id: second.driverId }
    });

    expect(secondDriver.status).toBe("AVAILABLE");
  });

  it("should reject assigning an already occupied driver", async () => {
    const first = await createScenario();
    const second = await createScenario();

    const firstResponse = await assign(first);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await assign({
      ...second,
      driverId: first.driverId
    });

    expect(secondResponse.status).toBe(409);

    const activeAssignments = await prisma.deliveryAssignment.findMany({
      where: {
        driverId: first.driverId,
        status: "ACTIVE"
      }
    });

    expect(activeAssignments).toHaveLength(1);

    const secondOrder = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: second.orderId }
    });

    expect(secondOrder.status).toBe("CONFIRMED");
  });

  it("should reject assigning an already occupied vehicle", async () => {
    const first = await createScenario();
    const second = await createScenario();

    const firstResponse = await assign(first);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await assign({
      ...second,
      vehicleId: first.vehicleId
    });

    expect(secondResponse.status).toBe(409);

    const activeAssignments = await prisma.deliveryAssignment.findMany({
      where: {
        vehicleId: first.vehicleId,
        status: "ACTIVE"
      }
    });

    expect(activeAssignments).toHaveLength(1);

    const secondDriver = await prisma.driver.findUniqueOrThrow({
      where: { id: second.driverId }
    });

    expect(secondDriver.status).toBe("AVAILABLE");
  });

    it("should prevent concurrent assignment of the same driver", async () => {
    const first = await createScenario();
    const second = await createScenario();

    const responses = await Promise.all([
      assign(first),
      assign({
        ...second,
        driverId: first.driverId
      })
    ]);

    const successfulResponses = responses.filter(
      (response) => response.status === 201
    );

    const failedResponses = responses.filter(
      (response) => response.status === 409
    );

    expect(successfulResponses).toHaveLength(1);
    expect(failedResponses).toHaveLength(1);

    const assignments = await prisma.deliveryAssignment.findMany({
      where: {
        driverId: first.driverId,
        status: "ACTIVE"
      }
    });

    expect(assignments).toHaveLength(1);

    const firstOrder = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: first.orderId }
    });

    const secondOrder = await prisma.deliveryOrder.findUniqueOrThrow({
      where: { id: second.orderId }
    });

    expect(
      [firstOrder.status, secondOrder.status].sort()
    ).toEqual(["ASSIGNED", "CONFIRMED"]);
  });
});
