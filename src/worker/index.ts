import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getCookie, setCookie } from "hono/cookie";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import {
  CreateProductSchema,
  UpdateProfileSchema,
  CreateTransactionSchema,
} from "@/shared/types";

const app = new Hono<{ Bindings: Env }>();

// Enhanced auto-create tables with better error handling
async function ensureTablesExist(db: any) {
  try {
// Simple check to see if we can access the database
await db.prepare("SELECT 1").first();

// Check if main table exists
const tableCheck = await db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='user_profiles'"
).first();

if (!tableCheck) {
  console.log("Creating database tables...");
  
  // Create tables one by one with better error handling
  const statements = [
    `CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      location TEXT,
      bio TEXT,
      profile_image_url TEXT,
      is_seller BOOLEAN DEFAULT 0,
      is_buyer BOOLEAN DEFAULT 1,
      rating_avg REAL DEFAULT 0.0,
      rating_count INTEGER DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      total_purchases INTEGER DEFAULT 0,
      whatsapp_number TEXT,
      business_name TEXT,
      business_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      hair_type TEXT,
      hair_color TEXT,
      hair_length INTEGER,
      weight_grams INTEGER,
      price_cents INTEGER NOT NULL,
      is_available BOOLEAN DEFAULT 1,
      main_image_url TEXT,
      hair_origin TEXT,
      hair_texture TEXT,
      like_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      notes TEXT,
      escrow_released BOOLEAN DEFAULT 0,
      delivery_confirmed_at DATETIME,
      admin_released_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      reviewer_id TEXT NOT NULL,
      reviewed_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      review_type TEXT NOT NULL,
      is_featured BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id TEXT NOT NULL,
      message TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      image_url TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS product_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, user_id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS uploaded_images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      data_url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS profile_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reviewer_id TEXT NOT NULL,
      reviewed_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      is_visible BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS review_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL,
      review_type TEXT NOT NULL CHECK (review_type IN ('transaction', 'profile')),
      responder_id TEXT NOT NULL,
      response_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT 'admin',
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK (action_type IN ('block', 'unblock', 'warn', 'review', 'note')),
      reason TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS blocked_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      blocked_by TEXT NOT NULL,
      reason TEXT,
      blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    )`,
    
    `CREATE TABLE IF NOT EXISTS featured_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      seller_id TEXT NOT NULL,
      featured_type TEXT NOT NULL,
      price_paid_cents INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS transaction_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      updated_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      sender_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS support_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT DEFAULT 'support',
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      category TEXT DEFAULT 'general' CHECK (category IN ('technical', 'transaction', 'account', 'product', 'general')),
      assigned_to TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS support_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      responder_id TEXT NOT NULL,
      responder_name TEXT NOT NULL,
      message TEXT NOT NULL,
      is_internal BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  
  // Execute each statement individually
  for (const statement of statements) {
    try {
      await db.prepare(statement).run();
    } catch (err) {
      console.error(`Error creating table with statement: ${statement.substring(0, 50)}...`, err);
    }
  }
  
  // Add sample data safely
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO user_profiles (user_id, name, is_seller, business_name) 
      VALUES ('demo_seller_1', 'Salão Beauty Pro', 1, 'Beauty Pro Studio')
    `).run();
    
    await db.prepare(`
      INSERT OR IGNORE INTO user_profiles (user_id, name, is_seller, business_name) 
      VALUES ('demo_seller_2', 'Mega Hair Premium', 1, 'Premium Hair Solutions')
    `).run();
    
    await db.prepare(`
      INSERT OR IGNORE INTO products (seller_id, title, description, hair_type, hair_color, price_cents, main_image_url) 
      VALUES ('demo_seller_1', 'Mega Hair Liso Premium 60cm', 'Mega hair 100% natural, liso sedoso, 60cm de comprimento', 'liso', 'castanho', 35000, 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&h=400&fit=crop')
    `).run();
    
    await db.prepare(`
      INSERT OR IGNORE INTO products (seller_id, title, description, hair_type, hair_color, price_cents, main_image_url) 
      VALUES ('demo_seller_2', 'Mega Hair Cacheado Natural 50cm', 'Cabelo cacheado natural, textura 3B, perfeito para volume', 'cacheado', 'preto', 42000, 'https://images.unsplash.com/photo-1594736797933-d0280ba600ba?w=400&h=400&fit=crop')
    `).run();
    
    // Add default support staff
    await db.prepare(`
      INSERT OR IGNORE INTO support_staff (username, password_hash, name, email, role) 
      VALUES ('suporte', 'suporte123', 'Equipe Suporte', 'suporte@cabelostrade.com', 'support')
    `).run();
    
    await db.prepare(`
      INSERT OR IGNORE INTO support_staff (username, password_hash, name, email, role) 
      VALUES ('atendimento', 'atende123', 'Atendimento CabelosTrade', 'atendimento@cabelostrade.com', 'support')
    `).run();
    
    console.log("Sample data added successfully!");
    
  } catch (sampleError) {
    console.error("Error adding sample data (non-critical):", sampleError);
  }
  
  console.log("Database tables created successfully!");
}
  } catch (error) {
console.error("Error in ensureTablesExist:", error);
// Don't throw - let the app continue even if table creation fails
  }
}

// Simplified middleware with better error handling
app.use('*', async (c, next) => {
  try {
if (c.env.DB) {
  await ensureTablesExist(c.env.DB);
}
  } catch (error) {
console.error("Database setup error:", error);
// Continue anyway - some endpoints might still work
  }
  await next();
});

// Add CORS headers for better compatibility
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

// Health check endpoint
app.get('/api/health', async (c) => {
  try {
// Test database connection
if (c.env.DB) {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: 'healthy', database: 'connected' });
} else {
  return c.json({ status: 'degraded', database: 'not_available' });
}
  } catch (error) {
const errorMessage = error instanceof Error ? error.message : 'Unknown error';
return c.json({ status: 'error', error: errorMessage }, 500);
  }
});

// Auth endpoints
app.get('/api/oauth/google/redirect_url', async (c) => {
  try {
const redirectUrl = await getOAuthRedirectUrl('google', {
  apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
  apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
});
return c.json({ redirectUrl }, 200);
  } catch (error) {
console.error('OAuth redirect error:', error);
return c.json({ error: 'OAuth configuration error' }, 500);
  }
});

app.post("/api/sessions", async (c) => {
  try {
const body = await c.req.json();

if (!body.code) {
  return c.json({ error: "No authorization code provided" }, 400);
}

const sessionToken = await exchangeCodeForSessionToken(body.code, {
  apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
  apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
});

setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
  httpOnly: true,
  path: "/",
  sameSite: "none",
  secure: true,
  maxAge: 60 * 24 * 60 * 60, // 60 days
});

return c.json({ success: true }, 200);
  } catch (error) {
console.error('Session creation error:', error);
return c.json({ error: 'Session creation failed' }, 500);
  }
});

