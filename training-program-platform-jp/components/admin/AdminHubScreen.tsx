import styles from "./AdminHubScreen.module.css";

type AdminCard = {
  href: string;
  title: string;
  description: string;
  initial: string;
};

const ADMIN_CARDS: AdminCard[] = [
  {
    href: "/admin/members",
    title: "会員管理",
    description: "会員情報・ステータス・入会状況を管理",
    initial: "会"
  },
  {
    href: "/admin/gym-announcements",
    title: "お知らせ管理",
    description: "ジム画面に表示するお知らせを投稿・編集",
    initial: "知"
  },
  {
    href: "/admin/gym-sponsors",
    title: "スポンサー・協力店管理",
    description: "協力店・スポンサー情報の登録と表示順を管理",
    initial: "ス"
  },
  {
    href: "/admin/gym-requests",
    title: "相談申込管理",
    description: "トレーナー相談・パーソナルトレーニング申込を確認・対応",
    initial: "申"
  },
  {
    href: "/admin/account-deletion-requests",
    title: "退会申請管理",
    description: "退会・アカウント削除申請を確認し、承認または却下",
    initial: "退"
  }
];

export function AdminHubScreen() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>管理メニュー</h1>
        <span className={styles.adminBadge}>Admin</span>
      </header>

      <div className={styles.grid}>
        {ADMIN_CARDS.map((card) => (
          <a className={styles.card} href={card.href} key={card.href}>
            <div className={styles.cardIcon}>{card.initial}</div>
            <div className={styles.cardBody}>
              <p className={styles.cardTitle}>{card.title}</p>
              <p className={styles.cardDesc}>{card.description}</p>
            </div>
            <span className={styles.cardArrow}>›</span>
          </a>
        ))}
      </div>
    </main>
  );
}
