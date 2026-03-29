export default function ChildSafetyStandards() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-center text-3xl font-bold">
        Child Safety Standards
      </h1>

      <div className="prose prose-lg max-w-none space-y-6">
        <p className="mb-8 text-sm text-gray-600">
          <strong>Last updated:</strong>{" "}
          {new Date("2026-03-30").toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">1. Introduction</h2>
          <p>
            ProstCounter is a beer festival and Volksfest attendance tracking
            application designed exclusively for adults aged 18 and older. We
            are committed to the safety of all users, particularly children. We
            maintain a zero-tolerance policy toward child sexual abuse and
            exploitation (CSAE) in any form.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">2. CSAE Standards</h2>
          <p>
            ProstCounter strictly prohibits any content or behavior that
            sexually exploits, abuses, or endangers children. This includes, but
            is not limited to:
          </p>
          <ul className="ml-4 list-inside list-disc space-y-2">
            <li>
              Child sexual abuse material (CSAM) of any kind, including
              AI-generated content
            </li>
            <li>Grooming or solicitation of minors</li>
            <li>Sextortion involving minors</li>
            <li>Trafficking of minors</li>
            <li>Any other form of child sexual exploitation or endangerment</li>
          </ul>
          <p className="mt-4">
            Any such content identified on our platform will be immediately
            removed and reported to the relevant authorities.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">3. In-App Reporting</h2>
          <p>
            Users can report child safety concerns directly within the
            ProstCounter app. Reports can be submitted through the in-app
            feedback and support mechanism available in the app settings.
          </p>
          <p className="mt-4">
            All reports related to child safety are treated with the highest
            priority. We review and act upon every report promptly.
          </p>
          <p className="mt-4">
            You may also report concerns by emailing us directly at{" "}
            <a
              href="mailto:pepe.grillo.parlante@gmail.com"
              className="text-blue-600 hover:underline"
            >
              pepe.grillo.parlante@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">4. CSAM Response</h2>
          <p>
            Upon obtaining actual knowledge of child sexual abuse material
            (CSAM) on our platform, ProstCounter will take the following
            actions:
          </p>
          <ul className="ml-4 list-inside list-disc space-y-2">
            <li>
              <strong>Immediate removal</strong> of the offending content from
              the platform
            </li>
            <li>
              <strong>Evidence preservation</strong> as required by applicable
              law
            </li>
            <li>
              <strong>Reporting to authorities</strong>, including the National
              Center for Missing &amp; Exploited Children (NCMEC) via the
              CyberTipline, and local law enforcement as appropriate
            </li>
            <li>
              <strong>Account suspension</strong> of the offending user, pending
              investigation
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">5. Legal Compliance</h2>
          <p>
            ProstCounter complies with all applicable child safety laws and
            regulations, including reporting obligations to relevant regional
            and national authorities. We cooperate fully with law enforcement
            agencies in the investigation of child exploitation offenses.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">6. Contact</h2>
          <p>
            If you have any child safety concerns or need to report an issue,
            please contact our designated child safety point of contact:
          </p>
          <div className="mt-4 rounded-lg bg-gray-50 p-4">
            <p>
              <strong>ProstCounter &mdash; Child Safety Contact</strong>
            </p>
            <p>
              Email:{" "}
              <a
                href="mailto:pepe.grillo.parlante@gmail.com"
                className="text-blue-600 hover:underline"
              >
                pepe.grillo.parlante@gmail.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
