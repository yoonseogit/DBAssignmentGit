const productsEl = document.querySelector('#products');
const cartEl = document.querySelector('#cart');
const ordersEl = document.querySelector('#orders');
const cartTotalEl = document.querySelector('#cartTotal');
const checkoutButton = document.querySelector('#checkoutButton');
const productForm = document.querySelector('#productForm');
const loginForm = document.querySelector('#loginForm');
const signupForm = document.querySelector('#signupForm');
const authPanel = document.querySelector('#authPanel');
const adminPanel = document.querySelector('#adminPanel');
const logoutButton = document.querySelector('#logoutButton');
const currentUserEl = document.querySelector('#currentUser');
const roleLabel = document.querySelector('#roleLabel');
const toast = document.querySelector('#toast');

let currentUser = null;

function money(value) {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 1800);
}

async function request(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '오류가 발생했습니다.' }));
    throw new Error(error.message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function renderAuth() {
  const loggedIn = Boolean(currentUser);
  authPanel.hidden = loggedIn;
  logoutButton.hidden = !loggedIn;
  checkoutButton.disabled = !loggedIn;
  adminPanel.hidden = !loggedIn || currentUser.role !== 'ADMIN';
  roleLabel.textContent = loggedIn ? currentUser.role : 'GUEST';
  currentUserEl.textContent = loggedIn
    ? `${currentUser.name} (${currentUser.email})`
    : '로그인이 필요합니다.';
}

async function loadMe() {
  const data = await request('/api/auth/me');
  currentUser = data.user;
  renderAuth();
}

async function loadProducts() {
  const products = await request('/api/products');
  productsEl.innerHTML = products
    .map(
      (product) => `
        <article class="product">
          <h3>${product.name}</h3>
          <p>${product.description || ''}</p>
          <div class="meta">
            <strong>${money(product.price)}</strong>
            <span>재고 ${product.stock}</span>
          </div>
          <button type="button" data-add="${product.id}" ${!currentUser || product.status !== 'ON_SALE' ? 'disabled' : ''}>
            장바구니 담기
          </button>
        </article>
      `
    )
    .join('');
}

async function loadCart() {
  if (!currentUser) {
    cartEl.innerHTML = '<p>로그인하면 장바구니를 사용할 수 있습니다.</p>';
    cartTotalEl.textContent = money(0);
    return;
  }

  const items = await request('/api/cart');
  const total = items.reduce((sum, item) => sum + Number(item.line_total), 0);

  cartEl.innerHTML =
    items.length === 0
      ? '<p>장바구니가 비어 있습니다.</p>'
      : items
          .map(
            (item) => `
              <div class="list-item">
                <strong>${item.name}</strong>
                <span>${item.quantity}개 · ${money(item.line_total)}</span>
                <button class="secondary" type="button" data-remove="${item.id}">삭제</button>
              </div>
            `
          )
          .join('');

  cartTotalEl.textContent = money(total);
}

async function loadOrders() {
  if (!currentUser) {
    ordersEl.innerHTML = '<p>로그인하면 주문 내역을 볼 수 있습니다.</p>';
    return;
  }

  const orders = await request('/api/orders');
  ordersEl.innerHTML =
    orders.length === 0
      ? '<p>주문 내역이 없습니다.</p>'
      : orders
          .map(
            (order) => `
              <div class="list-item">
                <strong>주문 #${order.id} · ${order.status}</strong>
                <span>${money(order.total_price)}</span>
                <small>${order.items
                  .map((item) => `${item.productName} ${item.quantity}개`)
                  .join(', ')}</small>
              </div>
            `
          )
          .join('');
}

async function refresh() {
  await loadMe();
  await Promise.all([loadProducts(), loadCart(), loadOrders()]);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);

  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password')
      })
    });
    currentUser = data.user;
    await refresh();
    showToast('로그인했습니다.');
  } catch (error) {
    showToast(error.message);
  }
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(signupForm);

  try {
    const data = await request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password')
      })
    });
    currentUser = data.user;
    signupForm.reset();
    await refresh();
    showToast('회원가입이 완료되었습니다.');
  } catch (error) {
    showToast(error.message);
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await request('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    await refresh();
    showToast('로그아웃했습니다.');
  } catch (error) {
    showToast(error.message);
  }
});

productsEl.addEventListener('click', async (event) => {
  const productId = event.target.dataset.add;
  if (!productId) {
    return;
  }

  try {
    await request('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity: 1 })
    });
    await loadCart();
    showToast('장바구니에 담았습니다.');
  } catch (error) {
    showToast(error.message);
  }
});

cartEl.addEventListener('click', async (event) => {
  const itemId = event.target.dataset.remove;
  if (!itemId) {
    return;
  }

  try {
    await request(`/api/cart/items/${itemId}`, { method: 'DELETE' });
    await loadCart();
  } catch (error) {
    showToast(error.message);
  }
});

checkoutButton.addEventListener('click', async () => {
  try {
    await request('/api/orders', { method: 'POST' });
    await refresh();
    showToast('주문이 완료되었습니다.');
  } catch (error) {
    showToast(error.message);
  }
});

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(productForm);

  try {
    await request('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        description: form.get('description'),
        price: Number(form.get('price')),
        stock: Number(form.get('stock'))
      })
    });
    productForm.reset();
    await loadProducts();
    showToast('상품이 등록되었습니다.');
  } catch (error) {
    showToast(error.message);
  }
});

refresh().catch((error) => showToast(error.message));