app.get("/api/users/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

app.get('/api/logout', async (c) => {
  try {
const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

if (typeof sessionToken === 'string') {
  await deleteSession(sessionToken, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });
}

setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, '', {
  httpOnly: true,
  path: '/',
  sameSite: 'none',
  secure: true,
  maxAge: 0,
});

return c.json({ success: true }, 200);
  } catch (error) {
console.error('Logout error:', error);
return c.json({ error: 'Logout failed' }, 500);
  }
});

// Profile endpoints
app.get("/api/profile", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const profile = await c.env.DB.prepare(
  "SELECT * FROM user_profiles WHERE user_id = ?"
).bind(user.id).first();

if (!profile) {
  // Create default profile
  const newProfile = await c.env.DB.prepare(`
    INSERT INTO user_profiles (user_id, name, is_seller, is_buyer)
    VALUES (?, ?, 0, 1)
    RETURNING *
  `).bind(user.id, user.google_user_data.name || null).first();
  
  return c.json(newProfile);
}

return c.json(profile);
  } catch (error) {
console.error('Error fetching profile:', error);
return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

app.put("/api/profile", authMiddleware, zValidator('json', UpdateProfileSchema), async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);
const data = c.req.valid('json');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const updatedProfile = await c.env.DB.prepare(`
  UPDATE user_profiles 
  SET name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      location = COALESCE(?, location),
      bio = COALESCE(?, bio),
      whatsapp_number = COALESCE(?, whatsapp_number),
      business_name = COALESCE(?, business_name),
      business_type = COALESCE(?, business_type),
      is_seller = COALESCE(?, is_seller),
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = ?
  RETURNING *
`).bind(
  data.name || null,
  data.phone || null,
  data.location || null,
  data.bio || null,
  data.whatsapp_number || null,
  data.business_name || null,
  data.business_type || null,
  data.is_seller ?? null,
  user.id
).first();

return c.json(updatedProfile);
  } catch (error) {
console.error('Error updating profile:', error);
return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Products endpoints - Enhanced with error handling
app.get("/api/products", async (c) => {
  try {
const page = parseInt(c.req.query('page') || '1');
const limit = parseInt(c.req.query('limit') || '50');
const search = c.req.query('search') || '';
const hairType = c.req.query('hair_type') || '';
const hairColor = c.req.query('hair_color') || '';
const hairOrigin = c.req.query('hair_origin') || '';

const offset = (page - 1) * limit;

let query = `
  SELECT p.*, up.name as seller_name, up.rating_avg as seller_rating,
         fp.featured_type, fp.expires_at as featured_expires_at,
         CASE 
           WHEN fp.featured_type = 'premium' THEN 3
           WHEN fp.featured_type = 'standard' THEN 2
           WHEN fp.featured_type = 'highlight' THEN 1
           ELSE 0
         END as featured_priority,
         COALESCE(p.like_count, 0) as like_count
  FROM products p
  LEFT JOIN user_profiles up ON p.seller_id = up.user_id
  LEFT JOIN featured_products fp ON p.id = fp.product_id 
    AND fp.is_active = 1 
    AND fp.expires_at > datetime('now')
  WHERE p.is_available = 1
`;

const params: any[] = [];

if (search && search.trim() !== '') {
  query += ` AND (p.title LIKE ? OR p.description LIKE ?)`;
  params.push(`%${search}%`, `%${search}%`);
}

if (hairType && hairType.trim() !== '') {
  query += ` AND p.hair_type = ?`;
  params.push(hairType);
}

if (hairColor && hairColor.trim() !== '') {
  query += ` AND p.hair_color = ?`;
  params.push(hairColor);
}

if (hairOrigin && hairOrigin.trim() !== '') {
  query += ` AND p.hair_origin = ?`;
  params.push(hairOrigin);
}

query += ` ORDER BY featured_priority DESC, p.created_at DESC LIMIT ? OFFSET ?`;
params.push(limit, offset);

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(query).bind(...params).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching products:', error);
return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

app.get("/api/products/:id", async (c) => {
  try {
const id = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const product = await c.env.DB.prepare(`
  SELECT p.*, up.name as seller_name, up.rating_avg as seller_rating, up.rating_count
  FROM products p
  LEFT JOIN user_profiles up ON p.seller_id = up.user_id
  WHERE p.id = ?
`).bind(id).first();

if (!product) {
  return c.json({ error: "Product not found" }, 404);
}

const { results: images } = await c.env.DB.prepare(
  "SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order"
).bind(id).all();

// Check if product is still editable (30 minutes)
const createdAt = new Date(product.created_at as string);
const now = new Date();
const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
const canEdit = diffMinutes <= 30;

return c.json({ ...product, images: images || [], can_edit: canEdit });
  } catch (error) {
console.error('Error fetching product:', error);
return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

app.post("/api/products", authMiddleware, zValidator('json', CreateProductSchema), async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);
const data = c.req.valid('json');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Check if user is a seller
const profile = await c.env.DB.prepare(
  "SELECT is_seller FROM user_profiles WHERE user_id = ?"
).bind(user.id).first();

if (!profile?.is_seller) {
  return c.json({ error: "User must be a seller to create products" }, 403);
}

const product = await c.env.DB.prepare(`
  INSERT INTO products (seller_id, title, description, hair_type, hair_color, hair_length, weight_grams, hair_origin, hair_texture, price_cents, main_image_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  RETURNING *
`).bind(
  user.id,
  data.title,
  data.description || null,
  data.hair_type || null,
  data.hair_color || null,
  data.hair_length || null,
  data.weight_grams || null,
  data.hair_origin || null,
  data.hair_texture || null,
  data.price_cents,
  data.main_image_url || null
).first();

return c.json(product);
  } catch (error) {
console.error('Error creating product:', error);
return c.json({ error: 'Failed to create product' }, 500);
  }
});

// Add images to product
app.post("/api/products/images", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const body = await c.req.json();
const { product_id, image_url, display_order } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Check if user owns the product
const product = await c.env.DB.prepare(
  "SELECT seller_id FROM products WHERE id = ?"
).bind(product_id).first();

if (!product || product.seller_id !== user.id) {
  return c.json({ error: "Product not found or unauthorized" }, 403);
}

const productImage = await c.env.DB.prepare(`
  INSERT INTO product_images (product_id, image_url, display_order)
  VALUES (?, ?, ?)
  RETURNING *
`).bind(product_id, image_url, display_order || 0).first();

return c.json(productImage);
  } catch (error) {
console.error('Error adding product image:', error);
return c.json({ error: 'Failed to add product image' }, 500);
  }
});

// Edit product (user's own products)
app.put("/api/products/:id", authMiddleware, zValidator('json', CreateProductSchema), async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);
const id = c.req.param('id');
const data = c.req.valid('json');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Check if user owns the product
const existingProduct = await c.env.DB.prepare(
  "SELECT * FROM products WHERE id = ? AND seller_id = ?"
).bind(id, user.id).first();

if (!existingProduct) {
  return c.json({ error: "Product not found or unauthorized" }, 404);
}

// Check if product can still be edited (30 minutes)
const createdAt = new Date(existingProduct.created_at as string);
const now = new Date();
const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

if (diffMinutes > 30) {
  return c.json({ error: "Product can only be edited within 30 minutes of creation" }, 403);
}

const product = await c.env.DB.prepare(`
  UPDATE products 
  SET title = ?, description = ?, hair_type = ?, hair_color = ?, hair_length = ?, 
      weight_grams = ?, hair_origin = ?, hair_texture = ?, price_cents = ?, 
      main_image_url = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ? AND seller_id = ?
  RETURNING *
`).bind(
  data.title,
  data.description || null,
  data.hair_type || null,
  data.hair_color || null,
  data.hair_length || null,
  data.weight_grams || null,
  data.hair_origin || null,
  data.hair_texture || null,
  data.price_cents,
  data.main_image_url || null,
  id,
  user.id
).first();

return c.json(product);
  } catch (error) {
console.error('Error updating product:', error);
return c.json({ error: 'Failed to update product' }, 500);
  }
});

