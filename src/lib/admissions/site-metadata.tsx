import { productBrand } from "./brand";

const defaultSiteUrl = "http://localhost:3000";

function normalizeSiteUrl(url: string) {
  const trimmedUrl = url.trim();
  const urlWithProtocol = /^https?:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  return urlWithProtocol.replace(/\/+$/, "");
}

export function getSiteUrl() {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_PROJECT_PRODUCTION_URL ??
      process.env.VERCEL_URL ??
      defaultSiteUrl,
  );
}

export const siteTitle = `${productBrand.assistantName} - AI-ассистент для поступления за границу`;

export const siteDescription =
  "Atlas 1.0.0 помогает выбрать страну и программу, собрать документы, увидеть риски и дедлайны без хаоса.";

export const siteKeywords = [
  "Atlas 1.0.0",
  "AtlasPath",
  "поступление за границу",
  "университеты за рубежом",
  "study abroad",
  "admissions",
  "AI assistant",
  "стипендии",
  "студенческая виза",
];

export const socialImageAlt =
  "Atlas 1.0.0 - AI admissions assistant for study abroad";

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const;

export const openGraphImage = {
  url: "/opengraph-image",
  width: socialImageSize.width,
  height: socialImageSize.height,
  alt: socialImageAlt,
} as const;

export const twitterImage = {
  url: "/twitter-image",
  alt: socialImageAlt,
} as const;

export function AtlasSocialImage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#f7f8f4",
        color: "#14213d",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(135deg, rgba(15, 118, 110, 0.16) 0%, rgba(247, 248, 244, 0) 42%, rgba(232, 111, 81, 0.18) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -110,
          top: -120,
          width: 420,
          height: 420,
          display: "flex",
          borderRadius: 999,
          background: "#0f766e",
          opacity: 0.13,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -150,
          bottom: -190,
          width: 470,
          height: 470,
          display: "flex",
          borderRadius: 999,
          background: "#e86f51",
          opacity: 0.15,
        }}
      />

      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "70px 78px",
          position: "relative",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid rgba(20, 33, 61, 0.12)",
            background: "rgba(255, 255, 255, 0.72)",
            borderRadius: 34,
            padding: "52px 58px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              <div
                style={{
                  width: 82,
                  height: 82,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 24,
                  background: "#0f766e",
                  color: "white",
                  fontSize: 54,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                A
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                  }}
                >
                  Atlas 1.0.0
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: "#52615c",
                    fontWeight: 600,
                  }}
                >
                  AtlasPath Admissions
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 999,
                background: "#14213d",
                color: "white",
                padding: "14px 22px",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              Study abroad
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 22,
              maxWidth: 830,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 78,
                lineHeight: 0.92,
                fontWeight: 900,
                letterSpacing: 0,
              }}
            >
              AI admissions assistant
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 31,
                lineHeight: 1.26,
                color: "#33423f",
                maxWidth: 790,
              }}
            >
              Countries, programs, documents, scholarships, deadlines and visa
              risks in one calm route.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              color: "#0f766e",
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {["Clear plan", "Smart shortlist", "No chaos"].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  borderRadius: 999,
                  border: "1px solid rgba(15, 118, 110, 0.26)",
                  background: "rgba(191, 231, 222, 0.32)",
                  padding: "13px 18px",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
