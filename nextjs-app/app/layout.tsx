import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mobile Auth Test - Transcodes',
  description: 'Test app for mobile authentication',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const projectId = process.env.NEXT_PUBLIC_TRANSCODES_PROJECT_ID;
  const scriptSrc = projectId 
    ? `https://d2xt92e3v27lcm.cloudfront.net/${projectId}/webworker.js`
    : null;

  return (
    <html lang="en">
      <body>
        {scriptSrc && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            type="module"
            src={scriptSrc}
          />
        )}
        {children}
      </body>
    </html>
  );
}

