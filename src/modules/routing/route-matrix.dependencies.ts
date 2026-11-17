
import { GeoapifyMatrixProvider } from "../../infrastructure/routing/geoapify-matrix.provider.js";
import { RouteMatrixService } from "./route-matrix.service.js";

const matrixProvider = new GeoapifyMatrixProvider();

export const routeMatrixService = new RouteMatrixService(
  matrixProvider
);
