import z from "zod";

// Esquemas para validação de dados
export const UserProfileSchema = z.object({
  id: z.number(),
  user_id: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  bio: z.string().nullable(),
  profile_image_url: z.string().nullable(),
  whatsapp_number: z.string().nullable(),
  business_name: z.string().nullable(),
  business_type: z.string().nullable(),
  is_seller: z.boolean(),
  is_buyer: z.boolean(),
  rating_avg: z.number(),
  rating_count: z.number(),
  total_sales: z.number(),
  total_purchases: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ProductSchema = z.object({
  id: z.number(),
  seller_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  hair_type: z.string().nullable(),
  hair_color: z.string().nullable(),
  hair_length: z.number().nullable(),
  weight_grams: z.number().nullable(),
  hair_origin: z.string().nullable(),
  hair_texture: z.string().nullable(),
  price_cents: z.number(),
  is_available: z.boolean(),
  main_image_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateProductSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().optional(),
  hair_type: z.string().optional(),
  hair_color: z.string().optional(),
  hair_length: z.number().positive().optional(),
  weight_grams: z.number().positive().optional(),
  hair_origin: z.string().optional(),
  hair_texture: z.string().optional(),
  price_cents: z.number().positive(),
  main_image_url: z.string().optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().max(500).optional(),
  whatsapp_number: z.string().optional(),
  business_name: z.string().optional(),
  business_type: z.string().optional(),
  is_seller: z.boolean().optional(),
});

// Tipos TypeScript derivados
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type CreateProduct = z.infer<typeof CreateProductSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

// Tipos estendidos para o frontend
export interface ProductWithImages extends Product {
  seller_name?: string;
  seller_rating?: number;
  like_count?: number;
  can_edit?: boolean;
}
