import { NextResponse } from "next/server";

export async function GET() {
  const securityTxt = `Contact: mailto:security@prostcounter.fun
Expires: 2025-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://prostcounter.fun/.well-known/security.txt
`;

  return new NextResponse(securityTxt, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
