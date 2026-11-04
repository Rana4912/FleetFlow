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

describe("Authentication middleware", () => {
  const email = `auth-${randomUUID()}@example.com`;

  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: "Authentication Test User",
        email,
        passwordHash: await hashPassword("StrongPassword123")
      }
    });

    userId = user.id;

    accessToken = generateAccessToken({
      sub: user.id,
      role: user.role
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email }
    });
  });

  it("should reject requests without an authentication cookie", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me");

    expect(response.status).toBe(401);
  });

  it("should reject an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", "accessToken=invalid.token.value");

    expect(response.status).toBe(401);
  });

  it("should allow a request with a valid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `accessToken=${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(userId);
  });

  it("should reject a valid JWT belonging to an inactive user", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `accessToken=${accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe(
      "Account is inactive or unavailable"
    );
  });
});