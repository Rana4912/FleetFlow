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

describe("Warehouse Management API", () => {
  const adminEmail = `admin-${randomUUID()}@example.com`;
  const customerEmail = `customer-${randomUUID()}@example.com`;
  const driverEmail = `driver-${randomUUID()}@example.com`;

  const warehouseName = `Central Warehouse ${randomUUID().slice(0, 8)}`;

  let adminUserId: string;
  let customerUserId: string;
  let driverUserId: string;

  let adminToken: string;
  let customerToken: string;
  let driverToken: string;

  const createdWarehouseIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword("StrongPassword123");

    const admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN"
      }
    });

    adminUserId = admin.id;

    const customer = await prisma.user.create({
      data: {
        name: "Test Customer",
        email: customerEmail,
        passwordHash,
        role: "CUSTOMER"
      }
    });

    customerUserId = customer.id;

    const driver = await prisma.user.create({
      data: {
        name: "Test Driver",
        email: driverEmail,
        passwordHash,
        role: "DRIVER"
      }
    });

    driverUserId = driver.id;

    adminToken = generateAccessToken({
      sub: admin.id,
      role: admin.role
    });

    customerToken = generateAccessToken({
      sub: customer.id,
      role: customer.role
    });

    driverToken = generateAccessToken({
      sub: driver.id,
      role: driver.role
    });
  });

  afterAll(async () => {
    // Delete warehouses created by these tests.
    await prisma.warehouse.deleteMany({
      where: {
        id: {
          in: createdWarehouseIds
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            adminUserId,
            customerUserId,
            driverUserId
          ].filter(Boolean)
        }
      }
    });
  });

  it("should reject requests without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/warehouses")
      .send({
        name: warehouseName,
        address: "Salt Lake, Kolkata"
      });

    expect(response.status).toBe(401);
  });

  it("should reject CUSTOMER access", async () => {
    const response = await request(app)
      .post("/api/v1/warehouses")
      .set("Cookie", `accessToken=${customerToken}`)
      .send({
        name: warehouseName,
        address: "Salt Lake, Kolkata"
      });

    expect(response.status).toBe(403);
  });

  it("should reject DRIVER access", async () => {
    const response = await request(app)
      .post("/api/v1/warehouses")
      .set("Cookie", `accessToken=${driverToken}`)
      .send({
        name: warehouseName,
        address: "Salt Lake, Kolkata"
      });

    expect(response.status).toBe(403);
  });

  it("should create a warehouse successfully with coordinates", async () => {
    const response = await request(app)
      .post("/api/v1/warehouses")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        name: warehouseName,
        address: "Salt Lake Sector V, Kolkata",
        latitude: 22.5726,
        longitude: 88.3639
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const warehouse = response.body.data.warehouse;

    expect(warehouse.name).toBe(warehouseName);
    expect(warehouse.address).toBe("Salt Lake Sector V, Kolkata");
    expect(Number(warehouse.latitude)).toBeCloseTo(22.5726);
    expect(Number(warehouse.longitude)).toBeCloseTo(88.3639);
    expect(warehouse.isActive).toBe(true);

    createdWarehouseIds.push(warehouse.id);

    // Verify persistence in PostgreSQL.
    const savedWarehouse = await prisma.warehouse.findUnique({
      where: {
        id: warehouse.id
      }
    });

    expect(savedWarehouse).not.toBeNull();
    expect(Number(savedWarehouse?.latitude)).toBeCloseTo(22.5726);
    expect(Number(savedWarehouse?.longitude)).toBeCloseTo(88.3639);
  });

  it("should create a warehouse without coordinates", async () => {
    const response = await request(app)
      .post("/api/v1/warehouses")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        name: `Warehouse ${randomUUID().slice(0, 8)}`,
        address: "New Town, Kolkata"
      });

    expect(response.status).toBe(201);

    const warehouse = response.body.data.warehouse;

    expect(warehouse.latitude).toBeNull();
    expect(warehouse.longitude).toBeNull();
    expect(warehouse.isActive).toBe(true);

    createdWarehouseIds.push(warehouse.id);
  });

  it("should reject latitude without longitude", async () => {
    const response = await request(app)
      .post("/api/v1/warehouses")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        name: `Warehouse ${randomUUID().slice(0, 8)}`,
        address: "New Town, Kolkata",
        latitude: 22.5726
      });

    expect(response.status).toBe(400);
  });

  it("should reject invalid geographic coordinates", async () => {
    const response = await request(app)
      .post("/api/v1/warehouses")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        name: `Warehouse ${randomUUID().slice(0, 8)}`,
        address: "New Town, Kolkata",
        latitude: 100,
        longitude: 88.3639
      });

    expect(response.status).toBe(400);
  });

  it("should reject unexpected request fields", async () => {
    const response = await request(app)
      .post("/api/v1/warehouses")
      .set("Cookie", `accessToken=${adminToken}`)
      .send({
        name: `Warehouse ${randomUUID().slice(0, 8)}`,
        address: "New Town, Kolkata",
        isActive: false
      });

    expect(response.status).toBe(400);
  });
});