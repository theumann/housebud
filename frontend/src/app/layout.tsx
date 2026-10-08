import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ShortlistProvider } from "@/context/ShortlistContext";
import { ChatroomsFeedProvider } from "@/context/ChatroomsFeedContext";
import { HouseholdInvitesProvider } from "@/context/HouseholdInvitesContext";

export const metadata: Metadata = {
  title: "Bunkbuddy",
  description: "Roommate matching for students",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
