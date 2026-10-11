export const dynamic = 'force-dynamic';
export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="identity-shell preview-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {children}
      <footer className="account-footer">
        Parent-assisted preview · Learning only · Teaching features are inactive
      </footer>
    </div>
  );
}
