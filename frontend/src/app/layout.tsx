import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ShortlistProvider } from "@/context/ShortlistContext";
import { ChatroomsFeedProvider } from "@/context/ChatroomsFeedContext";

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
    <html lang="en">
      <body className="bg-background text-foreground">
        <AuthProvider>
          <ShortlistProvider>
            <ChatroomsFeedProvider>
              {children}
            </ChatroomsFeedProvider>
          </ShortlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
