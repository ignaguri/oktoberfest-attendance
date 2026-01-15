import { PROD_URL } from "@prostcounter/shared";
import { NextResponse } from "next/server";

export async function GET() {
  // Security.txt should always point to production domain
  const securityTxt = `Contact: mailto:security@prostcounter.fun
Expires: 2025-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: ${PROD_URL}/.well-known/security.txt
`;

  return new NextResponse(securityTxt, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
