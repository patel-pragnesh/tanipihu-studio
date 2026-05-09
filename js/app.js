document.addEventListener('DOMContentLoaded', () => {
  const productGrid = document.getElementById('product-grid');
  const filterBtns = document.querySelectorAll('.filter-btn');
  let allProducts = [];

  // Fetch products
  fetch('data/products.json')
    .then(response => response.json())
    .then(data => {
      allProducts = data;
      renderProducts(allProducts);
    })
    .catch(error => {
      console.error('Error loading products:', error);
      productGrid.innerHTML = '<p>Sorry, we could not load the products at this time.</p>';
    });

  // Filter functionality
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active class
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');
      
      if (filterValue === 'all') {
        renderProducts(allProducts);
      } else {
        const filteredProducts = allProducts.filter(p => p.category === filterValue);
        renderProducts(filteredProducts);
      }
    });
  });

  // Render products function
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
            <div class="product-category">${product.category.replace('-', ' ')}</div>
            <h3 class="product-title">${product.name}</h3>
            <div class="product-price">₹${product.price}</div>
            <p class="product-desc">${product.shortDescription || product.description.substring(0, 60) + '...'}</p>
            <button class="btn-buy" onclick="buyProduct('${encodeURIComponent(product.whatsappMessage || `Hi, I want to order ${product.name}.`)}')">
              Order via WhatsApp
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Global buy function
  window.buyProduct = function(message) {
    const whatsappNumber = '919000000000'; // Replace with real number
    const url = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(url, '_blank');
  };
});
