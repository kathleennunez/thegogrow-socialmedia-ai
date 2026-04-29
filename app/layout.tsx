import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { AppChrome } from "@/components/AppChrome";
import { UserProvider } from "@/components/UserProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TheGoGrow SocialMedia AI",
  description: "Generate, save, and publish social content with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full">
        <UserProvider>
          <AppChrome>{children}</AppChrome>
        </UserProvider>
      </body>
    </html>
  );
}
