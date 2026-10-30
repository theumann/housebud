import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ShortlistProvider } from "@/context/ShortlistContext";
import { ChatroomsFeedProvider } from "@/context/ChatroomsFeedContext";
import { HouseholdInvitesProvider } from "@/context/HouseholdInvitesContext";

const appFont = Figtree({ subsets: ["latin"], variable: "--font-app" });

export const metadata: Metadata = {
  title: "HouseBud",
  description: "Find roommates, then run the household together",
  appleWebApp: { capable: true, title: "HouseBud", statusBarStyle: "default" },
};

// The phone's status bar takes the nav's color (the system's light or dark
// mode, not the app's own theme setting, which the browser can't see).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#cbf2e4" },
    { media: "(prefers-color-scheme: dark)", color: "#06233d" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={appFont.variable} suppressHydrationWarning>
      <head>
        {/* Runs before paint to avoid flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-linear-to-br from-theme-from to-theme-to min-h-screen text-foreground">
        {/* React's tree lives in its own container, not directly in <body>:
            browser extensions (password managers) inject nodes into <body>,
            which made React insert the nav in the wrong place after login. */}
        <div id="app-root">
          <AuthProvider>
            <ShortlistProvider>
              <ChatroomsFeedProvider>
                <HouseholdInvitesProvider>{children}</HouseholdInvitesProvider>
              </ChatroomsFeedProvider>
            </ShortlistProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
