import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateOrderInput, UpdateOrderStatusInput } from "./order.schema.js";
import type { ListOrdersQuery } from "./order.schema.js";

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

export async function listOrders(
  userId: string,
  role: "CUSTOMER" | "ADMIN",
  query: ListOrdersQuery
) {
  const { page, limit, status, sortOrder } = query;

  // Calculate how many records to skip.
  const skip = (page - 1) * limit;

  // Build database filters.
  const where = {
    ...(role === "CUSTOMER"
      ? {
          customer: {
            userId
          }
        }
      : {}),
    ...(status ? { status } : {})
  };

  // Fetch the requested page and total count concurrently.
  const [orders, total] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { createdAt: sortOrder },
        { id: "desc" }
      ],
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
    }),

    prisma.deliveryOrder.count({
      where
    })
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

const allowedTransitions: Record<string, string[]> = {
  CREATED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "FAILED"],
  IN_TRANSIT: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: []
};

export async function updateOrderStatus(
  orderId: string,
  userId: string,
  role: "CUSTOMER" | "DRIVER" | "ADMIN",
  input: UpdateOrderStatusInput
) {
  return prisma.$transaction(async (tx) => {
    // 1. Find the order.
    const order = await tx.deliveryOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        customer: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // 2. Check customer ownership.
    if (
      role === "CUSTOMER" &&
      order.customer.userId !== userId
    ) {
      throw new AppError("Order not found", 404);
    }

    // 3. Check role permissions.
    const customerCanCancel =
      role === "CUSTOMER" &&
      input.status === "CANCELLED";

    const adminCanUpdate = role === "ADMIN";

    if (!customerCanCancel && !adminCanUpdate) {
      throw new AppError("Forbidden", 403);
    }

    // 4. Check whether the transition is allowed.
    const allowed = allowedTransitions[order.status] ?? [];

    if (!allowed.includes(input.status)) {
      throw new AppError(
        `Cannot change order status from ${order.status} to ${input.status}`,
        409
      );
    }

    // 5. Update only if the current status has not changed.
    const result = await tx.deliveryOrder.updateMany({
      where: {
        id: orderId,
        status: order.status
      },
      data: {
        status: input.status
      }
    });

    if (result.count !== 1) {
      throw new AppError(
        "Order status was modified by another request. Please retry.",
        409
      );
    }

    // 6. Record the status transition.
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: input.status,
        note: `Status changed from ${order.status} to ${input.status}`
      }
    });

    // 7. Return the updated order.
    return tx.deliveryOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        updatedAt: true
      }
    });
  });
}