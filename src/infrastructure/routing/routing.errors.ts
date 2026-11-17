
export type RoutingErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_PROVIDER_RESPONSE";

export class RoutingProviderError extends Error {
  public readonly code: RoutingErrorCode;

  constructor(
    message: string,
    code: RoutingErrorCode
  ) {
    super(message);

    this.name = "RoutingProviderError";
    this.code = code;
  }
}
