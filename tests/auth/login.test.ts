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

describe("POST /api/v1/auth/login", () => {
  const email = `login-${randomUUID()}@example.com`;
  const password = "StrongPassword123";

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        name: "Login Test User",
        email,
        passwordHash: await hashPassword(password)
      }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email }
    });
  });

  it("should login with valid credentials", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);

    const cookies = response.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const cookieHeader = Array.isArray(cookies)
      ? cookies.join(";")
      : cookies ?? "";

    expect(cookieHeader).toContain("accessToken=");
    expect(cookieHeader).toContain("HttpOnly");
  });

  it("should reject an incorrect password", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email,
        password: "WrongPassword123"
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("should reject an unknown email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: `unknown-${randomUUID()}@example.com`,
        password
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("should reject an inactive account", async () => {
    await prisma.user.update({
      where: { email },
      data: { isActive: false }
    });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });

    expect(response.status).toBe(401);

    await prisma.user.update({
      where: { email },
      data: { isActive: true }
    });
  });
});