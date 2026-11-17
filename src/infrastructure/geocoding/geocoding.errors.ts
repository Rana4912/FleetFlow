export type GeocodingErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_PROVIDER_RESPONSE";

export class GeocodingProviderError extends Error {
  public readonly code: GeocodingErrorCode;

  constructor(
    message: string,
    code: GeocodingErrorCode
  ) {
    super(message);

    this.name = "GeocodingProviderError";
    this.code = code;
  }
}