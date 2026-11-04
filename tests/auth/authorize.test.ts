import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";

import { authorize } from "../../src/middleware/authorize.js";
import type { AuthenticatedRequest } from "../../src/middleware/authenticate.js";

type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";

function createTestApp(role: UserRole) {
  const app = express();

  // Simulate a user already authenticated by the authenticate middleware.
  app.use((req, _res, next) => {
    (req as AuthenticatedRequest).user = {
      id: "test-user",
      role
    };

    next();
  });

  app.get("/admin", authorize("ADMIN"), (_req, res) => {
    res.status(200).json({ message: "Admin access granted" });
  });

  app.get("/driver", authorize("DRIVER", "ADMIN"), (_req, res) => {
    res.status(200).json({ message: "Driver access granted" });
  });

  return app;
}

describe("Role-based authorization", () => {
  it("should deny CUSTOMER access to admin resources", async () => {
    const response = await request(createTestApp("CUSTOMER"))
      .get("/admin");

    expect(response.status).toBe(403);
  });

  it("should deny CUSTOMER access to driver resources", async () => {
    const response = await request(createTestApp("CUSTOMER"))
      .get("/driver");

    expect(response.status).toBe(403);
  });

  it("should deny DRIVER access to admin resources", async () => {
    const response = await request(createTestApp("DRIVER"))
      .get("/admin");

    expect(response.status).toBe(403);
  });

  it("should allow DRIVER access to driver resources", async () => {
    const response = await request(createTestApp("DRIVER"))
      .get("/driver");

    expect(response.status).toBe(200);
  });

  it("should allow ADMIN access to admin resources", async () => {
    const response = await request(createTestApp("ADMIN"))
      .get("/admin");

    expect(response.status).toBe(200);
  });

  it("should allow ADMIN access to driver resources", async () => {
    const response = await request(createTestApp("ADMIN"))
      .get("/driver");

    expect(response.status).toBe(200);
  });
});