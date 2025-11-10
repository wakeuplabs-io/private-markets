import type { Metadata } from "next";
import { DM_Sans, Lato } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./context";
import { WagmiProviderWrapper } from "./providers/wagmiProvider";
import { WalletProvidersInitializer } from "./components/providers/WalletProvidersInitializer";
import { PXELoadingProvider } from "./providers/pxeLoadingProvider";
import { Layout } from "./components/layout";
import { PXEManagerProvider } from "./providers/pxe/PXEManagerProvider";
import { PXEStatusIndicator } from "./components/pxe/PXEStatusIndicator";

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
              {/* Keep old provider for backward compatibility */}
              <PXELoadingProvider>
                {/* Simplified PXE Queue Manager */}
                <PXEManagerProvider>
                  <Layout>
                    {children}
                  </Layout>
                  <PXEStatusIndicator />
                </PXEManagerProvider>
              </PXELoadingProvider>
            </WalletProvider>
          </WagmiProviderWrapper>
        </WalletProvidersInitializer>
      </body>
    </html>
  );
}
