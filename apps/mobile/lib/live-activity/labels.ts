import type { TFunction } from "i18next";

import type { AndroidLabels } from "@/modules/live-activity";

/** Keeps `{{count}}` and `{{time}}` literal so Android can fill them in from a headless task. */
export function buildAndroidLabels(t: TFunction): AndroidLabels {
  return {
    title: t("liveActivity.title", { count: "{{count}}" }),
    paused: t("liveActivity.paused"),
    noTent: t("liveActivity.noTent"),
    lastActivity: t("liveActivity.lastActivity", { time: "{{time}}" }),
    channelName: t("liveActivity.channelName"),
    messages: {
      openAppToSync: t("liveActivity.message.openAppToSync"),
      newDay: t("liveActivity.message.newDay"),
      festivalEnded: t("liveActivity.message.festivalEnded"),
      notLogged: t("liveActivity.message.notLogged"),
    },
  };
}
