import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "@/lib/ChatWidget";

export const metadata: Metadata = {
  title: "Piyat-Piyat",
  description: "Online multiplayer Piyat-Piyat with a rotating banka",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
