import type { Metadata } from "next";
import { Poppins, Inter, Rajdhani } from "next/font/google";
import "../styles/globals.css";
import "../styles/custom.css";
import Providers from "./providers";
import Script from "next/script";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-robot",
});
export const metadata: Metadata = {
  title: "FlexChat - End to End Encrypted Chat App",
  description: "FlexChat is a secure and private chat application that provides end-to-end encryption for your conversations. Enjoy seamless communication with friends and family while keeping your data safe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // load service worker
  

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="/process.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${poppins.variable} ${inter.variable} ${rajdhani.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
