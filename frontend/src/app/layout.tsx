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
      <body className="bg-gradient-to-br from-theme-from to-theme-to min-h-screen text-foreground">
        <AuthProvider>
          <ShortlistProvider>
            <ChatroomsFeedProvider>
              <HouseholdInvitesProvider>{children}</HouseholdInvitesProvider>
            </ChatroomsFeedProvider>
          </ShortlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
