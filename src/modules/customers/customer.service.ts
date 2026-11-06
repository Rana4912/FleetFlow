import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

export async function createCustomerProfile(userId: string) {
  try {
    const customer = await prisma.customer.create({
      data: {
        userId
      },
      select: {
        id: true,
        userId: true,
        createdAt: true
      }
    });

    return customer;
  } catch (error) {
    // Prisma P2002 means a unique constraint was violated.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AppError("Customer profile already exists", 409);
    }

    throw error;
  }
}