import Link from 'next/link';
import { ArrowUpRight, ChefHat, Grid2X2, Leaf, ListFilter, Tags } from 'lucide-react';

const catalogSections = [
  { href: '/dashboard/catalogue/dishes', title: 'Dishes', description: 'Add meals and decide where they appear.', icon: ChefHat },
  { href: '/dashboard/catalogue/options', title: 'Add-ons', description: 'Create extras employees can choose with a dish.', icon: Tags },
  { href: '/dashboard/catalogue/option-groups', title: 'Add-on groups', description: 'Put related choices together, like sides or drinks.', icon: Grid2X2 },
  { href: '/dashboard/catalogue/categories', title: 'Categories', description: 'Organize dishes into sections of the menu.', icon: ListFilter },
  { href: '/dashboard/catalogue/reference-data', title: 'Dietary & kitchen details', description: 'Manage allergens, dietary labels and prep stations.', icon: Leaf },
];

export default function CatalogueSelectionPage() {
  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <div className="page-heading">
        <div><span className="page-eyebrow">Menu management</span><h1 className="page-title">Menu catalogue</h1><p className="page-subtitle">Build your menu step by step. Set up add-ons and categories, then create dishes and connect them together.</p></div>
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
            className="glass-panel surface-link"
          >
            <div><h2 style={{ fontSize: '1.05rem', marginBottom: 8 }}>{section.title}</h2><p className="help-note">{section.description}</p><span className="page-eyebrow" style={{ marginTop: 14, marginBottom: 0, letterSpacing: 0 }}>Open <ArrowUpRight size={14} /></span></div>
            <span className="surface-link-icon"><section.icon size={20} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
