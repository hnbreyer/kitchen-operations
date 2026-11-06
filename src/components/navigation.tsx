"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [
  ["/", "Overview", "◫"],
  ["/operations", "Operations", "▦"],
  ["/recipes", "Recipes & Menus", "≋"],
  ["/purchasing", "Purchasing", "▤"],
  ["/sales", "Sales", "↗"],
  ["/finances", "Finances", "◷"],
  ["/settings", "Settings", "⚙"],
];
export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
      {links.map(([href, label, icon]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            pathname === href ||
            (href !== "/" && pathname.startsWith(`${href}/`))
              ? "page"
              : undefined
          }
        >
          <span aria-hidden="true">{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
