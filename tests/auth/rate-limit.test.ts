import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

describe("Login rate limiting", () => {
  it("should reject requests after the rate limit is exceeded", async () => {
    const responses = [];

    for (let i = 0; i < 11; i++) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "ratelimit@example.com",
          password: "WrongPassword123"
        });

      responses.push(response);
    }

    expect(responses.slice(0, 10).every(
      (response) => response.status === 401
    )).toBe(true);

    expect(responses[10].status).toBe(429);
    expect(responses[10].body.message).toContain("Too many");
  });
});