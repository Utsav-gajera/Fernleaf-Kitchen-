import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../context/AuthContext';
import Navbar from '../components/Navbar';

export const metadata: Metadata = {
  title: 'FernLeaf Kitchen',
  description: 'FernLeaf Kitchen dashboard.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ flex: 1 }}>{children}</main>
          <footer
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '0.85rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <span>&copy; {new Date().getFullYear()} FernLeaf Kitchen</span>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
