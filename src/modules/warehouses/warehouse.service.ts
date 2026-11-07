import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateWarehouseInput } from "./warehouse.schema.js";

export async function createWarehouse(input: CreateWarehouseInput) {
  return prisma.warehouse.create({
    data: {
      name: input.name,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude
    },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      isActive: true,
      createdAt: true
    }
  });
}