// Delete product (user's own products)
app.delete("/api/products/:id", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const productId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Check if user owns the product
const product = await c.env.DB.prepare(
  "SELECT * FROM products WHERE id = ? AND seller_id = ?"
).bind(productId, user.id).first();

if (!product) {
  return c.json({ error: "Product not found or unauthorized" }, 404);
}

// Delete related data first
await c.env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(productId).run();
await c.env.DB.prepare("DELETE FROM product_likes WHERE product_id = ?").bind(productId).run();
await c.env.DB.prepare("DELETE FROM featured_products WHERE product_id = ?").bind(productId).run();

// Delete the product
await c.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId).run();

return c.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
console.error('Error deleting product:', error);
return c.json({ error: 'Failed to delete product' }, 500);
  }
});

// Image upload endpoint - Enhanced with better error handling
app.post("/api/upload", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

let body;
let file;

try {
  body = await c.req.formData();
  file = body.get('file') as File;
} catch (formError) {
  console.error('Error parsing form data:', formError);
  return c.json({ error: 'Invalid form data. Please ensure you are uploading a file.' }, 400);
}

if (!file) {
  return c.json({ error: 'No file provided. Please select an image file to upload.' }, 400);
}

// Check if it's actually a file
if (!(file instanceof File)) {
  return c.json({ error: 'Invalid file object' }, 400);
}

// Check file size (max 5MB)
const maxSize = 5 * 1024 * 1024;
if (file.size > maxSize) {
  const sizeMB = (file.size / 1024 / 1024).toFixed(1);
  return c.json({ error: `Arquivo muito grande (${sizeMB}MB). Máximo permitido: 5MB.` }, 400);
}

// Check file type
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
if (!file.type || !allowedTypes.includes(file.type.toLowerCase())) {
  return c.json({ error: `Tipo de arquivo não suportado: ${file.type}. Use JPG, PNG, WEBP ou GIF.` }, 400);
}

// Convert file to base64 - Optimized for large files
let bytes;
let base64;
let dataUrl;

try {
  bytes = await file.arrayBuffer();
  
  // For large files, process in chunks to avoid stack overflow
  if (bytes.byteLength > 1024 * 1024) { // 1MB+
    const uint8Array = new Uint8Array(bytes);
    const chunkSize = 8192;
    let binaryString = '';
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    base64 = btoa(binaryString);
  } else {
    // For smaller files, use the original method
    base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  }
  
  dataUrl = `data:${file.type};base64,${base64}`;
} catch (conversionError) {
  console.error('Error converting file to base64:', conversionError);
  return c.json({ error: 'Erro ao processar a imagem. Tente novamente com uma imagem menor.' }, 500);
}

// Generate unique ID
const imageId = crypto.randomUUID();

// Save to database
try {
  await c.env.DB.prepare(`
    INSERT INTO uploaded_images (id, user_id, filename, content_type, data_url, file_size)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    imageId,
    user.id,
    file.name,
    file.type,
    dataUrl,
    file.size
  ).run();
} catch (dbError) {
  console.error('Database error saving image:', dbError);
  return c.json({ error: 'Erro ao salvar imagem no banco de dados.' }, 500);
}

console.log(`Image uploaded successfully: ${imageId}, size: ${file.size} bytes`);

// Return the data URL for immediate use
return c.json({ 
  url: dataUrl,
  id: imageId,
  filename: file.name,
  size: file.size,
  message: 'Imagem enviada com sucesso!'
});

  } catch (error) {
console.error('Unexpected error uploading image:', error);
return c.json({ error: 'Erro inesperado no upload da imagem. Tente novamente.' }, 500);
  }
});

// Get uploaded image by ID
app.get("/api/images/:id", async (c) => {
  try {
const id = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const image = await c.env.DB.prepare(
  "SELECT * FROM uploaded_images WHERE id = ?"
).bind(id).first();

if (!image) {
  return c.json({ error: "Image not found" }, 404);
}

// Return the data URL
return c.json({ url: image.data_url });

  } catch (error) {
console.error('Error fetching image:', error);
return c.json({ error: 'Failed to fetch image' }, 500);
  }
});

// Transactions endpoints
app.post("/api/transactions", authMiddleware, zValidator('json', CreateTransactionSchema), async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);
const data = c.req.valid('json');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const product = await c.env.DB.prepare(
  "SELECT * FROM products WHERE id = ? AND is_available = 1"
).bind(data.product_id).first();

if (!product) {
  return c.json({ error: "Product not found or not available" }, 404);
}

if (product.seller_id === user.id) {
  return c.json({ error: "Cannot buy your own product" }, 400);
}

const transaction = await c.env.DB.prepare(`
  INSERT INTO transactions (buyer_id, seller_id, product_id, amount_cents, notes)
  VALUES (?, ?, ?, ?, ?)
  RETURNING *
`).bind(
  user.id,
  product.seller_id,
  data.product_id,
  product.price_cents,
  data.notes || null
).first();

return c.json(transaction);
  } catch (error) {
console.error('Error creating transaction:', error);
return c.json({ error: 'Failed to create transaction' }, 500);
  }
});

app.get("/api/transactions", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT t.*, p.title as product_title, p.main_image_url,
         buyer.name as buyer_name, seller.name as seller_name
  FROM transactions t
  LEFT JOIN products p ON t.product_id = p.id
  LEFT JOIN user_profiles buyer ON t.buyer_id = buyer.user_id
  LEFT JOIN user_profiles seller ON t.seller_id = seller.user_id
  WHERE t.buyer_id = ? OR t.seller_id = ?
  ORDER BY t.created_at DESC
`).bind(user.id, user.id).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching transactions:', error);
return c.json({ error: 'Failed to fetch transactions' }, 500);
  }
});

