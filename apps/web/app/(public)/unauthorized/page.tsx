"use client";

import { useTranslation } from "@prostcounter/shared/i18n";

export default function UnauthorizedPage() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">
        {t("common.errors.unauthorized.title")}
      </h1>
      <p>{t("common.errors.unauthorized.message")}</p>
    </div>
  );
}
