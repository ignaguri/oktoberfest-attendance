"use client";

import { i18n, useTranslation } from "@/lib/i18n/client";

export default function ChildSafetyStandards() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-center text-3xl font-bold">{t("marketing.childSafety.title")}</h1>

      <div className="prose prose-lg max-w-none space-y-6">
        <p className="mb-8 text-sm text-gray-600">
          <strong>{t("marketing.childSafety.lastUpdated")}</strong>{" "}
          {new Date("2026-03-30").toLocaleDateString(i18n.language, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">{t("marketing.childSafety.intro.title")}</h2>
          <p>{t("marketing.childSafety.intro.text")}</p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            {t("marketing.childSafety.csaeStandards.title")}
          </h2>
          <p>{t("marketing.childSafety.csaeStandards.text")}</p>
          <ul className="ml-4 list-inside list-disc space-y-2">
            <li>{t("marketing.childSafety.csaeStandards.items.csam")}</li>
            <li>{t("marketing.childSafety.csaeStandards.items.grooming")}</li>
            <li>{t("marketing.childSafety.csaeStandards.items.sextortion")}</li>
            <li>{t("marketing.childSafety.csaeStandards.items.trafficking")}</li>
            <li>{t("marketing.childSafety.csaeStandards.items.other")}</li>
          </ul>
          <p className="mt-4">{t("marketing.childSafety.csaeStandards.consequence")}</p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            {t("marketing.childSafety.reporting.title")}
          </h2>
          <p>{t("marketing.childSafety.reporting.text1")}</p>
          <p className="mt-4">{t("marketing.childSafety.reporting.text2")}</p>
          <p className="mt-4">
            {t("marketing.childSafety.reporting.emailText")}{" "}
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
          <h2 className="mb-4 text-2xl font-semibold">
            {t("marketing.childSafety.csamResponse.title")}
          </h2>
          <p>{t("marketing.childSafety.csamResponse.text")}</p>
          <ul className="ml-4 list-inside list-disc space-y-2">
            <li>
              <strong>{t("marketing.childSafety.csamResponse.items.removal")}</strong>
            </li>
            <li>
              <strong>{t("marketing.childSafety.csamResponse.items.preservation")}</strong>
            </li>
            <li>
              <strong>{t("marketing.childSafety.csamResponse.items.reporting")}</strong>
            </li>
            <li>
              <strong>{t("marketing.childSafety.csamResponse.items.suspension")}</strong>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            {t("marketing.childSafety.legalCompliance.title")}
          </h2>
          <p>{t("marketing.childSafety.legalCompliance.text")}</p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            {t("marketing.childSafety.contact.title")}
          </h2>
          <p>{t("marketing.childSafety.contact.text")}</p>
          <div className="mt-4 rounded-lg bg-gray-50 p-4">
            <p>
              <strong>{t("marketing.childSafety.contact.boxTitle")}</strong>
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