// Admin direct login endpoint
app.post("/api/admin/direct-login", async (c) => {
  try {
const body = await c.req.json();
const { username, password } = body;

// Verificar credenciais administrativas
if (username === 'gabriel' && password === '123mudar') {
  // Criar sessão administrativa temporária
  setCookie(c, 'admin_session', 'gabriel_admin_session', {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 60 * 8, // 8 horas
  });
  
  if (!c.env.DB) {
    return c.json({ error: 'Database not available' }, 500);
  }
  
  // Criar ou verificar usuário admin no banco
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO admin_users (user_id, role, permissions)
    VALUES (?, 'super_admin', ?)
  `).bind('gabriel_admin', JSON.stringify({ all: true })).run();
  
  return c.json({ success: true, message: "Admin login successful" });
} else {
  return c.json({ error: "Invalid admin credentials" }, 401);
}
  } catch (error) {
console.error('Error in admin login:', error);
return c.json({ error: 'Failed to login as admin' }, 500);
  }
});

// Admin setup endpoint (one-time use)
app.post("/api/admin/setup", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const body = await c.req.json();
const { setup_key } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Verificar se a chave está correta e não foi usada
const setupRecord = await c.env.DB.prepare(
  "SELECT * FROM admin_setup WHERE setup_key = ? AND is_used = 0"
).bind(setup_key).first();

if (!setupRecord) {
  return c.json({ error: "Invalid or already used setup key" }, 400);
}

// Adicionar usuário como super admin
await c.env.DB.prepare(`
  INSERT OR REPLACE INTO admin_users (user_id, role, permissions)
  VALUES (?, 'super_admin', ?)
`).bind(user.id, JSON.stringify({ all: true })).run();

// Marcar chave como usada
await c.env.DB.prepare(
  "UPDATE admin_setup SET is_used = 1 WHERE setup_key = ?"
).bind(setup_key).run();

return c.json({ success: true, message: "Admin access granted" });
  } catch (error) {
console.error('Error in admin setup:', error);
return c.json({ error: 'Failed to setup admin' }, 500);
  }
});

// Check admin access
app.get("/api/admin/check", async (c) => {
  try {
// Verificar sessão administrativa direta
const adminSession = getCookie(c, 'admin_session');
if (adminSession === 'gabriel_admin_session') {
  return c.json({ role: 'super_admin', permissions: { all: true } });
}

// Verificar usuário logado normal
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const admin = await c.env.DB.prepare(
  "SELECT * FROM admin_users WHERE user_id = ?"
).bind(user.id).first();

if (!admin) {
  return c.json({ error: "Not an admin" }, 403);
}

return c.json({ role: admin.role, permissions: admin.permissions });
  } catch (error) {
console.error('Error checking admin:', error);
return c.json({ error: 'Failed to check admin status' }, 500);
  }
});

// Get admin stats
app.get("/api/admin/stats", async (c) => {
  try {
// Verificar sessão administrativa
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Buscar estatísticas
const totalUsers = await c.env.DB.prepare(
  "SELECT COUNT(*) as count FROM user_profiles"
).first();

const totalSellers = await c.env.DB.prepare(
  "SELECT COUNT(*) as count FROM user_profiles WHERE is_seller = 1"
).first();

const totalBuyers = await c.env.DB.prepare(
  "SELECT COUNT(*) as count FROM user_profiles WHERE is_buyer = 1"
).first();

const totalProducts = await c.env.DB.prepare(
  "SELECT COUNT(*) as count FROM products WHERE is_available = 1"
).first();

const totalTransactions = await c.env.DB.prepare(
  "SELECT COUNT(*) as count FROM transactions"
).first();

const featuredRevenue = await c.env.DB.prepare(
  "SELECT COALESCE(SUM(price_paid_cents), 0) as revenue FROM featured_products"
).first();

return c.json({
  total_users: totalUsers?.count || 0,
  total_sellers: totalSellers?.count || 0,
  total_buyers: totalBuyers?.count || 0,
  total_products: totalProducts?.count || 0,
  total_transactions: totalTransactions?.count || 0,
  total_revenue_cents: Math.floor(Number(totalTransactions?.count || 0) * 250), // 5% commission estimate
  featured_revenue_cents: featuredRevenue?.revenue || 0
});
  } catch (error) {
console.error('Error fetching admin stats:', error);
return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// Get all users for admin
app.get("/api/admin/users", async (c) => {
  try {
// Verificar sessão administrativa
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT up.*, au.email
  FROM user_profiles up
  LEFT JOIN (
    SELECT DISTINCT user_id, 'email_not_available' as email FROM user_profiles
  ) au ON up.user_id = au.user_id
  ORDER BY up.created_at DESC
`).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching users:', error);
return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Admin actions (block, unblock, etc.)
app.post("/api/admin/actions", async (c) => {
  try {
// Verificar sessão administrativa
const adminSession = getCookie(c, 'admin_session');
let adminId = null;

if (adminSession === 'gabriel_admin_session') {
  adminId = 'gabriel_admin';
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    if (admin) adminId = user.id;
  }
}

if (!adminId) {
  return c.json({ error: "Not an admin" }, 403);
}

const body = await c.req.json();
const { target_user_id, action_type, reason, notes } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Registrar ação
await c.env.DB.prepare(`
  INSERT INTO admin_actions (admin_id, target_user_id, action_type, reason, notes)
  VALUES (?, ?, ?, ?, ?)
`).bind(adminId, target_user_id, action_type, reason || null, notes || null).run();

// Executar ação específica
if (action_type === 'block') {
  await c.env.DB.prepare(`
    INSERT OR REPLACE INTO blocked_users (user_id, blocked_by, reason)
    VALUES (?, ?, ?)
  `).bind(target_user_id, adminId, reason || 'Bloqueado pelo administrador').run();
} else if (action_type === 'unblock') {
  await c.env.DB.prepare(
    "DELETE FROM blocked_users WHERE user_id = ?"
  ).bind(target_user_id).run();
}

return c.json({ success: true, message: `Action ${action_type} completed` });
  } catch (error) {
console.error('Error executing admin action:', error);
return c.json({ error: 'Failed to execute action' }, 500);
  }
});

// Create featured product
app.post("/api/admin/featured-products", async (c) => {
  try {
// Verificar sessão administrativa
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

const body = await c.req.json();
const { product_id, featured_type, duration_days, price_cents } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Verificar se produto existe
const product = await c.env.DB.prepare(
  "SELECT * FROM products WHERE id = ?"
).bind(product_id).first();

if (!product) {
  return c.json({ error: "Product not found" }, 404);
}

// Calcular data de expiração
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + duration_days);

// Criar produto em destaque
await c.env.DB.prepare(`
  INSERT INTO featured_products (product_id, seller_id, featured_type, price_paid_cents, expires_at)
  VALUES (?, ?, ?, ?, ?)
`).bind(
  product_id,
  product.seller_id,
  featured_type,
  price_cents,
  expiresAt.toISOString()
).run();

return c.json({ success: true, message: "Featured product created" });
  } catch (error) {
console.error('Error creating featured product:', error);
return c.json({ error: 'Failed to create featured product' }, 500);
  }
});

// Product like endpoints
app.post("/api/products/:id/like", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const productId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Verificar se já curtiu
const existingLike = await c.env.DB.prepare(
  "SELECT * FROM product_likes WHERE product_id = ? AND user_id = ?"
).bind(productId, user.id).first();

if (existingLike) {
  // Remover curtida
  await c.env.DB.prepare(
    "DELETE FROM product_likes WHERE product_id = ? AND user_id = ?"
  ).bind(productId, user.id).run();
  
  // Atualizar contador no produto
  await c.env.DB.prepare(
    "UPDATE products SET like_count = like_count - 1 WHERE id = ? AND like_count > 0"
  ).bind(productId).run();
  
  return c.json({ liked: false });
} else {
  // Adicionar curtida
  await c.env.DB.prepare(
    "INSERT INTO product_likes (product_id, user_id) VALUES (?, ?)"
  ).bind(productId, user.id).run();
  
  // Atualizar contador no produto
  await c.env.DB.prepare(
    "UPDATE products SET like_count = like_count + 1 WHERE id = ?"
  ).bind(productId).run();
  
  return c.json({ liked: true });
}
  } catch (error) {
console.error('Error toggling like:', error);
return c.json({ error: 'Failed to toggle like' }, 500);
  }
});

