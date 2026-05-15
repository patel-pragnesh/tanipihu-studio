document.addEventListener('DOMContentLoaded', () => {
  const contact = {
    businessName: 'Tani Pihu Treasure',
    whatsappNumber: '919726571954',
    instagramUrl: 'https://www.instagram.com/tanipihutreasures',
    whatsappMessage: 'Hi, I would like to know more about your hampers and return gifts.'
  };

  const whatsappUrl = `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(contact.whatsappMessage)}`;
  const instagramUrl = contact.instagramUrl;
  const pageUrl = window.location.href;
  const qrBaseUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=';

  setHref(['whatsapp-link', 'whatsapp-display-link', 'whatsapp-cta', 'dock-whatsapp'], whatsappUrl);
  setHref(['instagram-link', 'instagram-display-link', 'instagram-cta', 'dock-instagram'], instagramUrl);
  setHref(['digital-card-cta'], pageUrl);
  renderQrCode('whatsapp-qr', whatsappUrl, '#16a34a');
  renderQrCode('instagram-qr', instagramUrl, '#d62976');
  renderQrCode('digital-card-qr', pageUrl, '#23433d');

  const shareCardBtn = document.getElementById('share-card-btn');
  if (shareCardBtn) {
    shareCardBtn.addEventListener('click', async () => {
      const shareData = {
        title: 'Tani Pihu Treasure',
        text: 'Save this digital card for WhatsApp orders and Instagram updates.',
        url: pageUrl
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          updateButtonLabel(shareCardBtn, 'Shared');
          return;
        } catch {
          // Fall through to clipboard copy when the share sheet is dismissed or unavailable.
        }
      }

      try {
        await navigator.clipboard.writeText(pageUrl);
        updateButtonLabel(shareCardBtn, 'Link Copied');
      } catch {
        updateButtonLabel(shareCardBtn, 'Copy Failed');
      }
    });
  }

  function setHref(ids, url) {
    ids.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.href = url;
      }
    });
  }

  function renderQrCode(id, url, color) {
    const element = document.getElementById(id);
    if (!element) return;

    element.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
      new QRCode(element, {
        text: url,
        width: 250,
        height: 250,
        colorDark: color,
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      return;
    }

    const image = document.createElement('img');
    image.src = `${qrBaseUrl}${encodeURIComponent(url)}`;
    image.alt = 'QR code';
    element.appendChild(image);
  }

  function updateButtonLabel(button, label) {
    const originalLabel = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = originalLabel;
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1800);
  }
});
