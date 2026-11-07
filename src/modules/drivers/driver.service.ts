import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

export async function createDriverProfile(
  userId: string,
  licenseNumber: string
) {
  try {
    return await prisma.driver.create({
      data: {
        userId,
        licenseNumber,
      },
      select: {
        id: true,
        userId: true,
        licenseNumber: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      // Check whether this user already has a driver profile.
      const existingDriver = await prisma.driver.findUnique({
        where: { userId }
      });

      if (existingDriver) {
        throw new AppError("Driver profile already exists", 409);
      }

      // Otherwise, check whether another driver owns this license.
      const existingLicense = await prisma.driver.findUnique({
        where: { licenseNumber }
      });

      if (existingLicense) {
        throw new AppError("License number is already registered", 409);
      }

      throw new AppError("Driver profile or license already exists", 409);
    }
  }
}