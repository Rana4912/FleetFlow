
import { GeoapifyRoutingProvider } from "../../infrastructure/routing/geoapify-routing.provider.js";
import { RoutingService } from "./routing.service.js";

const routingProvider = new GeoapifyRoutingProvider();

export const routingService = new RoutingService(
  routingProvider
);
