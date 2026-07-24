import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Método BioHealth®',
  description: 'Software clínico para medicina funcional y ortomolecular.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-crema font-sans text-choco antialiased">{children}</body>
    </html>
  );
}
