/*jshint esversion: 11 */

/**
 * Base error class for cisco-dime.
 */
class DimeError extends Error {
  constructor(message, options) {
    super(message);
    this.name = "DimeError";
    this.host = options && options.host ? options.host : null;
    this.statusCode = options && options.statusCode ? options.statusCode : null;
  }
}

/**
 * Authentication error — invalid credentials or expired session.
 */
class DimeAuthError extends DimeError {
  constructor(message, options) {
    super(message, options);
    this.name = "DimeAuthError";
  }
}

/**
 * Not found error — requested file or service log does not exist.
 */
class DimeNotFoundError extends DimeError {
  constructor(message, options) {
    super(message, options);
    this.name = "DimeNotFoundError";
  }
}

/**
 * Timeout error — request exceeded configured timeout.
 */
class DimeTimeoutError extends DimeError {
  constructor(message, options) {
    super(message, options);
    this.name = "DimeTimeoutError";
  }
}

/**
 * Rate limit error — server returned 429/503 and retries exhausted.
 */
class DimeRateLimitError extends DimeError {
  constructor(message, options) {
    super(message, options);
    this.name = "DimeRateLimitError";
  }
}

module.exports = {
  DimeError: DimeError,
  DimeAuthError: DimeAuthError,
  DimeNotFoundError: DimeNotFoundError,
  DimeTimeoutError: DimeTimeoutError,
  DimeRateLimitError: DimeRateLimitError,
};
