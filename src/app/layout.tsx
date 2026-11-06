import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kitchen Operations",
  description: "Meal service planning and operations workspace",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside>
            <a className="brand" href="/">
              <span className="brand-mark">k.</span>
              <span>
                Kitchen
                <br />
                <small>OPERATIONS</small>
              </span>
            </a>
            <p className="nav-label">WORKSPACE</p>
            <Navigation />
            <div className="sidebar-note">
              <span className="dot" /> A thoughtful kitchen.
              <br />
              <small>One operation at a time.</small>
            </div>
          </aside>
          <div className="workspace">
            <header>
              <span>Kitchen workspace</span>
            </header>
            <main>{children}</main>
            <footer>
              Kitchen Operations <span>All amounts in BRL</span>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