app.get("/api/products/:id/like-status", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const productId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const existingLike = await c.env.DB.prepare(
  "SELECT * FROM product_likes WHERE product_id = ? AND user_id = ?"
).bind(productId, user.id).first();

return c.json({ liked: !!existingLike });
  } catch (error) {
console.error('Error checking like status:', error);
return c.json({ error: 'Failed to check like status' }, 500);
  }
});

// Public profile endpoint
app.get("/api/public-profile/:userId", async (c) => {
  try {
const userId = c.req.param('userId');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Get user profile
const profile = await c.env.DB.prepare(`
  SELECT * FROM user_profiles WHERE user_id = ?
`).bind(userId).first();

if (!profile) {
  return c.json({ error: "Profile not found" }, 404);
}

// Check if user is blocked
const blockedUser = await c.env.DB.prepare(
  "SELECT * FROM blocked_users WHERE user_id = ?"
).bind(userId).first();

// Get user's products
const { results: products } = await c.env.DB.prepare(`
  SELECT p.*, COALESCE(p.like_count, 0) as like_count
  FROM products p
  WHERE p.seller_id = ? AND p.is_available = 1
  ORDER BY p.created_at DESC
`).bind(userId).all();

// Get transaction reviews received
const { results: transactionReviews } = await c.env.DB.prepare(`
  SELECT r.*, up.name as reviewer_name, p.title as product_title,
         (SELECT COUNT(*) FROM transactions WHERE buyer_id = r.reviewer_id OR seller_id = r.reviewer_id) as reviewer_transaction_count
  FROM reviews r
  LEFT JOIN user_profiles up ON r.reviewer_id = up.user_id
  LEFT JOIN transactions t ON r.transaction_id = t.id
  LEFT JOIN products p ON t.product_id = p.id
  WHERE r.reviewed_id = ?
  ORDER BY r.created_at DESC
`).bind(userId).all();

// Get profile reviews received with responses
const { results: profileReviews } = await c.env.DB.prepare(`
  SELECT pr.*, up.name as reviewer_name,
         (SELECT COUNT(*) FROM transactions WHERE buyer_id = pr.reviewer_id OR seller_id = pr.reviewer_id) as reviewer_transaction_count
  FROM profile_reviews pr
  LEFT JOIN user_profiles up ON pr.reviewer_id = up.user_id
  WHERE pr.reviewed_id = ? AND pr.is_visible = 1
  ORDER BY pr.created_at DESC
`).bind(userId).all();

// Get responses for profile reviews
for (const review of (profileReviews || [])) {
  const { results: responses } = await c.env.DB.prepare(`
    SELECT rr.*, up.name as responder_name
    FROM review_responses rr
    LEFT JOIN user_profiles up ON rr.responder_id = up.user_id
    WHERE rr.review_id = ? AND rr.review_type = 'profile'
    ORDER BY rr.created_at ASC
  `).bind(review.id).all();
  
  review.responses = responses || [];
}

return c.json({
  ...profile,
  products: products || [],
  reviews_received: transactionReviews || [],
  profile_reviews: profileReviews || [],
  is_blocked: !!blockedUser
});
  } catch (error) {
console.error('Error fetching public profile:', error);
return c.json({ error: 'Failed to fetch public profile' }, 500);
  }
});

// Profile reviews endpoints
app.post("/api/profile-reviews", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const body = await c.req.json();
const { reviewed_id, rating, comment } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Check if user already reviewed this profile
const existingReview = await c.env.DB.prepare(
  "SELECT * FROM profile_reviews WHERE reviewer_id = ? AND reviewed_id = ?"
).bind(user.id, reviewed_id).first();

if (existingReview) {
  return c.json({ error: "You have already reviewed this profile" }, 400);
}

// Cannot review yourself
if (user.id === reviewed_id) {
  return c.json({ error: "Cannot review your own profile" }, 400);
}

// Create review
const review = await c.env.DB.prepare(`
  INSERT INTO profile_reviews (reviewer_id, reviewed_id, rating, comment)
  VALUES (?, ?, ?, ?)
  RETURNING *
`).bind(user.id, reviewed_id, rating, comment || null).first();

// Update user's rating
const { results: allReviews } = await c.env.DB.prepare(`
  SELECT rating FROM profile_reviews WHERE reviewed_id = ? AND is_visible = 1
  UNION ALL
  SELECT rating FROM reviews WHERE reviewed_id = ?
`).bind(reviewed_id, reviewed_id).all();

if (allReviews && allReviews.length > 0) {
  const avgRating = allReviews.reduce((sum, r) => sum + Number(r.rating), 0) / allReviews.length;
  await c.env.DB.prepare(
    "UPDATE user_profiles SET rating_avg = ?, rating_count = ? WHERE user_id = ?"
  ).bind(avgRating, allReviews.length, reviewed_id).run();
}

return c.json(review);
  } catch (error) {
console.error('Error creating profile review:', error);
return c.json({ error: 'Failed to create profile review' }, 500);
  }
});

