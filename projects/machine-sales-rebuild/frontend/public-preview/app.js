const CONFIG = {
  productsJsonUrl: new URL("../../data/output/products.public.with-images.json", window.location.href).href,
  baseImageUrl: new URL("../../data/derived-images/", window.location.href).href,
};

const state = {
  products: [],
  selectedCode: null,
  selectedImageIndexByCode: new Map(),
};

const metaEl = document.getElementById("meta");
const gridEl = document.getElementById("product-grid");
const detailPanelEl = document.getElementById("detail-panel");
const cardTemplate = document.getElementById("product-card-template");
const detailTemplate = document.getElementById("detail-template");

function resolveImageUrl(relativePath) {
  return new URL(relativePath, CONFIG.baseImageUrl).href;
}

function isPlaceholder(product) {
  return product.imageStatus === "placeholder" || product.hasRealImage === false;
}

function hasReadyImage(product) {
  return product.imageStatus === "ready" && product.hasRealImage === true && product.displayUrl;
}

async function loadProducts() {
  const response = await fetch(CONFIG.productsJsonUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`products.json の取得に失敗しました: ${response.status}`);
  }
  const payload = await response.json();
  state.products = payload.products || [];
  state.selectedCode = state.products[0]?.sdProductCode ?? null;
  updateMeta();
  renderGrid();
  renderDetail();
}

function updateMeta() {
  const readyCount = state.products.filter((product) => product.imageStatus === "ready").length;
  const placeholderCount = state.products.filter((product) => product.imageStatus === "placeholder").length;
  metaEl.innerHTML = [
    `<div>商品件数: ${state.products.length}</div>`,
    `<div>通常商品: ${readyCount}</div>`,
    `<div>placeholder: ${placeholderCount}</div>`,
    `<div>baseImageUrl: <code>${CONFIG.baseImageUrl}</code></div>`,
  ].join("");
}

function renderGrid() {
  gridEl.innerHTML = "";
  for (const product of state.products) {
    const fragment = cardTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".product-card");
    const image = fragment.querySelector(".product-image");
    const placeholderMessage = fragment.querySelector(".placeholder-message");
    const code = fragment.querySelector(".product-code");
    const name = fragment.querySelector(".product-name");
    const tags = fragment.querySelector(".product-tags");

    button.classList.toggle("is-active", product.sdProductCode === state.selectedCode);
    button.addEventListener("click", () => {
      state.selectedCode = product.sdProductCode;
      renderGrid();
      renderDetail();
    });

    code.textContent = product.sdProductCode;
    name.textContent = product.name;
    tags.textContent = isPlaceholder(product)
      ? "placeholder / 画像準備中"
      : `${product.imageStatus} / gallery ${product.galleryUrls.length}枚`;

    if (hasReadyImage(product)) {
      image.src = resolveImageUrl(product.displayUrl);
      image.alt = `${product.name} primary`;
      image.hidden = false;
      placeholderMessage.hidden = true;
    } else {
      image.hidden = true;
      placeholderMessage.hidden = false;
    }

    gridEl.appendChild(fragment);
  }
}

function renderDetail() {
  const product = state.products.find((item) => item.sdProductCode === state.selectedCode);
  if (!product) {
    detailPanelEl.innerHTML = '<div class="detail-card">商品が見つかりません。</div>';
    return;
  }

  const fragment = detailTemplate.content.cloneNode(true);
  const image = fragment.querySelector(".detail-image");
  const placeholderMessage = fragment.querySelector(".detail-placeholder");
  const code = fragment.querySelector(".detail-code");
  const name = fragment.querySelector(".detail-name");
  const status = fragment.querySelector(".detail-status");
  const galleryStrip = fragment.querySelector(".gallery-strip");

  code.textContent = product.sdProductCode;
  name.textContent = product.name;

  if (isPlaceholder(product)) {
    status.textContent = "imageStatus=placeholder / hasRealImage=false";
    image.hidden = true;
    placeholderMessage.hidden = false;
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.textContent = "この商品は画像準備中です。通常の gallery は表示しません。";
    galleryStrip.replaceWith(empty);
  } else {
    const selectedIndex = state.selectedImageIndexByCode.get(product.sdProductCode) ?? 0;
    const safeIndex = Math.min(selectedIndex, product.galleryUrls.length - 1);
    const mainUrl = product.galleryUrls[safeIndex] || product.displayUrl;

    image.src = resolveImageUrl(mainUrl);
    image.alt = `${product.name} detail`;
    image.hidden = false;
    placeholderMessage.hidden = true;
    status.textContent = `imageStatus=${product.imageStatus} / gallery ${product.galleryUrls.length}枚`;

    product.galleryUrls.forEach((url, index) => {
      const button = document.createElement("button");
      button.className = "gallery-thumb";
      if (index === safeIndex) {
        button.classList.add("is-active");
      }
      button.type = "button";
      button.addEventListener("click", () => {
        state.selectedImageIndexByCode.set(product.sdProductCode, index);
        renderDetail();
      });

      const thumb = document.createElement("img");
      thumb.src = resolveImageUrl(url);
      thumb.alt = `${product.name} ${index + 1}`;
      button.appendChild(thumb);
      galleryStrip.appendChild(button);
    });
  }

  detailPanelEl.innerHTML = "";
  detailPanelEl.appendChild(fragment);
}

loadProducts().catch((error) => {
  detailPanelEl.innerHTML = `<div class="detail-card">読み込みエラー: ${error.message}</div>`;
});
