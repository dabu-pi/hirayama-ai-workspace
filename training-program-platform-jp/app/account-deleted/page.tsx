export default function AccountDeletedPage() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 24
      }}
    >
      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: 800,
          margin: 0,
          letterSpacing: "-0.01em"
        }}
      >
        アカウントは削除されました
      </h1>

      <p style={{ fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
        トレーニングアプリのアカウントは削除されました。
        ご利用いただきありがとうございました。
      </p>

      <div
        style={{
          padding: "16px 20px",
          border: "1px solid rgba(251,191,36,0.3)",
          borderRadius: 8,
          background: "rgba(251,191,36,0.06)"
        }}
      >
        <p
          style={{
            fontSize: "0.75rem",
            lineHeight: 1.6,
            margin: 0,
            color: "#fbbf24"
          }}
        >
          ジムの会員契約・会費・休会・退会手続きは、この操作だけでは完了していません。
          退会・休会・会費に関するお手続きは、受付までお申し出ください。
        </p>
      </div>

      <a
        href="/login"
        style={{
          display: "block",
          textAlign: "center",
          padding: "14px 24px",
          background: "transparent",
          border: "1px solid #444",
          borderRadius: 12,
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "inherit",
          textDecoration: "none"
        }}
      >
        ログイン画面へ
      </a>
    </main>
  );
}