// Review responses endpoints
app.post("/api/review-responses", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const body = await c.req.json();
const { review_id, review_type, response_text } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Verify user can respond to this review
let canRespond = false;

if (review_type === 'profile') {
  const review = await c.env.DB.prepare(
    "SELECT * FROM profile_reviews WHERE id = ?"
  ).bind(review_id).first();
  canRespond = !!(review && String(review.reviewed_id) === user.id);
} else if (review_type === 'transaction') {
  const review = await c.env.DB.prepare(
    "SELECT * FROM reviews WHERE id = ?"
  ).bind(review_id).first();
  canRespond = !!(review && String(review.reviewed_id) === user.id);
}

if (!canRespond) {
  return c.json({ error: "Cannot respond to this review" }, 403);
}

// Create response
const response = await c.env.DB.prepare(`
  INSERT INTO review_responses (review_id, review_type, responder_id, response_text)
  VALUES (?, ?, ?, ?)
  RETURNING *
`).bind(review_id, review_type, user.id, response_text).first();

return c.json(response);
  } catch (error) {
console.error('Error creating review response:', error);
return c.json({ error: 'Failed to create review response' }, 500);
  }
});

// Admin delete endpoints
app.delete("/api/admin/products/:id", async (c) => {
  try {
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

const productId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Delete product images first
await c.env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(productId).run();

// Delete product likes
await c.env.DB.prepare("DELETE FROM product_likes WHERE product_id = ?").bind(productId).run();

// Delete the product
await c.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId).run();

return c.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
console.error('Error deleting product:', error);
return c.json({ error: 'Failed to delete product' }, 500);
  }
});

app.delete("/api/admin/users/:id", async (c) => {
  try {
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

const userId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Delete user data in order (foreign key constraints)
await c.env.DB.prepare("DELETE FROM product_likes WHERE user_id = ?").bind(userId).run();
await c.env.DB.prepare("DELETE FROM review_responses WHERE responder_id = ?").bind(userId).run();
await c.env.DB.prepare("DELETE FROM profile_reviews WHERE reviewer_id = ? OR reviewed_id = ?").bind(userId, userId).run();
await c.env.DB.prepare("DELETE FROM reviews WHERE reviewer_id = ? OR reviewed_id = ?").bind(userId, userId).run();
await c.env.DB.prepare("DELETE FROM chat_messages WHERE sender_id = ?").bind(userId).run();
await c.env.DB.prepare("DELETE FROM chat_conversations WHERE buyer_id = ? OR seller_id = ?").bind(userId, userId).run();
await c.env.DB.prepare("DELETE FROM transactions WHERE buyer_id = ? OR seller_id = ?").bind(userId, userId).run();
await c.env.DB.prepare("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE seller_id = ?)").bind(userId).run();
await c.env.DB.prepare("DELETE FROM products WHERE seller_id = ?").bind(userId).run();
await c.env.DB.prepare("DELETE FROM blocked_users WHERE user_id = ?").bind(userId).run();
await c.env.DB.prepare("DELETE FROM admin_actions WHERE target_user_id = ?").bind(userId).run();
await c.env.DB.prepare("DELETE FROM user_profiles WHERE user_id = ?").bind(userId).run();

return c.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
console.error('Error deleting user:', error);
return c.json({ error: 'Failed to delete user' }, 500);
  }
});

app.delete("/api/admin/reviews/:id", async (c) => {
  try {
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

const reviewId = c.req.param('id');
const reviewType = c.req.query('type') || 'transaction';

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

if (reviewType === 'profile') {
  // Delete responses first
  await c.env.DB.prepare("DELETE FROM review_responses WHERE review_id = ? AND review_type = 'profile'").bind(reviewId).run();
  // Delete profile review
  await c.env.DB.prepare("DELETE FROM profile_reviews WHERE id = ?").bind(reviewId).run();
} else {
  // Delete responses first
  await c.env.DB.prepare("DELETE FROM review_responses WHERE review_id = ? AND review_type = 'transaction'").bind(reviewId).run();
  // Delete transaction review
  await c.env.DB.prepare("DELETE FROM reviews WHERE id = ?").bind(reviewId).run();
}

return c.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
console.error('Error deleting review:', error);
return c.json({ error: 'Failed to delete review' }, 500);
  }
});

// Get all products for admin
app.get("/api/admin/products", async (c) => {
  try {
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT p.*, up.name as seller_name
  FROM products p
  LEFT JOIN user_profiles up ON p.seller_id = up.user_id
  ORDER BY p.created_at DESC
`).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching products:', error);
return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

// Get all reviews for admin
app.get("/api/admin/reviews", async (c) => {
  try {
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Get transaction reviews
const { results: transactionReviews } = await c.env.DB.prepare(`
  SELECT r.*, 
         reviewer.name as reviewer_name,
         reviewed.name as reviewed_name,
         'transaction' as review_type_name
  FROM reviews r
  LEFT JOIN user_profiles reviewer ON r.reviewer_id = reviewer.user_id
  LEFT JOIN user_profiles reviewed ON r.reviewed_id = reviewed.user_id
  ORDER BY r.created_at DESC
`).all();

// Get profile reviews
const { results: profileReviews } = await c.env.DB.prepare(`
  SELECT pr.*,
         reviewer.name as reviewer_name,
         reviewed.name as reviewed_name,
         'profile' as review_type_name
  FROM profile_reviews pr
  LEFT JOIN user_profiles reviewer ON pr.reviewer_id = reviewer.user_id
  LEFT JOIN user_profiles reviewed ON pr.reviewed_id = reviewed.user_id
  ORDER BY pr.created_at DESC
`).all();

// Combine and sort reviews
const allReviews = [
  ...(transactionReviews || []),
  ...(profileReviews || [])
].sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

return c.json(allReviews);
  } catch (error) {
console.error('Error fetching reviews:', error);
return c.json({ error: 'Failed to fetch reviews' }, 500);
  }
});

// Chat endpoints
app.get("/api/chat/conversations", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT cc.*, p.title as product_title, p.main_image_url as product_image_url,
         CASE 
           WHEN cc.buyer_id = ? THEN seller_up.name
           ELSE buyer_up.name
         END as other_user_name,
         cm.message as last_message,
         (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = cc.id AND sender_id != ? AND is_read = 0) as unread_count
  FROM chat_conversations cc
  LEFT JOIN products p ON cc.product_id = p.id
  LEFT JOIN user_profiles seller_up ON cc.seller_id = seller_up.user_id
  LEFT JOIN user_profiles buyer_up ON cc.buyer_id = buyer_up.user_id
  LEFT JOIN (
    SELECT conversation_id, message, created_at,
           ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at DESC) as rn
    FROM chat_messages
  ) cm ON cc.id = cm.conversation_id AND cm.rn = 1
  WHERE cc.buyer_id = ? OR cc.seller_id = ?
  ORDER BY cc.last_message_at DESC
`).bind(user.id, user.id, user.id, user.id).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching conversations:', error);
return c.json({ error: 'Failed to fetch conversations' }, 500);
  }
});

