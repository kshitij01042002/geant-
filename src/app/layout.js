import './globals.css'

export const metadata = {
  title: 'GÉANT Knowledge Assistant',
  description: 'RAG-powered chatbot for GÉANT documents',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
