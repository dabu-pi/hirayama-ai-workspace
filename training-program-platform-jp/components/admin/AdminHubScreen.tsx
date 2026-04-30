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
  },
  {
    href: "/admin/pause-requests",
    title: "休会申請管理",
    description: "休会申請を確認し、承認または却下。有効日・充当情報を表示",
    initial: "休"
  },
  {
    href: "/admin/billing",
    title: "口座振替確定管理",
    description: "翌月分の口座振替データ確定を記録。休会・退会の有効日判定に使用",
    initial: "振"
  },
  {
    href: "/admin/program-stats",
    title: "プログラム利用状況",
    description: "プログラム別の選択数・利用中数・完了数を集計。個人名は表示しない",
    initial: "📊"
  },
  {
    href: "/admin/programs",
    title: "プログラム管理",
    description: "全プログラム一覧（非公開含む）。enrollment数・日数・種目数を確認",
    initial: "📋"
  }
];

export function AdminHubScreen() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>管理メニュー</h1>
        <span className={styles.adminBadge}>管理者</span>
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
