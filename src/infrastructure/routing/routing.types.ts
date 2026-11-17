
export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteRequest {
  origin: Coordinate;
  destination: Coordinate;
}

export interface RouteGeometry {
  type: "LineString";

  // GeoJSON coordinate order: [longitude, latitude]
  coordinates: [number, number][];
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
  provider: string;
}

export interface RoutingProvider {
  readonly name: string;

  getRoute(
    request: RouteRequest
  ): Promise<RouteResult | null>;
}


export interface RouteMatrixRequest {
  sources: Coordinate[];
  targets: Coordinate[];
}

export interface RouteMatrixCell {
  distanceMeters: number | null;
  durationSeconds: number | null;
}

export interface RouteMatrixResult {
  sources: Coordinate[];
  targets: Coordinate[];
  matrix: RouteMatrixCell[][];
  provider: string;
}

export interface RouteMatrixProvider {
  readonly name: string;

  getRouteMatrix(
    request: RouteMatrixRequest
  ): Promise<RouteMatrixResult>;
}
