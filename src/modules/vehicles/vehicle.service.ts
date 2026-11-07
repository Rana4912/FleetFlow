import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateVehicleInput } from "./vehicle.schema.js";

export async function createVehicle(input: CreateVehicleInput) {
  try {
    return await prisma.vehicle.create({
      data: {
        registrationNumber: input.registrationNumber,
        capacityKg: input.capacityKg,
      },
      select: {
        id: true,
        registrationNumber: true,
        capacityKg: true,
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
      throw new AppError(
        "Vehicle registration number already exists",
        409
      );
    }

    throw error;
  }
}