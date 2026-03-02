import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "EasyGov — Monitoramento de Editais",
  description:
    "Plataforma inteligente de monitoramento automático de editais do PNCP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('easygov-theme');
                  if (theme === 'dark' || theme === 'light') {
                    document.documentElement.setAttribute('data-theme', theme);
                  } else {
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen overflow-x-hidden">
        <ThemeProvider>
          <ToastProvider>
            <a href="#main-content" className="skip-link">
              Ir para o conteúdo principal
            </a>
            <Sidebar />
            <main
              id="main-content"
              className="flex-1 md:ml-[260px] px-3 sm:px-4 md:px-8 py-4 md:py-8 pt-[72px] md:pt-8 pb-24 md:pb-8 overflow-y-auto"
            >
              {children}
            </main>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
