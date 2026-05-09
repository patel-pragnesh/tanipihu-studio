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
  return JSON.parse(raw);
}

function normalizeProduct(product) {
  const mergedText = `${product.name || ''} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  const personalization = product.personalizationAvailable ?? /(custom|name|photo|personal)/.test(mergedText);

  return {
    ...product,
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
    if (criteria.budget === 'under-150' && product.price <= 150) score += 3;
    if (criteria.budget === '150-400' && product.price > 150 && product.price <= 400) score += 3;
    if (criteria.budget === '400-800' && product.price > 400 && product.price <= 800) score += 3;
    if (criteria.budget === '800-plus' && product.price > 800) score += 3;
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
  const sourceProducts = Array.isArray(products) && products.length > 0 ? products : loadProducts();

  const normalized = sourceProducts.map(normalizeProduct);
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