app.get("/api/chat/conversations/:id/messages", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const conversationId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Verify user is part of this conversation
const conversation = await c.env.DB.prepare(
  "SELECT * FROM chat_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)"
).bind(conversationId, user.id, user.id).first();

if (!conversation) {
  return c.json({ error: "Conversation not found or unauthorized" }, 404);
}

// Get messages
const { results } = await c.env.DB.prepare(`
  SELECT cm.*, up.name as sender_name
  FROM chat_messages cm
  LEFT JOIN user_profiles up ON cm.sender_id = up.user_id
  WHERE cm.conversation_id = ?
  ORDER BY cm.created_at ASC
`).bind(conversationId).all();

// Mark messages as read
await c.env.DB.prepare(
  "UPDATE chat_messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?"
).bind(conversationId, user.id).run();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching messages:', error);
return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

app.post("/api/chat/conversations/:id/messages", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const conversationId = c.req.param('id');
const body = await c.req.json();
const { message, message_type, image_url } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Verify user is part of this conversation
const conversation = await c.env.DB.prepare(
  "SELECT * FROM chat_conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)"
).bind(conversationId, user.id, user.id).first();

if (!conversation) {
  return c.json({ error: "Conversation not found or unauthorized" }, 404);
}

// Create message
const newMessage = await c.env.DB.prepare(`
  INSERT INTO chat_messages (conversation_id, sender_id, message, message_type, image_url)
  VALUES (?, ?, ?, ?, ?)
  RETURNING *
`).bind(
  conversationId,
  user.id,
  message,
  message_type || 'text',
  image_url || null
).first();

// Update conversation last message time
await c.env.DB.prepare(
  "UPDATE chat_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?"
).bind(conversationId).run();

return c.json(newMessage);
  } catch (error) {
console.error('Error sending message:', error);
return c.json({ error: 'Failed to send message' }, 500);
  }
});

app.post("/api/chat/conversations", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const body = await c.req.json();
const { product_id, initial_message } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Get product info
const product = await c.env.DB.prepare(
  "SELECT * FROM products WHERE id = ?"
).bind(product_id).first();

if (!product) {
  return c.json({ error: "Product not found" }, 404);
}

// Determine buyer and seller
const buyerId = user.id;
const sellerId = product.seller_id;

// Check if conversation already exists
const existingConversation = await c.env.DB.prepare(
  "SELECT * FROM chat_conversations WHERE buyer_id = ? AND seller_id = ? AND product_id = ?"
).bind(buyerId, sellerId, product_id).first();

if (existingConversation) {
  return c.json(existingConversation);
}

// Create new conversation
const conversation = await c.env.DB.prepare(`
  INSERT INTO chat_conversations (buyer_id, seller_id, product_id)
  VALUES (?, ?, ?)
  RETURNING *
`).bind(buyerId, sellerId, product_id).first() as any;

if (!conversation) {
  return c.json({ error: 'Failed to create conversation' }, 500);
}

// Send initial message if provided
if (initial_message && conversation.id) {
  await c.env.DB.prepare(`
    INSERT INTO chat_messages (conversation_id, sender_id, message)
    VALUES (?, ?, ?)
  `).bind(conversation.id, user.id, initial_message).run();
}

return c.json(conversation);
  } catch (error) {
console.error('Error creating conversation:', error);
return c.json({ error: 'Failed to create conversation' }, 500);
  }
});

// Admin messaging endpoints
app.post("/api/admin/send-message", async (c) => {
  try {
// Verificar sessão administrativa
const adminSession = getCookie(c, 'admin_session');
let adminId = null;

if (adminSession === 'gabriel_admin_session') {
  adminId = 'gabriel_admin';
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    if (admin) adminId = user.id;
  }
}

if (!adminId) {
  return c.json({ error: "Not an admin" }, 403);
}

const body = await c.req.json();
const { user_id, message, subject, message_type } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Criar ou buscar conversa administrativa
let conversation = await c.env.DB.prepare(
  "SELECT * FROM admin_conversations WHERE admin_id = ? AND user_id = ?"
).bind(adminId, user_id).first() as any;

if (!conversation) {
  conversation = await c.env.DB.prepare(`
    INSERT INTO admin_conversations (admin_id, user_id, conversation_type)
    VALUES (?, ?, 'admin_chat')
    RETURNING *
  `).bind(adminId, user_id).first() as any;
}

// Criar mensagem administrativa
const adminMessage = await c.env.DB.prepare(`
  INSERT INTO admin_messages (admin_id, user_id, subject, message, message_type)
  VALUES (?, ?, ?, ?, ?)
  RETURNING *
`).bind(adminId, user_id, subject || null, message, message_type || 'notification').first();

// Atualizar timestamp da conversa
await c.env.DB.prepare(
  "UPDATE admin_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?"
).bind(conversation.id).run();

return c.json({ success: true, message: adminMessage });
  } catch (error) {
console.error('Error sending admin message:', error);
return c.json({ error: 'Failed to send message' }, 500);
  }
});

app.get("/api/admin/user-conversations/:userId", async (c) => {
  try {
const adminSession = getCookie(c, 'admin_session');
let adminId: string | null = null;

if (adminSession === 'gabriel_admin_session') {
  adminId = 'gabriel_admin';
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    if (admin) adminId = user.id;
  }
}

if (!adminId) {
  return c.json({ error: "Not an admin" }, 403);
}

const userId = c.req.param('userId');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Buscar mensagens administrativas para este usuário
const { results } = await c.env.DB.prepare(`
  SELECT am.*, up.name as user_name
  FROM admin_messages am
  LEFT JOIN user_profiles up ON am.user_id = up.user_id
  WHERE am.user_id = ?
  ORDER BY am.created_at ASC
`).bind(userId).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching admin messages:', error);
return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

// User endpoints for admin messages
app.get("/api/admin-messages", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT * FROM admin_messages 
  WHERE user_id = ?
  ORDER BY created_at DESC
`).bind(user.id).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching admin messages:', error);
return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

app.post("/api/admin-messages/:id/read", authMiddleware, async (c) => {
  try {
const user = c.get("user");
if (!user) return c.json({ error: "Unauthorized" }, 401);

const messageId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

await c.env.DB.prepare(
  "UPDATE admin_messages SET is_read = 1 WHERE id = ? AND user_id = ?"
).bind(messageId, user.id).run();

return c.json({ success: true });
  } catch (error) {
console.error('Error marking message as read:', error);
return c.json({ error: 'Failed to mark as read' }, 500);
  }
});

// Admin chat management
app.get("/api/admin/conversations", async (c) => {
  try {
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT cc.*, p.title as product_title,
         buyer_up.name as buyer_name,
         seller_up.name as seller_name,
         (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = cc.id) as message_count,
         (SELECT message FROM chat_messages WHERE conversation_id = cc.id ORDER BY created_at DESC LIMIT 1) as last_message
  FROM chat_conversations cc
  LEFT JOIN products p ON cc.product_id = p.id
  LEFT JOIN user_profiles buyer_up ON cc.buyer_id = buyer_up.user_id
  LEFT JOIN user_profiles seller_up ON cc.seller_id = seller_up.user_id
  ORDER BY cc.last_message_at DESC
`).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching admin conversations:', error);
return c.json({ error: 'Failed to fetch conversations' }, 500);
  }
});

