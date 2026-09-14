import { PROD_URL } from "@prostcounter/shared";
import { NextResponse } from "next/server";

export async function GET() {
  // Security.txt should always point to production domain
  const securityTxt = `Contact: https://github.com/ignaguri/oktoberfest-attendance/security/advisories/new
Expires: 2027-09-01T00:00:00.000Z
Preferred-Languages: en
Canonical: ${PROD_URL}/.well-known/security.txt
`;

  return new NextResponse(securityTxt, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
