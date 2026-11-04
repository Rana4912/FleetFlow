import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";

import app from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";

const email = `test-${randomUUID()}@example.com`;

describe("POST /api/v1/auth/register", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email }
    });
  });

  it("should register a user successfully", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Test Customer",
        email,
        password: "StrongPassword123"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(email);
    expect(response.body.data.role).toBe("CUSTOMER");

    expect(response.body.data).not.toHaveProperty("passwordHash");

    const savedUser = await prisma.user.findUnique({
      where: { email }
    });

    expect(savedUser).not.toBeNull();

    const passwordMatches = await bcrypt.compare(
      "StrongPassword123",
      savedUser!.passwordHash
    );

    expect(passwordMatches).toBe(true);
  });

  it("should reject duplicate email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Another Customer",
        email,
        password: "StrongPassword123"
      });

    expect(response.status).toBe(409);
  });

  it("should reject invalid email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Test Customer",
        email: "invalid-email",
        password: "StrongPassword123"
      });

    expect(response.status).toBe(400);
  });

  it("should reject short passwords", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Test Customer",
        email: `short-${randomUUID()}@example.com`,
        password: "123"
      });

    expect(response.status).toBe(400);
  });

  it("should reject unexpected role field", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Test Customer",
        email: `admin-${randomUUID()}@example.com`,
        password: "StrongPassword123",
        role: "ADMIN"
      });

    expect(response.status).toBe(400);
  });
});