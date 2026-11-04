import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { LoginInput } from "./login.schema.js";
import { comparePassword } from "./password.js";
import { generateAccessToken } from "./token.js";

export async function loginUser(input: LoginInput) {
  // 1. Find user by email
  const user = await prisma.user.findUnique({
    where: {
      email: input.email
    }
  });

  // 2. Reject unknown email
  if (!user || !user.isActive) {
    throw new AppError("Invalid email or password", 401);
  }

  // 3. Verify password
  const isPasswordValid = await comparePassword(
    input.password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  // 4. Generate JWT
  const accessToken = generateAccessToken({
    sub: user.id,
    role: user.role
  });

  // 5. Return token and safe user details
  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}