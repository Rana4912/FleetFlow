import { routeMatrixService } from "./route-matrix.dependencies.js";
import { routeOptimizerService } from "./route-optimizer.dependencies.js";

import { DeliveryRouteOptimizationService } from "./delivery-route-optimization.service.js";

export const deliveryRouteOptimizationService =
  new DeliveryRouteOptimizationService(
    routeMatrixService,
    routeOptimizerService
  );