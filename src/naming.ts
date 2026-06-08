/**
 * Convert a folder name to a kebab-case queue name.
 *
 *   "sendNotificationFollowers" -> "send-notification-followers"
 *   "otp_email"                 -> "otp-email"
 *   "OTPEmail"                  -> "otp-email"
 */
export function toKebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // camelCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // ACRONYMWord boundary
    .replace(/[_\s]+/g, "-") // separators
    .replace(/-+/g, "-")
    .toLowerCase();
}
