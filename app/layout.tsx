import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import "./globals.css"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: {
    default: "CyberITSM SPN",
    template: "%s | CyberITSM SPN",
  },
  description: "Plataforma corporativa de IT Service Management especializada em Arquitetura de Cibersegurança e Conformidade Regulatória",
  keywords: ["ITSM", "Cybersecurity", "Compliance", "Kanban", "NIST", "ISO 27001", "CIS Controls", "SABSA"],
  authors: [{ name: "Vivo Telefônica" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "CyberITSM SPN",
    title: "CyberITSM SPN - IT Service Management",
    description: "Plataforma corporativa de IT Service Management especializada em Arquitetura de Cibersegurança e Conformidade Regulatória",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("cyberitsm-theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  )
}