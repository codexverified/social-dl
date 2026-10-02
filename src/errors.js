/** Base error for Codex Social failures. */
export class SocialDlError extends Error {
  constructor(message, code = 'SOCIAL_DL_ERROR') {
    super(message);
    this.name = 'SocialDlError';
    this.code = code;
  }
}

/** Indicates that the source is private or requires authentication. */
export class PrivateError extends SocialDlError {
  constructor(message = 'The media is private or requires login.') {
    super(message, 'PRIVATE_OR_LOGIN_REQUIRED');
    this.name = 'PrivateError';
  }
}

/** Indicates that no supported media was found. */
export class NotFoundError extends SocialDlError {
  constructor(message = 'No supported media was found.') {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/** Indicates that the URL is not supported. */
export class UnsupportedError extends SocialDlError {
  constructor(message = 'Unsupported URL.') {
    super(message, 'UNSUPPORTED_URL');
    this.name = 'UnsupportedError';
  }
}

/** Indicates that a provider blocked an automated request. */
export class BotDetectedError extends SocialDlError {
  constructor(message = 'The provider blocked this automated request.') {
    super(message, 'BOT_DETECTED');
    this.name = 'BotDetectedError';
  }
}
