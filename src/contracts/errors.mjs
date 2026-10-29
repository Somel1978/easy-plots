export class EasyPlotsError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'EasyPlotsError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
export function requireInvariant(assertion, code, message) {
  if (!assertion) throw new EasyPlotsError(code, message);
}
export function failClosed(code = 'UNVERIFIED_PLATFORM_BOUNDARY') {
  throw new EasyPlotsError(code, 'Operation denied: a required native platform security property has not been verified.');
}
