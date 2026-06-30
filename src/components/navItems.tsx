import {
  ActivityIcon,
  CardIcon,
  ChatIcon,
  CoinsIcon,
  ExchangeIcon,
  PieIcon,
  PlusIcon,
  UsersIcon,
} from "./icons";

export interface NavItem {
  label: string;
  href: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Treasury", href: "/", icon: CoinsIcon },
  { label: "Deposit", href: "/deposit", icon: PlusIcon },
  { label: "Chat", href: "/chat", icon: ChatIcon },
  { label: "Spend", href: "/spend", icon: PieIcon },
  { label: "Sub-accounts", href: "/sub-accounts", icon: UsersIcon },
  { label: "Team", href: "/team", icon: UsersIcon },
  { label: "Activity", href: "/activity", icon: ActivityIcon },
  { label: "Exchange", href: "/exchange", icon: ExchangeIcon },
  { label: "Cards & Keys", href: "/cards", icon: CardIcon },
];
