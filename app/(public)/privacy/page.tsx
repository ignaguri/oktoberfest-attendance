export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Privacy Policy</h1>

      <div className="prose prose-lg max-w-none space-y-6">
        <p className="text-sm text-gray-600 mb-8">
          <strong>Last updated:</strong>{" "}
          {new Date("2025-09-05").toLocaleDateString("de-DE", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            Welcome to ProstCounter (&quot;we,&quot; &quot;our,&quot; or
            &quot;us&quot;). This privacy policy explains how we collect, use,
            and protect your information when you use our web application for
            tracking attendance at Volksfests in Munich, Germany.
          </p>
          <p>
            <strong>Contact Information:</strong>
            <br />
            ProstCounter
            <br />
            Germany
            <br />
            Email:{" "}
            <a
              href="mailto:pepe.grillo.parlante@gmail.com"
              className="text-blue-600 hover:underline"
            >
              pepe.grillo.parlante@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            2. Information We Collect
          </h2>

          <h3 className="text-xl font-medium mb-3">
            2.1 Information You Provide
          </h3>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Email address (for account creation and authentication)</li>
            <li>Username and display name</li>
            <li>Profile information (optional avatar/photo)</li>
            <li>Beer consumption records and attendance data</li>
            <li>
              Photos you choose to upload related to your festival attendance
            </li>
            <li>Group memberships and competition participation</li>
          </ul>

          <h3 className="text-xl font-medium mb-3 mt-6">
            2.2 Information from Social Login
          </h3>
          <p>When you sign in using Google or Facebook, we receive:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Your name and email address</li>
            <li>Profile picture (if you choose to use it)</li>
            <li>
              Basic profile information as permitted by the social platform
            </li>
          </ul>

          <h3 className="text-xl font-medium mb-3 mt-6">
            2.3 Automatically Collected Information
          </h3>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Usage analytics through Google Analytics (anonymized)</li>
            <li>Error logs and crash reports through Sentry</li>
            <li>Device information necessary for app functionality</li>
            <li>IP address for security and service provision</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            3. How We Use Your Information
          </h2>
          <p>We use your information to:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Provide and maintain the ProstCounter service</li>
            <li>Track your beer consumption and festival attendance</li>
            <li>Enable participation in group competitions and leaderboards</li>
            <li>
              Send push notifications about group activities (with your
              permission)
            </li>
            <li>Generate achievements and statistics</li>
            <li>Improve the app through analytics and error monitoring</li>
            <li>Respond to your questions and provide customer support</li>
          </ul>
          <p className="mt-4">
            <strong>We do not:</strong> Send marketing emails, sell your data,
            or use your information for advertising purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            4. Information Sharing
          </h2>
          <p>
            We do not sell, trade, or share your personal information with third
            parties, except:
          </p>

          <h3 className="text-xl font-medium mb-3 mt-4">
            4.1 Service Providers
          </h3>
          <p>We use the following trusted service providers:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              <strong>Supabase:</strong> Database and authentication services
            </li>
            <li>
              <strong>Google Analytics:</strong> Anonymous usage statistics
            </li>
            <li>
              <strong>Sentry:</strong> Error monitoring and crash reporting
            </li>
            <li>
              <strong>Novu:</strong> Push notification delivery
            </li>
            <li>
              <strong>Firebase:</strong> Push notification infrastructure
            </li>
          </ul>

          <h3 className="text-xl font-medium mb-3 mt-6">4.2 Within the App</h3>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              Your username and statistics are visible to other users in
              leaderboards
            </li>
            <li>
              Photos and attendance data are visible to members of groups you
              join
            </li>
            <li>Achievement information may be visible to other users</li>
          </ul>

          <h3 className="text-xl font-medium mb-3 mt-6">
            4.3 Legal Requirements
          </h3>
          <p>
            We may disclose your information if required by German law, court
            order, or to protect our rights and the safety of our users.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal
            information:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Encrypted data transmission (HTTPS/TLS)</li>
            <li>Secure authentication through trusted providers</li>
            <li>Regular security monitoring and updates</li>
            <li>Limited access to personal data on a need-to-know basis</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
          <p>
            We retain your personal information for up to 3 years from your last
            activity on the platform. After this period, your data will be
            automatically deleted unless you actively use the service.
          </p>
          <p className="mt-4">
            <strong>Account Deletion:</strong> You can delete your account and
            all associated data at any time through your profile settings. This
            action is immediate and irreversible.
          </p>
        </section>

        <section id="data-deletion">
          <h2 className="text-2xl font-semibold mb-4">
            7. How to Delete Your Data
          </h2>
          <p>
            You can permanently delete your account and all associated data at
            any time by following these steps:
          </p>
          <ol className="list-decimal list-inside space-y-2 ml-4 mt-4">
            <li>Sign in to your ProstCounter account</li>
            <li>
              Go to your <strong>Profile</strong> page (click your avatar in the
              top navigation)
            </li>
            <li>
              Scroll down to the <strong>&quot;Danger Zone&quot;</strong>{" "}
              section
            </li>
            <li>
              Click the <strong>&quot;Delete Account&quot;</strong> button
            </li>
            <li>Read the confirmation message carefully</li>
            <li>
              Click <strong>&quot;Yes, Delete My Account&quot;</strong> to
              confirm
            </li>
          </ol>
          <div className="bg-red-50 p-4 rounded-lg mt-4 border-x-4 border-red-400">
            <p className="text-red-800 font-medium">⚠️ Important:</p>
            <ul className="text-red-700 text-sm mt-2 space-y-1">
              <li>
                • This action is <strong>immediate and irreversible</strong>
              </li>
              <li>• All your data will be permanently deleted, including:</li>
              <li className="ml-4">
                - Beer consumption records and attendance data
              </li>
              <li className="ml-4">- Photos and tent visits</li>
              <li className="ml-4">- Group memberships and achievements</li>
              <li className="ml-4">
                - Profile information and account settings
              </li>
              <li>
                • You will be immediately signed out and redirected to the
                homepage
              </li>
            </ul>
          </div>
          <p className="mt-4">
            If you need assistance with account deletion or have questions about
            this process, please contact us at{" "}
            <a
              href="mailto:pepe.grillo.parlante@gmail.com"
              className="text-blue-600 hover:underline"
            >
              pepe.grillo.parlante@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Your Rights (GDPR)</h2>
          <p>Under German and EU law, you have the right to:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              <strong>Access:</strong> Request a copy of your personal data
            </li>
            <li>
              <strong>Rectification:</strong> Correct inaccurate personal data
            </li>
            <li>
              <strong>Erasure:</strong> Request deletion of your personal data
            </li>
            <li>
              <strong>Portability:</strong> Receive your data in a
              machine-readable format
            </li>
            <li>
              <strong>Restriction:</strong> Limit how we process your data
            </li>
            <li>
              <strong>Object:</strong> Object to certain types of processing
            </li>
            <li>
              <strong>Withdraw consent:</strong> Withdraw consent for data
              processing
            </li>
          </ul>
          <p className="mt-4">
            To exercise these rights, please contact us at{" "}
            <a
              href="mailto:pepe.grillo.parlante@gmail.com"
              className="text-blue-600 hover:underline"
            >
              pepe.grillo.parlante@gmail.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            9. Cookies and Tracking
          </h2>
          <p>ProstCounter uses minimal cookies necessary for:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Authentication and maintaining your login session</li>
            <li>Remembering your preferences and settings</li>
            <li>Basic functionality of the web application</li>
          </ul>
          <p className="mt-4">
            We do not use tracking cookies for advertising or marketing
            purposes. Google Analytics is configured to anonymize IP addresses
            and respect user privacy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            10. Children&apos;s Privacy
          </h2>
          <p>
            ProstCounter is designed for adults aged 18 and older who can
            legally consume alcohol in Germany. We do not knowingly collect
            personal information from children under 18. If you believe we have
            collected information from a minor, please contact us immediately.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            11. International Data Transfers
          </h2>
          <p>
            Your data may be processed and stored outside of Germany through our
            service providers (Supabase, Google, etc.). These transfers are
            protected by appropriate safeguards including standard contractual
            clauses and adequacy decisions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            12. Changes to This Privacy Policy
          </h2>
          <p>
            We may update this privacy policy from time to time. We will notify
            you of any material changes by posting the new policy on this page
            and updating the &quot;Last updated&quot; date. Your continued use
            of ProstCounter after changes become effective constitutes
            acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or our data
            practices, please contact us:
          </p>
          <div className="bg-gray-50 p-4 rounded-lg mt-4">
            <p>
              <strong>ProstCounter</strong>
            </p>
            <p>Germany</p>
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
