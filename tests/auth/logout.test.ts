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

describe("POST /api/v1/auth/logout", () => {
  const email = `logout-${randomUUID()}@example.com`;
  const password = "StrongPassword123";

  const agent = request.agent(app);

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        name: "Logout Test User",
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

  it("should login successfully before logout", async () => {
    const response = await agent
      .post("/api/v1/auth/login")
      .send({ email, password });

    expect(response.status).toBe(200);
  });

  it("should allow access to protected route before logout", async () => {
    const response = await agent
      .get("/api/v1/auth/me");

    expect(response.status).toBe(200);
  });

  it("should clear authentication cookie on logout", async () => {
    const response = await agent
      .post("/api/v1/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Logged out successfully");

    const cookies = response.headers["set-cookie"];
    const cookieHeader = Array.isArray(cookies)
      ? cookies.join(";")
      : cookies ?? "";

    expect(cookieHeader).toContain("accessToken=");
    expect(cookieHeader.toLowerCase()).toContain("expires=");
  });

  it("should deny access after logout", async () => {
    const response = await agent
      .get("/api/v1/auth/me");

    expect(response.status).toBe(401);
  });
});