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
    if (typeof override.offerLabel === 'string') {
      next.offerLabel = override.offerLabel.trim();
    }

    return next;
  });
}

function normalizeProduct(product) {
  const mergedText = `${product.name || ''} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  const personalization = product.personalizationAvailable ?? /(custom|name|photo|personal)/.test(mergedText);

  const regularPrice = Number(product.price || 0);
  const offerPrice = Number(product.offerPrice);
  const offerEnabled = Boolean(product.offerEnabled) && Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < regularPrice;
  const finalPrice = offerEnabled ? offerPrice : regularPrice;

  return {
    ...product,
    price: regularPrice,
    finalPrice,
    isActive: product.isActive !== false,
    offerEnabled,
    occasion: product.occasion || product.category || 'general',
    personalizationAvailable: personalization
  };
}

function scoreProduct(product, criteria) {
  let score = 1;
  const text = `${product.name || ''} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();

  if (criteria.occasion && criteria.occasion !== 'any') {
    if (product.category === criteria.occasion || product.occasion === criteria.occasion || text.includes(criteria.occasion)) {
      score += 4;
    } else {
      score -= 1;
    }
  }

  if (criteria.budget && criteria.budget !== 'any') {
    const budgetPrice = Number(product.finalPrice || product.price || 0);
    if (criteria.budget === 'under-150' && budgetPrice <= 150) score += 3;
    if (criteria.budget === '150-400' && budgetPrice > 150 && budgetPrice <= 400) score += 3;
    if (criteria.budget === '400-800' && budgetPrice > 400 && budgetPrice <= 800) score += 3;
    if (criteria.budget === '800-plus' && budgetPrice > 800) score += 3;
  }

  if (criteria.recipient && criteria.recipient !== 'any') {
    if (criteria.recipient === 'kids' && (product.category === 'kids' || text.includes('kids'))) score += 3;
    if (criteria.recipient === 'women' && text.includes('women')) score += 3;
    if (criteria.recipient === 'family' && (text.includes('family') || text.includes('home'))) score += 3;
    if (criteria.recipient === 'guests' && (product.category === 'return-gifts' || text.includes('return gift'))) score += 3;
  }

  if (criteria.vibe && criteria.vibe !== 'any') {
    if (criteria.vibe === 'handmade' && (text.includes('handmade') || product.type === 'handmade')) score += 3;
    if (criteria.vibe === 'personalized' && product.personalizationAvailable) score += 3;
    if (criteria.vibe === 'eco' && (product.category === 'eco-friendly' || text.includes('eco'))) score += 3;
    if (criteria.vibe === 'budget' && product.price <= 200) score += 3;
  }

  if (Number(criteria.age || 0) > 0) {
    if (criteria.age <= 10 && (product.category === 'kids' || text.includes('kids'))) score += 2;
    if (criteria.age > 10 && !text.includes('kids')) score += 1;
  }

  if (criteria.theme && String(criteria.theme).trim()) {
    if (text.includes(String(criteria.theme).toLowerCase())) score += 3;
    if (product.personalizationAvailable) score += 1;
  }

  if (Number(criteria.quantity || 1) > 1 && product.category === 'return-gifts') {
    score += 2;
  }

  if (product.featured) score += 1;
  return score;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { criteria = {}, products = [] } = parseBody(event);
  const baseProducts = Array.isArray(products) && products.length > 0 ? products : loadProducts();
  const sourceProducts = applyOverrides(baseProducts, loadOverrides());

  const normalized = sourceProducts.map(normalizeProduct).filter(product => product.isActive !== false);
  const ranked = normalized
    .map(product => ({ product, score: scoreProduct(product, criteria) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.product.featured ? 1 : -1))
    .slice(0, 6);

  const recommendations = ranked.map(item => item.product.id);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recommendations })
  };
};
