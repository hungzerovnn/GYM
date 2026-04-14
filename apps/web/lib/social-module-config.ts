export type SocialModuleCategory = "social-network" | "messaging";

export type SocialModuleConfig = {
  settingKey: string;
  slug: string;
  menuLabel: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  category: SocialModuleCategory;
  capabilities: string[];
};

export const socialHubSettingKey = "social-hub";
export const socialLinkCenterSettingKey = "social-link-center";
export const socialHubPath = "/social/hub";
export const socialLinkCenterPath = "/social/link-center";
export const socialInboxPath = "/social/inbox";
export const socialPerformancePath = "/social/performance";

export const socialCategoryLabels: Record<SocialModuleCategory, string> = {
  "social-network": "Mang xa hoi pho bien",
  messaging: "Kenh chat / social",
};

export const socialModuleCatalog: SocialModuleConfig[] = [
  {
    settingKey: "social-zalo-oa",
    slug: "zalo-oa",
    menuLabel: "Zalo",
    title: "Zalo",
    subtitle: "OA, token, webhook, chat doi ngu va luong hoi thoai.",
    description: "Quan ly Zalo trong mot man hinh gon, tap trung vao OA, webhook, chat va lead.",
    icon: "megaphone",
    category: "messaging",
    capabilities: ["OA", "Chat", "Webhook", "Lead"],
  },
  {
    settingKey: "social-wechat",
    slug: "wechat",
    menuLabel: "WeChat",
    title: "WeChat",
    subtitle: "Official account, QR follow, message hub va webhook.",
    description: "Ket noi WeChat / Official Account, QR follow, inbox va webhook automation.",
    icon: "waypoints",
    category: "messaging",
    capabilities: ["Official", "QR", "Message"],
  },
  {
    settingKey: "social-whatsapp",
    slug: "whatsapp",
    menuLabel: "WhatsApp",
    title: "WhatsApp",
    subtitle: "WhatsApp Business, template, webhook va team inbox.",
    description: "Quan ly WhatsApp Business, template, chatbot / webhook va phan bo agent.",
    icon: "send",
    category: "messaging",
    capabilities: ["Business", "Template", "Inbox"],
  },
  {
    settingKey: "social-messenger",
    slug: "messenger",
    menuLabel: "Messenger",
    title: "Messenger",
    subtitle: "Messenger page, quick reply, bot hook va lead capture.",
    description: "Cau hinh Messenger cho fanpage, quick reply, bot hook va nhan lead tu inbox.",
    icon: "send",
    category: "messaging",
    capabilities: ["Inbox", "Quick Reply", "Lead"],
  },
  {
    settingKey: "social-telegram",
    slug: "telegram",
    menuLabel: "Telegram",
    title: "Telegram",
    subtitle: "Bot/API, webhook, group chat, command va routing.",
    description: "Ket noi bot Telegram, webhook, group / channel va lenh automation cho CSKH.",
    icon: "send",
    category: "messaging",
    capabilities: ["Bot", "Group", "Command"],
  },
  {
    settingKey: "social-viber",
    slug: "viber",
    menuLabel: "Viber",
    title: "Viber",
    subtitle: "Business account, auto-reply, webhook va template.",
    description: "Quan ly Viber Business, auto-reply, token va mau hoi dap.",
    icon: "workflow",
    category: "messaging",
    capabilities: ["Chat", "Auto Reply", "Webhook"],
  },
  {
    settingKey: "social-line",
    slug: "line",
    menuLabel: "LINE",
    title: "LINE",
    subtitle: "LINE OA, rich menu, webhook, template va chat routing.",
    description: "Ket noi LINE Official Account, rich menu, mau tin nhan va routing theo nhan vien.",
    icon: "workflow",
    category: "messaging",
    capabilities: ["OA", "Rich Menu", "Chat"],
  },
  {
    settingKey: "social-kakaotalk",
    slug: "kakaotalk",
    menuLabel: "KakaoTalk",
    title: "KakaoTalk",
    subtitle: "Business channel, template, webhook va CSKH workflow.",
    description: "Cau hinh KakaoTalk Business channel, template, webhook va flow CSKH.",
    icon: "users-round",
    category: "messaging",
    capabilities: ["Channel", "Template", "Workflow"],
  },
  {
    settingKey: "social-signal",
    slug: "signal",
    menuLabel: "Signal",
    title: "Signal",
    subtitle: "Secure chat routing, agent assignment va note log.",
    description: "Quan ly kenh Signal theo huong bao mat, agent assignment va luu note noi bo.",
    icon: "fingerprint",
    category: "messaging",
    capabilities: ["Secure Chat", "Assign", "Note"],
  },
  {
    settingKey: "social-discord",
    slug: "discord",
    menuLabel: "Discord",
    title: "Discord",
    subtitle: "Server, channel, bot token, ticket routing va alert.",
    description: "Quan ly Discord server / channel, bot token, ticket routing va canh bao realtime.",
    icon: "headset",
    category: "messaging",
    capabilities: ["Server", "Bot", "Alert"],
  },
];

export const socialLinkChannelOptions = [
  { label: "Da kenh / dung chung", value: "multi" },
  { label: "Zalo", value: "zalo" },
  { label: "WeChat", value: "wechat" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Messenger", value: "messenger" },
  { label: "Telegram", value: "telegram" },
  { label: "Viber", value: "viber" },
  { label: "LINE", value: "line" },
  { label: "KakaoTalk", value: "kakaotalk" },
  { label: "Signal", value: "signal" },
  { label: "Discord", value: "discord" },
] as const;

const socialRequestedChannelLabels: Record<string, string> = {
  multi: "Da kenh / dung chung",
  zalo: "Zalo",
  "zalo-oa": "Zalo",
  "zalo-personal": "Zalo",
  wechat: "WeChat",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  "facebook-messenger": "Messenger",
  telegram: "Telegram",
  viber: "Viber",
  line: "LINE",
  kakaotalk: "KakaoTalk",
  signal: "Signal",
  discord: "Discord",
};

export const getSocialRequestedChannelLabel = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return socialRequestedChannelLabels.multi;
  }

  return socialRequestedChannelLabels[normalized] || String(value || "").trim();
};

export const socialModuleBySettingKey = new Map(
  socialModuleCatalog.map((item) => [item.settingKey, item] as const),
);

export const socialModuleGroups = {
  "social-network": socialModuleCatalog.filter((item) => item.category === "social-network"),
  messaging: socialModuleCatalog.filter((item) => item.category === "messaging"),
} as const;
