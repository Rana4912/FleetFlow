import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateOrderInput } from "./order.schema.js";

export async function createOrder(
  userId: string,
  input: CreateOrderInput
) {
  // Find the authenticated user's customer profile.
  const customer = await prisma.customer.findUnique({
    where: {
      userId
    },
    select: {
      id: true
    }
  });

  if (!customer) {
    throw new AppError(
      "Customer profile not found. Create your customer profile first.",
      404
    );
  }

  // Create the delivery order.
  const order = await prisma.deliveryOrder.create({
    data: {
      customerId: customer.id,
      pickupAddress: input.pickupAddress,
      deliveryAddress: input.deliveryAddress,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      weightKg: input.weightKg,
      deadline: input.deadline
        ? new Date(input.deadline)
        : undefined
    },
    select: {
      id: true,
      customerId: true,
      pickupAddress: true,
      deliveryAddress: true,
      recipientName: true,
      recipientPhone: true,
      weightKg: true,
      deadline: true,
      status: true,
      createdAt: true
    }
  });

  return order;
}

export async function getOrderById(
  userId: string,
  role: "CUSTOMER" | "ADMIN",
  orderId: string
) {
  const order = await prisma.deliveryOrder.findFirst({
    where: {
      id: orderId,
      ...(role === "CUSTOMER"
        ? {
            customer: {
              userId
            }
          }
        : {})
    },
    select: {
      id: true,
      customerId: true,
      pickupAddress: true,
      deliveryAddress: true,
      recipientName: true,
      recipientPhone: true,
      weightKg: true,
      deadline: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  return order;
}