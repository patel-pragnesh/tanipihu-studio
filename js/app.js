document.addEventListener('DOMContentLoaded', () => {
  const productGrid = document.getElementById('product-grid');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const aiFindBtn = document.getElementById('ai-find-btn');
  const aiPackageBtn = document.getElementById('ai-package-btn');
  const aiResults = document.getElementById('ai-results');
  const aiPackageResult = document.getElementById('ai-package-result');
  const promoBanner = document.getElementById('promo-banner');
  const modal = document.getElementById('product-modal');
  const modalContent = document.getElementById('modal-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  const state = {
    allProducts: [],
    activeFilter: 'all',
    searchTerm: '',
    sortBy: 'featured',
    storeSettings: {
      bannerEnabled: false,
      bannerText: '',
      bannerCode: '',
      bannerMinOrder: 0,
      bannerDiscountText: ''
    }
  };

  // Fetch base products + quick overrides and merge before rendering.
  Promise.all([
    fetch('data/products.json').then(response => response.json()),
    fetch('data/product-overrides.json').then(response => response.json()).catch(() => ({ overrides: [] })),
    fetch('data/site-settings.json').then(response => response.json()).catch(() => ({}))
  ])
    .then(([productsData, overrideData, siteSettingsData]) => {
      const sourceList = Array.isArray(productsData)
        ? productsData
        : (Array.isArray(productsData.products) ? productsData.products : []);

      const overrides = Array.isArray(overrideData?.overrides) ? overrideData.overrides : [];
      const mergedProducts = applyOverrides(sourceList, overrides);
      state.storeSettings = normalizeStoreSettings(siteSettingsData);
      applyStoreBanner();

      state.allProducts = mergedProducts.map(normalizeProduct);
      applyFiltersAndRender();
    })
    .catch(error => {
      console.error('Error loading products:', error);
      productGrid.innerHTML = '<p>Sorry, we could not load the products at this time.</p>';
    });

  function normalizeStoreSettings(rawSettings) {
    const banner = rawSettings?.marketingBanner || rawSettings || {};

    return {
      bannerEnabled: Boolean(banner.enabled),
      bannerText: String(banner.text || '').trim(),
      bannerCode: String(banner.couponCode || banner.code || '').trim(),
      bannerMinOrder: Number(banner.minOrderAmount || banner.minOrder || 0) || 0,
      bannerDiscountText: String(banner.discountText || '').trim()
    };
  }

  function applyStoreBanner() {
    if (!promoBanner) return;

    const settings = state.storeSettings;
    if (!settings.bannerEnabled || !settings.bannerText) {
      promoBanner.classList.add('is-hidden');
      promoBanner.textContent = '';
      return;
    }

    promoBanner.textContent = settings.bannerText;
    promoBanner.classList.remove('is-hidden');
  }

  function getBannerOfferForOrder(totalAmount) {
    const settings = state.storeSettings;
    if (!settings.bannerEnabled || !settings.bannerCode) {
      return null;
    }

    return {
      code: settings.bannerCode,
      minOrder: Number(settings.bannerMinOrder || 0),
      discountText: settings.bannerDiscountText || 'Special offer',
      isEligible: Number(totalAmount || 0) >= Number(settings.bannerMinOrder || 0)
    };
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
      if (typeof override.offerEndsAt === 'string') {
        next.offerEndsAt = override.offerEndsAt.trim();
      }

      return next;
    });
  }

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
        const card = orderBtn.closest('.product-card');
        const quantityInput = card?.querySelector('[data-role="qty-input"]');
        const quantity = getValidQuantity(quantityInput?.value, product.minOrderQty);
        const orderMeta = getOrderMeta(card);
        buyProduct(composeWhatsAppMessage(product, quantity, 'Product Card', orderMeta));
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
          const card = orderBtn.closest('.ai-card');
          const quantityInput = card?.querySelector('[data-role="qty-input"]');
          const quantity = getValidQuantity(quantityInput?.value, product.minOrderQty);
          const orderMeta = getOrderMeta(card);
          buyProduct(composeWhatsAppMessage(product, quantity, 'AI Gift Finder', orderMeta));
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
          const detailsWrap = modal.querySelector('.modal-order-details');
          const quantityInput = modal.querySelector('[data-role="modal-qty-input"]');
          const quantity = getValidQuantity(quantityInput?.value, product.minOrderQty);
          const orderMeta = getOrderMeta(detailsWrap);
          buyProduct(composeWhatsAppMessage(product, quantity, 'Product Details', orderMeta));
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

    const regularPrice = Number(product.price || 0);
    const offerPrice = Number(product.offerPrice);
    const hasValidOffer = Boolean(product.offerEnabled) && Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < regularPrice;
    const finalPrice = hasValidOffer ? offerPrice : regularPrice;
    const discountPercent = hasValidOffer
      ? Math.round(((regularPrice - offerPrice) / regularPrice) * 100)
      : 0;

    return {
      ...product,
      price: regularPrice,
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
      qualityNote: product.qualityNote || 'Handmade with care by Tani Pihu Treasure.',
      isActive: product.isActive !== false,
      offerEnabled: hasValidOffer,
      offerPrice: hasValidOffer ? offerPrice : null,
      finalPrice,
      discountPercent,
      offerLabel: (product.offerLabel || '').trim(),
      offerEndsAt: (product.offerEndsAt || '').trim()
    };
  }

  function formatOfferCountdown(endValue) {
    if (!endValue) return '';
    const end = new Date(endValue);
    if (Number.isNaN(end.getTime())) return '';

    const diffMs = end.getTime() - Date.now();
    if (diffMs <= 0) return 'Offer ended';

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `Offer ends in ${days}d ${hours}h`;
    return `Offer ends in ${hours}h ${minutes}m`;
  }

  function getOfferLabel(product) {
    if (!product.offerEnabled) return '';
    const countdown = formatOfferCountdown(product.offerEndsAt || '');
    if (countdown) return countdown;
    return product.offerLabel || 'Limited time offer';
  }

  function getDisplayPrice(product) {
    const regularPrice = Number(product.price || 0);
    const hasOffer = Boolean(product.offerEnabled) && Number.isFinite(Number(product.finalPrice)) && Number(product.finalPrice) < regularPrice;
    const finalPrice = hasOffer ? Number(product.finalPrice) : regularPrice;
    const discountPercent = hasOffer && regularPrice > 0
      ? (Number(product.discountPercent) || Math.round(((regularPrice - finalPrice) / regularPrice) * 100))
      : 0;

    return {
      regularPrice,
      finalPrice,
      hasOffer,
      discountPercent
    };
  }

  function renderPriceBlock(product, className = 'product-price') {
    const pricing = getDisplayPrice(product);
    if (!pricing.hasOffer) {
      return `<div class="${className}">₹${pricing.finalPrice}</div>`;
    }

    return `
      <div class="${className} price-stack">
        <span class="offer-price">₹${pricing.finalPrice}</span>
        <span class="old-price">₹${pricing.regularPrice}</span>
        <span class="discount-chip">${pricing.discountPercent}% OFF</span>
      </div>
    `;
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
    let filtered = state.allProducts.filter(product => product.isActive !== false);

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
          return getDisplayPrice(a).finalPrice - getDisplayPrice(b).finalPrice;
        case 'price-high':
          return getDisplayPrice(b).finalPrice - getDisplayPrice(a).finalPrice;
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
      const offerLabel = product.offerEnabled
        ? `<div class="product-offer-note">${getOfferLabel(product)}</div>`
        : '';
      const imageSrc = (product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/400x300?text=Tanipihu';
      
      return `
        <div class="product-card">
          ${badgeHtml}
          <img src="${imageSrc}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/400x300?text=Tanipihu'">
          <div class="product-info">
            <div class="product-category">${product.category.replace(/-/g, ' ')}</div>
            <h3 class="product-title">${product.name}</h3>
            ${renderPriceBlock(product)}
            ${offerLabel}
            <p class="product-desc">${product.shortDescription || product.description.substring(0, 60) + '...'}</p>
            <label class="qty-field">
              Qty
              <input type="number" data-role="qty-input" min="${product.minOrderQty}" value="${product.minOrderQty}">
            </label>
            <div class="order-meta-grid">
              <label class="qty-field">
                Need Date
                <input type="date" data-role="delivery-date-input">
              </label>
              <label class="qty-field">
                Need Time
                <input type="time" data-role="delivery-time-input">
              </label>
            </div>
            <label class="qty-field">
              Note (optional)
              <input type="text" data-role="delivery-note-input" placeholder="Name, custom text, special request">
            </label>
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
    const qty = Number(document.getElementById('ai-qty')?.value || 1);

    return {
      occasion: document.getElementById('ai-occasion')?.value || 'any',
      budget: document.getElementById('ai-budget')?.value || 'any',
      recipient: document.getElementById('ai-recipient')?.value || 'any',
      vibe: document.getElementById('ai-vibe')?.value || 'any',
      age: Number(document.getElementById('ai-age')?.value || 0),
      theme: (document.getElementById('ai-theme')?.value || '').trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
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
    const whatsappText = composePackageWhatsAppText(result, picks);

    aiPackageResult.innerHTML = `
      <article class="package-card">
        <h3>${result.title || 'Complete Gift Package'}</h3>
        <p>${result.summary || ''}</p>

        <div class="package-grid">
          ${picks.map(product => {
            const pricing = getDisplayPrice(product);
            const strike = pricing.hasOffer ? ` <span class="old-price">₹${pricing.regularPrice}</span>` : '';
            return `<div class="package-item"><strong>${product.name}</strong><br>₹${pricing.finalPrice}${strike}</div>`;
          }).join('')}
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
      const budgetPrice = getDisplayPrice(product).finalPrice;
      if (criteria.budget === 'under-150' && budgetPrice <= 150) score += 3;
      if (criteria.budget === '150-400' && budgetPrice > 150 && budgetPrice <= 400) score += 3;
      if (criteria.budget === '400-800' && budgetPrice > 400 && budgetPrice <= 800) score += 3;
      if (criteria.budget === '800-plus' && budgetPrice > 800) score += 3;
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
      const offerLabel = product.offerEnabled
        ? `<p class="product-offer-note">${getOfferLabel(product)}</p>`
        : '';

      return `
        <article class="ai-card">
          <img src="${image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/400x300?text=Tanipihu'">
          <div class="ai-card-body">
            <h4>${product.name}</h4>
            ${renderPriceBlock(product, 'price')}
            ${offerLabel}
            <p>${product.shortDescription || product.description.substring(0, 72) + '...'}</p>
            <label class="qty-field">
              Qty
              <input type="number" data-role="qty-input" min="${product.minOrderQty}" value="${product.minOrderQty}">
            </label>
            <div class="order-meta-grid">
              <label class="qty-field">
                Need Date
                <input type="date" data-role="delivery-date-input">
              </label>
              <label class="qty-field">
                Need Time
                <input type="time" data-role="delivery-time-input">
              </label>
            </div>
            <label class="qty-field">
              Note (optional)
              <input type="text" data-role="delivery-note-input" placeholder="Any customization request">
            </label>
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
          ${renderPriceBlock(product, 'modal-price')}
          ${product.offerEnabled ? `<p class="product-offer-note">${getOfferLabel(product)}</p>` : ''}
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

          <div class="modal-order-details">
            <div class="order-meta-grid">
              <label class="qty-field">
                Need Date
                <input type="date" data-role="delivery-date-input">
              </label>
              <label class="qty-field">
                Need Time
                <input type="time" data-role="delivery-time-input">
              </label>
            </div>
            <label class="qty-field">
              Note (optional)
              <input type="text" data-role="delivery-note-input" placeholder="Name print, message card text, color preference...">
            </label>
          </div>

          <div class="modal-actions">
            <label class="qty-field">
              Qty
              <input type="number" data-role="modal-qty-input" min="${product.minOrderQty}" value="${product.minOrderQty}">
            </label>
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

  function getValidQuantity(rawQty, minOrderQty) {
    const minQty = Number(minOrderQty || 1);
    const parsed = Number(rawQty || minQty);
    if (!Number.isFinite(parsed) || parsed < minQty) {
      return minQty;
    }
    return Math.floor(parsed);
  }

  function getAbsoluteImageUrl(product) {
    const image = (product.images && product.images[0]) || '';
    if (!image) return 'Not available';
    if (/^https?:\/\//i.test(image)) return image;
    const normalized = image.startsWith('/') ? image : `/${image}`;
    return `${window.location.origin}${normalized}`;
  }

  function getOrderMeta(container) {
    if (!container) {
      return {
        preferredDate: '',
        preferredTime: '',
        note: ''
      };
    }

    return {
      preferredDate: container.querySelector('[data-role="delivery-date-input"]')?.value || '',
      preferredTime: container.querySelector('[data-role="delivery-time-input"]')?.value || '',
      note: (container.querySelector('[data-role="delivery-note-input"]')?.value || '').trim()
    };
  }

  function formatDateForMessage(value) {
    if (!value) return 'Not specified';
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    return value;
  }

  function composeWhatsAppMessage(product, quantity, source, orderMeta = {}) {
    const pricing = getDisplayPrice(product);
    const unitPrice = pricing.finalPrice;
    const total = unitPrice * quantity;
    const bannerOffer = getBannerOfferForOrder(total);
    const preferredDate = formatDateForMessage(orderMeta.preferredDate || '');
    const preferredTime = orderMeta.preferredTime || 'Not specified';
    const customerNote = orderMeta.note || 'No additional note';

    const lines = [
      `Hi, I want to order this product from ${source}.`,
      '',
      `Product: ${product.name}`,
      `Regular Price: Rs ${pricing.regularPrice}`,
      `Offer Price: ${pricing.hasOffer ? `Rs ${pricing.finalPrice}` : 'Not active'}`,
      `Discount: ${pricing.hasOffer ? `${pricing.discountPercent}%` : '0%'}`,
      `Offer Status: ${pricing.hasOffer ? getOfferLabel(product) : 'No active offer'}`,
      `Final Unit Price: Rs ${unitPrice}`,
      `Quantity: ${quantity}`,
      `Total: Rs ${total}`,
      `Category: ${product.category}`,
      `Type: ${product.type}`,
      `Occasion: ${product.occasion}`,
      `Personalization: ${product.personalizationAvailable ? 'Yes' : 'No'}`,
      `Lead Time: ${product.leadTimeDays} day(s)` ,
      `Min Order Qty: ${product.minOrderQty}`,
      `Preferred Delivery Date: ${preferredDate}`,
      `Preferred Delivery Time: ${preferredTime}`,
      `Image: ${getAbsoluteImageUrl(product)}`,
      `Coupon Code: ${bannerOffer ? bannerOffer.code : 'No code'}`,
      `Coupon Offer: ${bannerOffer ? bannerOffer.discountText : 'No global offer'}`,
      `Coupon Eligibility: ${bannerOffer ? (bannerOffer.isEligible ? 'Eligible' : 'Not eligible') : 'N/A'}`,
      `Coupon Min Order: ${bannerOffer ? `Rs ${bannerOffer.minOrder}` : 'N/A'}`,
      '',
      `Customer Note: ${customerNote}`,
      `Notes: ${product.whatsappMessage || `Please confirm availability for ${product.name}.`}`
    ];

    return encodeURIComponent(lines.join('\n'));
  }

  function composePackageWhatsAppText(result, picks) {
    const subtotal = picks.reduce((sum, product) => sum + getDisplayPrice(product).finalPrice, 0);
    const quantity = getAICriteria().quantity;
    const estimatedTotal = subtotal * quantity;
    const bannerOffer = getBannerOfferForOrder(estimatedTotal);

    const lines = [
      'Hi, I want to finalize this complete gift package.',
      '',
      `Package: ${result.title || 'Complete Gift Package'}`,
      `Summary: ${result.summary || ''}`,
      `Quantity: ${quantity}`,
      '',
      'Selected Products:'
    ];

    picks.forEach((product, index) => {
      const image = getAbsoluteImageUrl(product);
      const pricing = getDisplayPrice(product);
      lines.push(`${index + 1}. ${product.name} | Final: Rs ${pricing.finalPrice} | MRP: Rs ${pricing.regularPrice} | ${product.category}`);
      if (pricing.hasOffer) {
        lines.push(`   Offer: ${pricing.discountPercent}% OFF`);
      }
      lines.push(`   Image: ${image}`);
    });

    if (Array.isArray(result.assets) && result.assets.length > 0) {
      lines.push('');
      lines.push('Requested Add-ons:');
      result.assets.forEach((asset, index) => lines.push(`${index + 1}. ${asset}`));
    }

    lines.push('');
    lines.push(`Estimated Package Total (before final custom quote): Rs ${estimatedTotal}`);
    lines.push(`Coupon Code: ${bannerOffer ? bannerOffer.code : 'No code'}`);
    lines.push(`Coupon Offer: ${bannerOffer ? bannerOffer.discountText : 'No global offer'}`);
    lines.push(`Coupon Eligibility: ${bannerOffer ? (bannerOffer.isEligible ? 'Eligible' : 'Not eligible') : 'N/A'}`);

    return encodeURIComponent(lines.join('\n'));
  }

  // Global buy function
  function buyProduct(message) {
    const whatsappNumber = '919726571954';
    const url = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(url, '_blank');
  }

  window.buyProduct = buyProduct;
});
