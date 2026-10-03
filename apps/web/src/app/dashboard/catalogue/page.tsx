import Link from 'next/link';

const catalogSections = [
  { href: '/dashboard/catalogue/dishes', title: 'Dishes', description: 'Create, update, and manage menu items and dish relations.' },
  { href: '/dashboard/catalogue/options', title: 'Options', description: 'Manage reusable add-ons and their metadata.' },
  { href: '/dashboard/catalogue/option-groups', title: 'Option Groups', description: 'Group related options and configure required/portion rules.' },
  { href: '/dashboard/catalogue/categories', title: 'Categories', description: 'Organize menu categories and display order.' },
  { href: '/dashboard/catalogue/reference-data', title: 'Reference Data', description: 'Manage allergens, dietary tags, and kitchen stations.' },
];

export default function CatalogueSelectionPage() {
  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Catalogue</h1>
        <p style={{ color: 'var(--text-muted)' }}>Choose the catalogue item you want to manage.</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
        }}
      >
        {catalogSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="glass-panel"
            style={{
              display: 'block',
              padding: '1.25rem 1.1rem',
              textDecoration: 'none',
              transition: 'transform 0.2s ease',
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>{section.title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>{section.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
