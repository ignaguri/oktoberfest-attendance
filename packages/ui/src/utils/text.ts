/**
 * Text utility functions for UI components
 */

/**
 * Get initials from a name, username, or email for avatar fallback display.
 *
 * @param options - Object containing name, username, and/or email
 * @param options.fullName - Full name (prioritized first)
 * @param options.username - Username (fallback if no name)
 * @param options.email - Email (fallback if no name or username)
 * @returns Uppercase initials (max 2 characters)
 *
 * @example
 * getInitials({ fullName: "John Doe" }) // "JD"
 * getInitials({ fullName: "John" }) // "JO"
 * getInitials({ username: "johndoe" }) // "JO"
 * getInitials({ email: "john@example.com" }) // "JO"
 * getInitials({}) // "U"
 */
export function getInitials(options: {
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  const { fullName, username, email } = options;

  if (fullName) {
    return fullName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  if (username) {
    return username.slice(0, 2).toUpperCase();
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "U";
}
