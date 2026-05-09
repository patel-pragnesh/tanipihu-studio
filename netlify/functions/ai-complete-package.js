const fs = require('fs');
const path = require('path');

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function loadProducts() {
  const filePath = path.join(__dirname, '..', '..', 'data', 'products.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : (Array.isArray(parsed.products) ? parsed.products : []);
}

function loadOverrides() {
  try {
    const filePath = path.join(__dirname, '..', '..', 'data', 'product-overrides.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.overrides) ? parsed.overrides : [];
  } catch {
    return [];
  }
}

function applyOverrides(products, overrides) {
  const overrideMap = new Map(
    overrides
      .filter(item => item && item.id)
      .map(item => [item.id, item])
  );

  return products.map(product => {
    const override = overrideMap.get(product.id);
    if (!override) return product;

    const next = { ...product };
    if (typeof override.category === 'string' && override.category.trim()) {
      next.category = override.category.trim();
    }
    if (Number.isFinite(Number(override.price))) {
      next.price = Number(override.price);
    }
    if (Array.isArray(override.images) && override.images.length > 0) {
      next.images = override.images;
    }
    if (Object.prototype.hasOwnProperty.call(override, 'isActive')) {
      next.isActive = Boolean(override.isActive);
    }
    if (Object.prototype.hasOwnProperty.call(override, 'offerEnabled')) {
      next.offerEnabled = Boolean(override.offerEnabled);
    }
    if (Number.isFinite(Number(override.offerPrice))) {
      next.offerPrice = Number(override.offerPrice);
    }

    return next;
  });
}

function normalizeProduct(product) {
  const regularPrice = Number(product.price || 0);
  const offerPrice = Number(product.offerPrice);
  const offerEnabled = Boolean(product.offerEnabled) && Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < regularPrice;

  return {
    ...product,
    price: regularPrice,
    finalPrice: offerEnabled ? offerPrice : regularPrice,
    isActive: product.isActive !== false,
    offerEnabled
  };
}

function scoreProduct(product, criteria) {
  let score = 1;
  const text = `${product.name || ''} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();

  if (criteria.occasion && criteria.occasion !== 'any') {
    if (product.category === criteria.occasion || text.includes(criteria.occasion)) score += 4;
  }

  if (criteria.budget && criteria.budget !== 'any') {
    const budgetPrice = Number(product.finalPrice || product.price || 0);
    if (criteria.budget === 'under-150' && budgetPrice <= 150) score += 3;
    if (criteria.budget === '150-400' && budgetPrice > 150 && budgetPrice <= 400) score += 3;
    if (criteria.budget === '400-800' && budgetPrice > 400 && budgetPrice <= 800) score += 3;
    if (criteria.budget === '800-plus' && budgetPrice > 800) score += 3;
  }

  if (criteria.theme && product.personalizationAvailable) score += 1;
  if (Number(criteria.quantity || 1) > 1 && product.category === 'return-gifts') score += 2;
  if (product.featured) score += 1;

  return score;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { criteria = {}, products = [] } = parseBody(event);
  const baseProducts = Array.isArray(products) && products.length > 0 ? products : loadProducts();
  const sourceProducts = applyOverrides(baseProducts, loadOverrides())
    .map(normalizeProduct)
    .filter(product => product.isActive !== false);

  const topProducts = [...sourceProducts]
    .sort((a, b) => scoreProduct(b, criteria) - scoreProduct(a, criteria))
    .slice(0, 3)
    .map(product => product.id);

  const occasionText = criteria.occasion && criteria.occasion !== 'any' ? criteria.occasion.replace(/-/g, ' ') : 'special occasion';
  const qty = Number(criteria.quantity || 1);
  const theme = String(criteria.theme || 'custom celebration').trim();

  const assets = [
    `${theme} invitation card copy`,
    `${theme} thank you card line`,
    `${theme} return gift tag text`,
    `${theme} label/sticker text`,
    `Packing insert message with name/date`
  ];

  const whatsappText = [
    'Hi, I need a complete gifting package.',
    `Occasion: ${occasionText}`,
    `Theme: ${theme}`,
    `Quantity: ${qty}`,
    `Suggested products: ${topProducts.join(', ')}`,
    'Please share final quote and timeline.'
  ].join(' ');

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `${theme} Complete Gift Package`,
      summary: `AI-curated plan for ${qty} gift set(s) for ${occasionText}.`,
      recommendations: topProducts,
      assets,
      whatsappText
    })
  };
};
