import { NextResponse } from "next/server";

export async function GET() {
  const securityText = `Contact: mailto:security@prostcounter.com
Expires: 2025-12-31T23:59:59.000Z
Encryption: https://prostcounter.com/pgp-key.txt
Preferred-Languages: en
Canonical: https://prostcounter.com/.well-known/security.txt
Policy: https://prostcounter.com/privacy

# Security Policy
# If you discover a security vulnerability, please report it responsibly.
# We appreciate your help in keeping our users safe.

# Scope
# This security policy applies to:
# - prostcounter.com and all subdomains
# - The Oktoberfest Attendance application
# - All associated APIs and services

# Out of Scope
# - Social engineering attacks
# - Physical attacks
# - Denial of service attacks
# - Issues in third-party services we integrate with

# Reporting
# Please report security issues to: security@prostcounter.com
# We will respond within 48 hours and work with you to resolve the issue.

# Recognition
# We maintain a responsible disclosure policy and will credit researchers
# who report valid security issues (unless they prefer to remain anonymous).
`;

  return new NextResponse(securityText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400", // 24 hours
    },
  });
}
