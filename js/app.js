document.addEventListener('DOMContentLoaded', () => {
  const productGrid = document.getElementById('product-grid');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const aiFindBtn = document.getElementById('ai-find-btn');
  const aiPackageBtn = document.getElementById('ai-package-btn');
  const aiResults = document.getElementById('ai-results');
  const aiPackageResult = document.getElementById('ai-package-result');
  const modal = document.getElementById('product-modal');
  const modalContent = document.getElementById('modal-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  const state = {
    allProducts: [],
    activeFilter: 'all',
    searchTerm: '',
    sortBy: 'featured'
  };

  // Fetch and normalize products for richer detail rendering.
  fetch('data/products.json')
    .then(response => response.json())
    .then(data => {
      state.allProducts = data.map(normalizeProduct);
      applyFiltersAndRender();
    })
    .catch(error => {
      console.error('Error loading products:', error);
      productGrid.innerHTML = '<p>Sorry, we could not load the products at this time.</p>';
    });

  // Filter functionality
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.getAttribute('data-filter');
      applyFiltersAndRender();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', event => {
      state.searchTerm = event.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', event => {
      state.sortBy = event.target.value;
      applyFiltersAndRender();
    });
  }

  if (aiFindBtn) {
    aiFindBtn.addEventListener('click', runAIFinder);
  }

  if (aiPackageBtn) {
    aiPackageBtn.addEventListener('click', generateCompletePackage);
  }

  productGrid.addEventListener('click', event => {
    const detailsBtn = event.target.closest('[data-action="details"]');
    const orderBtn = event.target.closest('[data-action="order"]');

    if (detailsBtn) {
      openProductModal(detailsBtn.getAttribute('data-product-id'));
    }

    if (orderBtn) {
      const product = getProductById(orderBtn.getAttribute('data-product-id'));
      if (product) {
        buyProduct(encodeURIComponent(product.whatsappMessage || `Hi, I want to order ${product.name}.`));
      }
    }
  });

  if (aiResults) {
    aiResults.addEventListener('click', event => {
      const detailsBtn = event.target.closest('[data-action="ai-details"]');
      const orderBtn = event.target.closest('[data-action="ai-order"]');

      if (detailsBtn) {
        openProductModal(detailsBtn.getAttribute('data-product-id'));
      }

      if (orderBtn) {
        const product = getProductById(orderBtn.getAttribute('data-product-id'));
        if (product) {
          buyProduct(encodeURIComponent(product.whatsappMessage || `Hi, I want to order ${product.name}.`));
        }
      }
    });
  }

  if (aiPackageResult) {
    aiPackageResult.addEventListener('click', event => {
      const detailsBtn = event.target.closest('[data-action="details"]');
      if (detailsBtn) {
        const productId = detailsBtn.getAttribute('data-product-id');
        if (productId) {
          openProductModal(productId);
        }
      }
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeProductModal);
  }

  if (modal) {
    modal.addEventListener('click', event => {
      const closeArea = event.target.closest('[data-close-modal="true"]');
      const orderBtn = event.target.closest('[data-action="order-from-modal"]');

      if (closeArea) {
        closeProductModal();
      }

      if (orderBtn) {
        const product = getProductById(orderBtn.getAttribute('data-product-id'));
        if (product) {
          buyProduct(encodeURIComponent(product.whatsappMessage || `Hi, I want to order ${product.name}.`));
        }
      }
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeProductModal();
    }
  });

  function normalizeProduct(product) {
    const mergedText = `${product.name || ''} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
    const personalization = product.personalizationAvailable ?? /(custom|name|photo|personal)/.test(mergedText);

    return {
      ...product,
      includes: Array.isArray(product.includes) && product.includes.length > 0
        ? product.includes
        : buildIncludes(product),
      bestFor: Array.isArray(product.bestFor) && product.bestFor.length > 0
        ? product.bestFor
        : buildBestFor(product),
      occasion: product.occasion || inferOccasion(product),
      personalizationAvailable: personalization,
      leadTimeDays: product.leadTimeDays || (personalization ? 3 : 2),
      minOrderQty: product.minOrderQty || (product.category === 'return-gifts' ? 10 : 1),
      qualityNote: product.qualityNote || 'Handmade with care by Tani Pihu Treasure.'
    };
  }

  function buildIncludes(product) {
    const includes = [];
    if (product.type && product.type.includes('hamper')) {
      includes.push('Curated gift hamper items');
    }
    if (product.type && product.type.includes('diy')) {
      includes.push('DIY craft materials');
    }
    if ((product.tags || []).includes('return-gifts')) {
      includes.push('Return gift ready packaging');
    }
    includes.push('Safe packing for delivery');
    return includes;
  }

  function buildBestFor(product) {
    const bestFor = [];
    if (product.category === 'birthday') bestFor.push('Birthday celebrations');
    if (product.category === 'return-gifts') bestFor.push('Return gifting events');
    if (product.category === 'kids') bestFor.push('Kids activity and party kits');
    if (product.category === 'eco-friendly') bestFor.push('Eco-conscious gifting');
    if (bestFor.length === 0) bestFor.push('Thoughtful gifting');
    return bestFor;
  }

  function inferOccasion(product) {
    if (product.category === 'return-gifts') return 'return-gifts';
    if (product.category === 'kids') return 'kids';
    return product.category || 'general';
  }

  function applyFiltersAndRender() {
    let filtered = [...state.allProducts];

    if (state.activeFilter !== 'all') {
      filtered = filtered.filter(product => product.category === state.activeFilter);
    }

    if (state.searchTerm) {
      filtered = filtered.filter(product => {
        const tags = (product.tags || []).join(' ').toLowerCase();
        const haystack = `${product.name} ${product.description} ${product.category} ${product.type} ${tags}`.toLowerCase();
        return haystack.includes(state.searchTerm);
      });
    }

    filtered.sort((a, b) => {
      switch (state.sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'featured':
        default:
          if (a.featured === b.featured) return a.name.localeCompare(b.name);
          return a.featured ? -1 : 1;
      }
    });

    renderProducts(filtered);
  }

  function renderProducts(products) {
    if (products.length === 0) {
      productGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">No products found in this category.</p>';
      return;
    }

    productGrid.innerHTML = products.map(product => {
      const badgeHtml = product.badge ? `<div class="product-badge">${product.badge}</div>` : '';
      const imageSrc = (product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/400x300?text=Tanipihu';
      
      return `
        <div class="product-card">
          ${badgeHtml}
          <img src="${imageSrc}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/400x300?text=Tanipihu'">
          <div class="product-info">
            <div class="product-category">${product.category.replace(/-/g, ' ')}</div>
            <h3 class="product-title">${product.name}</h3>
            <div class="product-price">₹${product.price}</div>
            <p class="product-desc">${product.shortDescription || product.description.substring(0, 60) + '...'}</p>
            <div class="card-actions">
              <button class="btn-secondary" data-action="details" data-product-id="${product.id}">View Details</button>
              <button class="btn-buy" data-action="order" data-product-id="${product.id}">Order</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function runAIFinder() {
    const criteria = getAICriteria();

    fetch('/api/ai-gift-finder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria, products: state.allProducts })
    })
      .then(async response => {
        if (!response.ok) throw new Error('API error');
        return response.json();
      })
      .then(result => {
        const ids = result.recommendations || [];
        const selected = ids.map(getProductById).filter(Boolean);
        if (selected.length > 0) {
          renderAIResults(selected);
          return;
        }
        runLocalAIFinder(criteria);
      })
      .catch(() => {
        runLocalAIFinder(criteria);
      });
  }

  function runLocalAIFinder(criteria) {
    const ranked = state.allProducts
      .map(product => ({ product, score: scoreProduct(product, criteria) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || (b.product.featured ? 1 : -1));

    const selected = ranked.length > 0
      ? ranked.slice(0, 4).map(item => item.product)
      : state.allProducts.filter(product => product.featured).slice(0, 4);

    renderAIResults(selected);
  }

  function getAICriteria() {
    return {
      occasion: document.getElementById('ai-occasion')?.value || 'any',
      budget: document.getElementById('ai-budget')?.value || 'any',
      recipient: document.getElementById('ai-recipient')?.value || 'any',
      vibe: document.getElementById('ai-vibe')?.value || 'any',
      age: Number(document.getElementById('ai-age')?.value || 0),
      theme: (document.getElementById('ai-theme')?.value || '').trim(),
      quantity: Number(document.getElementById('ai-qty')?.value || 1)
    };
  }

  function generateCompletePackage() {
    const criteria = getAICriteria();

    fetch('/api/ai-complete-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria, products: state.allProducts })
    })
      .then(async response => {
        if (!response.ok) throw new Error('API error');
        return response.json();
      })
      .then(result => renderPackageResult(result))
      .catch(() => {
        renderPackageResult(buildLocalPackage(criteria));
      });
  }

  function buildLocalPackage(criteria) {
    const ranked = state.allProducts
      .map(product => ({ product, score: scoreProduct(product, criteria) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.product.id);

    const titleTheme = criteria.theme || 'Celebration';

    return {
      title: `${titleTheme} Complete Gift Package`,
      summary: `A curated package for ${criteria.quantity || 1} guest(s), personalized for your occasion.`,
      recommendations: ranked,
      assets: [
        'Invitation card concept',
        'Return gift tag design',
        'Thank you card line',
        'Sticker label text',
        'WhatsApp order summary'
      ],
      whatsappText: `Hi, I need a complete ${criteria.occasion} gift package for ${criteria.quantity || 1} people. Theme: ${titleTheme}. Please share final quote.`
    };
  }

  function renderPackageResult(result) {
    if (!aiPackageResult) return;

    const picks = (result.recommendations || []).map(getProductById).filter(Boolean);
    const assets = result.assets || [];
    const whatsappText = encodeURIComponent(result.whatsappText || 'Hi, I need a complete gift package plan.');

    aiPackageResult.innerHTML = `
      <article class="package-card">
        <h3>${result.title || 'Complete Gift Package'}</h3>
        <p>${result.summary || ''}</p>

        <div class="package-grid">
          ${picks.map(product => `<div class="package-item"><strong>${product.name}</strong><br>₹${product.price}</div>`).join('')}
          ${assets.map(asset => `<div class="package-item">${asset}</div>`).join('')}
        </div>

        <div class="modal-actions">
          <a href="https://wa.me/919726571954?text=${whatsappText}" target="_blank" rel="noopener" class="btn-buy">Finalize Package on WhatsApp</a>
          <button class="btn-secondary" data-action="details" data-product-id="${picks[0]?.id || ''}">${picks[0] ? 'View Top Product' : 'Browse Products'}</button>
        </div>
      </article>
    `;
  }

  function scoreProduct(product, criteria) {
    let score = 1;
    const text = `${product.name} ${product.description} ${(product.tags || []).join(' ')}`.toLowerCase();

    if (criteria.occasion !== 'any') {
      if (product.category === criteria.occasion || product.occasion === criteria.occasion || text.includes(criteria.occasion)) {
        score += 4;
      } else {
        score -= 1;
      }
    }

    if (criteria.budget !== 'any') {
      if (criteria.budget === 'under-150' && product.price <= 150) score += 3;
      if (criteria.budget === '150-400' && product.price > 150 && product.price <= 400) score += 3;
      if (criteria.budget === '400-800' && product.price > 400 && product.price <= 800) score += 3;
      if (criteria.budget === '800-plus' && product.price > 800) score += 3;
    }

    if (criteria.recipient !== 'any') {
      if (criteria.recipient === 'kids' && (product.category === 'kids' || text.includes('kids'))) score += 3;
      if (criteria.recipient === 'women' && text.includes('women')) score += 3;
      if (criteria.recipient === 'family' && (text.includes('family') || text.includes('home'))) score += 3;
      if (criteria.recipient === 'guests' && (product.category === 'return-gifts' || text.includes('return gift'))) score += 3;
    }

    if (criteria.age > 0) {
      if (criteria.age <= 10 && (product.category === 'kids' || text.includes('kids'))) score += 2;
      if (criteria.age > 10 && !text.includes('kids')) score += 1;
    }

    if (criteria.theme) {
      if (text.includes(criteria.theme.toLowerCase())) score += 3;
      if (product.personalizationAvailable) score += 1;
    }

    if (criteria.quantity > 1 && product.category === 'return-gifts') {
      score += 2;
    }

    if (criteria.vibe !== 'any') {
      if (criteria.vibe === 'handmade' && (text.includes('handmade') || product.type === 'handmade')) score += 3;
      if (criteria.vibe === 'personalized' && product.personalizationAvailable) score += 3;
      if (criteria.vibe === 'eco' && (product.category === 'eco-friendly' || text.includes('eco'))) score += 3;
      if (criteria.vibe === 'budget' && product.price <= 200) score += 3;
    }

    if (product.featured) score += 1;
    return score;
  }

  function renderAIResults(products) {
    if (!aiResults) return;

    if (!products || products.length === 0) {
      aiResults.innerHTML = '<p class="ai-empty">No recommendations found. Try a different budget or occasion.</p>';
      return;
    }

    aiResults.innerHTML = products.map(product => {
      const image = (product.images && product.images[0]) || 'https://via.placeholder.com/400x300?text=Tanipihu';

      return `
        <article class="ai-card">
          <img src="${image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/400x300?text=Tanipihu'">
          <div class="ai-card-body">
            <h4>${product.name}</h4>
            <div class="price">₹${product.price}</div>
            <p>${product.shortDescription || product.description.substring(0, 72) + '...'}</p>
            <div class="ai-actions">
              <button class="btn-secondary" data-action="ai-details" data-product-id="${product.id}">Details</button>
              <button class="btn-buy" data-action="ai-order" data-product-id="${product.id}">Order</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function getProductById(productId) {
    return state.allProducts.find(product => product.id === productId);
  }

  function openProductModal(productId) {
    const product = getProductById(productId);
    if (!product || !modal || !modalContent) return;

    const image = (product.images && product.images[0]) || 'https://via.placeholder.com/400x300?text=Tanipihu';
    const thumbs = (product.images || []).slice(1, 5);

    modalContent.innerHTML = `
      <div class="modal-layout">
        <div>
          <img src="${image}" alt="${product.name}" class="modal-main-image" onerror="this.src='https://via.placeholder.com/400x300?text=Tanipihu'">
          <div class="modal-thumb-grid">
            ${thumbs.map(src => `<img src="${src}" alt="${product.name}" onerror="this.style.display='none'">`).join('')}
          </div>
        </div>

        <div>
          <p class="product-category">${product.category.replace(/-/g, ' ')}</p>
          <h2>${product.name}</h2>
          <p class="modal-price">₹${product.price}</p>
          <p>${product.description}</p>

          <div class="meta-grid">
            <div class="meta-item"><strong>Min Qty:</strong> ${product.minOrderQty}</div>
            <div class="meta-item"><strong>Lead Time:</strong> ${product.leadTimeDays} day(s)</div>
            <div class="meta-item"><strong>Occasion:</strong> ${product.occasion.replace(/-/g, ' ')}</div>
            <div class="meta-item"><strong>Personalization:</strong> ${product.personalizationAvailable ? 'Available' : 'Standard'}</div>
          </div>

          <h3>What's Included</h3>
          <ul class="detail-list">
            ${product.includes.map(item => `<li>${item}</li>`).join('')}
          </ul>

          <h3>Best For</h3>
          <ul class="detail-list">
            ${product.bestFor.map(item => `<li>${item}</li>`).join('')}
          </ul>

          <p><strong>Quality Note:</strong> ${product.qualityNote}</p>

          <div class="modal-actions">
            <button class="btn-buy" data-action="order-from-modal" data-product-id="${product.id}">Order on WhatsApp</button>
            <a href="https://www.instagram.com/tanipihutreasures" target="_blank" rel="noopener" class="btn-secondary" style="text-align:center; display:inline-block; line-height:2.2;">View on Instagram</a>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Global buy function
  function buyProduct(message) {
    const whatsappNumber = '919726571954';
    const url = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(url, '_blank');
  }

  window.buyProduct = buyProduct;
});
