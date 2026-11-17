
import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateWarehouseInput } from "./warehouse.schema.js";

export async function createWarehouse(input: CreateWarehouseInput) {
  const hasCoordinates =
    input.latitude !== undefined &&
    input.longitude !== undefined;

  return prisma.warehouse.create({
    data: {
      name: input.name,
      address: input.address,

      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,

      location: {
        create: {
          inputAddress: input.address,
          formattedAddress: hasCoordinates
            ? input.address
            : null,

          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,

          geocodingStatus: hasCoordinates
            ? "SUCCEEDED"
            : "PENDING",

          provider: hasCoordinates
            ? "MANUAL"
            : null,

          geocodedAt: null
        }
      }
    },

    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      isActive: true,
      createdAt: true,

      location: {
        select: {
          id: true,
          inputAddress: true,
          formattedAddress: true,
          latitude: true,
          longitude: true,
          geocodingStatus: true,
          provider: true
        }
      }
    }
  });
}
