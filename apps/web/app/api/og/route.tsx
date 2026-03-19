import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const categoryColors: Record<string, string> = {
  festivals: "#F59E0B",
  tips: "#3B82F6",
  culture: "#8B5CF6",
  news: "#22C55E",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "ProstCounter Blog";
  const category = searchParams.get("category") || "tips";

  const accentColor = categoryColors[category] || "#F59E0B";

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px",
        background: `linear-gradient(135deg, #1F2937 0%, #111827 100%)`,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Top bar accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: accentColor,
        }}
      />

      {/* Category badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            background: accentColor,
            color: "white",
            padding: "6px 16px",
            borderRadius: "20px",
            fontSize: "18px",
            fontWeight: 600,
            textTransform: "capitalize",
          }}
        >
          {category}
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: title.length > 60 ? "42px" : "52px",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#F59E0B",
            }}
          >
            ProstCounter
          </div>
        </div>
        <div
          style={{
            fontSize: "18px",
            color: "#9CA3AF",
          }}
        >
          prostcounter.fun
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