app.get("/api/admin/conversations/:id/messages", async (c) => {
  try {
const adminSession = getCookie(c, 'admin_session');
let isAdmin = false;

if (adminSession === 'gabriel_admin_session') {
  isAdmin = true;
} else {
  const user = c.get("user");
  if (user && c.env.DB) {
    const admin = await c.env.DB.prepare(
      "SELECT * FROM admin_users WHERE user_id = ?"
    ).bind(user.id).first();
    isAdmin = !!admin;
  }
}

if (!isAdmin) {
  return c.json({ error: "Not an admin" }, 403);
}

const conversationId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT cm.*, up.name as sender_name
  FROM chat_messages cm
  LEFT JOIN user_profiles up ON cm.sender_id = up.user_id
  WHERE cm.conversation_id = ?
  ORDER BY cm.created_at ASC
`).bind(conversationId).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching admin messages:', error);
return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

// Support system endpoints
app.post("/api/support/login", async (c) => {
  try {
const body = await c.req.json();
const { username, password } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Check support staff credentials
const staff = await c.env.DB.prepare(
  "SELECT * FROM support_staff WHERE username = ? AND password_hash = ? AND is_active = 1"
).bind(username, password).first();

if (!staff) {
  return c.json({ error: "Invalid credentials" }, 401);
}

// Create support session
setCookie(c, 'support_session', `${staff.id}_${staff.username}`, {
  httpOnly: true,
  path: "/",
  sameSite: "none",
  secure: true,
  maxAge: 60 * 60 * 8, // 8 hours
});

return c.json({ 
  success: true, 
  user: {
    id: staff.id,
    username: staff.username,
    name: staff.name,
    email: staff.email,
    role: staff.role
  }
});
  } catch (error) {
console.error('Error in support login:', error);
return c.json({ error: 'Failed to login' }, 500);
  }
});

app.get("/api/support/check", async (c) => {
  try {
const supportSession = getCookie(c, 'support_session');

if (!supportSession) {
  return c.json({ error: "Not authenticated" }, 401);
}

const [staffId] = supportSession.split('_');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const staff = await c.env.DB.prepare(
  "SELECT * FROM support_staff WHERE id = ? AND is_active = 1"
).bind(staffId).first();

if (!staff) {
  return c.json({ error: "Invalid session" }, 401);
}

return c.json({
  id: staff.id,
  username: staff.username,
  name: staff.name,
  email: staff.email,
  role: staff.role
});
  } catch (error) {
console.error('Error checking support access:', error);
return c.json({ error: 'Failed to check access' }, 500);
  }
});

app.post("/api/support/logout", async (c) => {
  setCookie(c, 'support_session', '', {
httpOnly: true,
path: "/",
sameSite: "none",
secure: true,
maxAge: 0,
  });
  
  return c.json({ success: true });
});

app.get("/api/support/tickets", async (c) => {
  try {
const supportSession = getCookie(c, 'support_session');

if (!supportSession) {
  return c.json({ error: "Not authenticated" }, 401);
}

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT * FROM support_tickets 
  ORDER BY 
    CASE status 
      WHEN 'open' THEN 1 
      WHEN 'in_progress' THEN 2 
      WHEN 'resolved' THEN 3 
      WHEN 'closed' THEN 4 
    END,
    CASE priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
    END,
    created_at DESC
`).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching tickets:', error);
return c.json({ error: 'Failed to fetch tickets' }, 500);
  }
});

app.get("/api/support/tickets/:id/responses", async (c) => {
  try {
const supportSession = getCookie(c, 'support_session');

if (!supportSession) {
  return c.json({ error: "Not authenticated" }, 401);
}

const ticketId = c.req.param('id');

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

const { results } = await c.env.DB.prepare(`
  SELECT * FROM support_responses 
  WHERE ticket_id = ? 
  ORDER BY created_at ASC
`).bind(ticketId).all();

return c.json(results || []);
  } catch (error) {
console.error('Error fetching responses:', error);
return c.json({ error: 'Failed to fetch responses' }, 500);
  }
});

app.post("/api/support/tickets/:id/responses", async (c) => {
  try {
const supportSession = getCookie(c, 'support_session');

if (!supportSession) {
  return c.json({ error: "Not authenticated" }, 401);
}

const [staffId] = supportSession.split('_');
const ticketId = c.req.param('id');
const body = await c.req.json();
const { message, is_internal } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Get staff info
const staff = await c.env.DB.prepare(
  "SELECT * FROM support_staff WHERE id = ?"
).bind(staffId).first();

if (!staff) {
  return c.json({ error: "Invalid session" }, 401);
}

// Create response
const response = await c.env.DB.prepare(`
  INSERT INTO support_responses (ticket_id, responder_id, responder_name, message, is_internal)
  VALUES (?, ?, ?, ?, ?)
  RETURNING *
`).bind(ticketId, staff.id, staff.name, message, is_internal || false).first();

// Update ticket timestamp
await c.env.DB.prepare(
  "UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
).bind(ticketId).run();

return c.json(response);
  } catch (error) {
console.error('Error creating response:', error);
return c.json({ error: 'Failed to create response' }, 500);
  }
});

app.put("/api/support/tickets/:id/status", async (c) => {
  try {
const supportSession = getCookie(c, 'support_session');

if (!supportSession) {
  return c.json({ error: "Not authenticated" }, 401);
}

const ticketId = c.req.param('id');
const body = await c.req.json();
const { status } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

await c.env.DB.prepare(
  "UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
).bind(status, ticketId).run();

return c.json({ success: true });
  } catch (error) {
console.error('Error updating ticket status:', error);
return c.json({ error: 'Failed to update status' }, 500);
  }
});

// Public ticket creation endpoint
app.post("/api/support/tickets", async (c) => {
  try {
const body = await c.req.json();
const { user_name, user_email, subject, message, category, priority } = body;

if (!c.env.DB) {
  return c.json({ error: 'Database not available' }, 500);
}

// Get user ID if authenticated
let userId = null;
try {
  const user = c.get("user");
  if (user) userId = user.id;
} catch (e) {
  // Not authenticated, that's fine
}

const ticket = await c.env.DB.prepare(`
  INSERT INTO support_tickets (user_id, user_name, user_email, subject, message, category, priority)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  RETURNING *
`).bind(
  userId,
  user_name,
  user_email,
  subject,
  message,
  category || 'general',
  priority || 'medium'
).first();

return c.json(ticket);
  } catch (error) {
console.error('Error creating ticket:', error);
return c.json({ error: 'Failed to create ticket' }, 500);
  }
});

// Fallback for unmatched routes
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Global error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,
};
