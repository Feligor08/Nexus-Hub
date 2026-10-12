import { describe, expect, it } from 'vitest';

describe('Project & Product Publishing Validation Rules (Sprint 7)', () => {
  function validateProjectForPublish(project: {
    title?: string;
    slug?: string;
    shortDesc?: string;
    description?: string;
    authorId?: string;
  }): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!project.title || project.title.trim().length < 3) missing.push('Titel (mindestens 3 Zeichen)');
    if (!project.slug || project.slug.trim().length === 0) missing.push('Slug');
    if (!project.shortDesc && !project.description) missing.push('Beschreibung oder Kurzbeschreibung');
    if (!project.authorId) missing.push('Autor-ID');
    return { valid: missing.length === 0, missing };
  }

  function validateProductForPublish(product: {
    name?: string;
    slug?: string;
    price?: number;
    currency?: string;
    category?: string;
    shortDesc?: string;
    description?: string;
    digitalProduct?: boolean;
    downloadMediaId?: string;
    mediaFileId?: string;
    fileFormat?: string;
  }): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!product.name || product.name.trim().length < 3) missing.push('Produktname (mindestens 3 Zeichen)');
    if (!product.slug || product.slug.trim().length === 0) missing.push('Slug');
    if (typeof product.price !== 'number' || isNaN(product.price) || product.price < 0) missing.push('Gültiger Preis (>= 0)');
    if (!product.currency) missing.push('Währung (z.B. EUR)');
    if (!product.category) missing.push('Kategorie');
    if (!product.shortDesc && !product.description) missing.push('Beschreibung oder Kurzbeschreibung');
    if (product.digitalProduct && !product.downloadMediaId && !product.mediaFileId && !product.fileFormat) {
      missing.push('Digitale Download-Datei oder Dateiformat');
    }
    return { valid: missing.length === 0, missing };
  }

  it('rejects project publish when mandatory fields are missing', () => {
    const invalid = validateProjectForPublish({
      title: 'Hi', // too short
      slug: '',
      shortDesc: '',
      description: '',
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.missing.length).toBeGreaterThanOrEqual(3);
  });

  it('approves project publish when all mandatory fields are present', () => {
    const valid = validateProjectForPublish({
      title: 'DevOps Automation Suite',
      slug: 'devops-automation-suite',
      description: 'A full CI/CD pipeline automation stack for HP EliteDesk and Docker environments.',
      authorId: 'usr-12345',
    });
    expect(valid.valid).toBe(true);
    expect(valid.missing).toHaveLength(0);
  });

  it('rejects product publish when price or digital file is missing', () => {
    const invalid = validateProductForPublish({
      name: 'Docker Template',
      slug: 'docker-template',
      price: -5, // negative price
      currency: '',
      category: 'Templates',
      digitalProduct: true,
      downloadMediaId: undefined,
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.missing).toContain('Gültiger Preis (>= 0)');
    expect(invalid.missing).toContain('Währung (z.B. EUR)');
    expect(invalid.missing).toContain('Digitale Download-Datei oder Dateiformat');
  });

  it('approves product publish when valid fields and digital files exist', () => {
    const valid = validateProductForPublish({
      name: 'Production Docker Stack',
      slug: 'production-docker-stack',
      price: 19.99,
      currency: 'EUR',
      category: 'DevOps',
      description: 'Ready-to-use production configuration.',
      digitalProduct: true,
      downloadMediaId: 'med-uuid-1234',
    });
    expect(valid.valid).toBe(true);
    expect(valid.missing).toHaveLength(0);
  });
});
