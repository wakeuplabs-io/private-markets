import type { Metadata } from "next";
import { DM_Sans, Lato } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./context";
import { WagmiProviderWrapper } from "./providers/wagmiProvider";
import { WalletProvidersInitializer } from "./components/providers/WalletProvidersInitializer";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans"
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato"
});

export const metadata: Metadata = {
  title: "Aztec Prediction Markets",
  description: "Private betting with zero-knowledge proofs on cross-chain markets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${lato.variable} font-sans antialiased`}>
        <WalletProvidersInitializer>
          <WagmiProviderWrapper>
            <WalletProvider>
              {children}
            </WalletProvider>
          </WagmiProviderWrapper>
        </WalletProvidersInitializer>
      </body>
    </html>
  );
}
