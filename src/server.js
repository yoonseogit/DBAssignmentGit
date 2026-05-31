require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const path = require('path');
const { pool, transaction } = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const sessions = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .filter(Boolean)
      .map((cookie) => {
        const [key, ...value] = cookie.trim().split('=');
        return [key, decodeURIComponent(value.join('='))];
      })
  );
}

function setSession(res, user) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, user.id);
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Path=/; SameSite=Lax`);
}

async function getCurrentUser(req) {
  const sid = parseCookies(req).sid;
  const userId = sessions.get(sid);

  if (!userId) {
    return null;
  }

  const { rows } = await pool.query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [userId]
  );
  return rows[0] || null;
}

async function requireLogin(req, res, next) {
  try {
    const user = await getCurrentUser(req);

    if (!user) {
      res.status(401).json({ message: '로그인이 필요합니다.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ message: '관리자만 사용할 수 있습니다.' });
    return;
  }

  next();
}

app.get('/api/auth/me', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: '이름, 이메일, 비밀번호를 모두 입력하세요.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: '비밀번호는 6자 이상이어야 합니다.' });
      return;
    }

    const user = await transaction(async (client) => {
      const createdUser = await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'USER')
         RETURNING id, name, email, role`,
        [name, email, hashPassword(password)]
      );

      await client.query(
        'INSERT INTO carts (user_id) VALUES ($1)',
        [createdUser.rows[0].id]
      );

      return createdUser.rows[0];
    });

    setSession(res, user);
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ message: '이미 가입된 이메일입니다.' });
      return;
    }
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE email = $1 AND password_hash = $2`,
      [email, hashPassword(password)]
    );

    if (!rows[0]) {
      res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    setSession(res, rows[0]);
    res.json({ user: rows[0] });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', (req, res) => {
  const sid = parseCookies(req).sid;
  sessions.delete(sid);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  res.status(204).end();
});

app.get('/api/products', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, price, stock, status
       FROM products
       ORDER BY id`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, price, stock } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO products (name, description, price, stock)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, price, stock, status`,
      [name, description, price, stock]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:id', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, price, stock, status } = req.body;
    const { rows } = await pool.query(
      `UPDATE products
       SET name = $1,
           description = $2,
           price = $3,
           stock = $4,
           status = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, name, description, price, stock, status`,
      [name, description, price, stock, status, req.params.id]
    );

    if (!rows[0]) {
      res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:id', requireLogin, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE products
       SET status = 'STOPPED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    );

    if (!rows[0]) {
      res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
      return;
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/cart', requireLogin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ci.id, p.id AS product_id, p.name, p.price, p.stock, ci.quantity,
              p.price * ci.quantity AS line_total
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN products p ON p.id = ci.product_id
       WHERE c.user_id = $1
       ORDER BY ci.id`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/cart/items', requireLogin, async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       SELECT c.id, $2, $3
       FROM carts c
       WHERE c.user_id = $1
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
       RETURNING id`,
      [req.user.id, productId, quantity]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/cart/items/:id', requireLogin, async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM cart_items
       WHERE id = $1
         AND cart_id = (SELECT id FROM carts WHERE user_id = $2)`,
      [req.params.id, req.user.id]
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', requireLogin, async (req, res, next) => {
  try {
    const order = await transaction(async (client) => {
      const cartItems = await client.query(
        `SELECT ci.id, ci.product_id, ci.quantity, p.price, p.stock, p.name
         FROM carts c
         JOIN cart_items ci ON ci.cart_id = c.id
         JOIN products p ON p.id = ci.product_id
         WHERE c.user_id = $1
         ORDER BY ci.id
         FOR UPDATE OF p`,
        [req.user.id]
      );

      if (cartItems.rows.length === 0) {
        throw new Error('장바구니가 비어 있습니다.');
      }

      for (const item of cartItems.rows) {
        if (item.stock < item.quantity) {
          throw new Error(`${item.name} 재고가 부족합니다.`);
        }
      }

      const totalPrice = cartItems.rows.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const createdOrder = await client.query(
        `INSERT INTO orders (user_id, total_price, status)
         VALUES ($1, $2, 'PAID')
         RETURNING id, user_id, total_price, status, created_at`,
        [req.user.id, totalPrice]
      );

      for (const item of cartItems.rows) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [createdOrder.rows[0].id, item.product_id, item.quantity, item.price]
        );

        await client.query(
          `UPDATE products
           SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      await client.query(
        `DELETE FROM cart_items
         WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1)`,
        [req.user.id]
      );

      return createdOrder.rows[0];
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders', requireLogin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.total_price, o.status, o.created_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'productName', p.name,
                    'quantity', oi.quantity,
                    'price', oi.price
                  )
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(400).json({ message: error.message || '요청을 처리할 수 없습니다.' });
});

app.listen(port, () => {
  console.log(`Purchase site running at http://localhost:${port}`);
});
