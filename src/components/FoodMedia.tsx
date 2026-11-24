import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Leaf, RotateCcw, Upload } from 'lucide-react';

export const MEDIA_ASSETS = {
  hero: '/src/assets/images/hero_food_rescue_1795544842326.jpg',
  cookedMeals: '/src/assets/images/donor_kitchen_meals_1795544842288.jpg',
  biryaniMeals: '/src/assets/images/real_cooked_biryani_meals_1795546489571.jpg',
  produce: '/src/assets/images/fresh_produce_crates_1795544843127.jpg',
  produceHarvest: '/src/assets/images/real_fresh_produce_harvest_1795546489525.jpg',
  bakery: '/src/assets/images/real_bakery_bread_1795546488452.jpg',
  dryStaples: '/src/assets/images/real_dry_pantry_staples_1795546488606.jpg',
  dairy: '/src/assets/images/real_dairy_beverages_1795546488984.jpg',
  delivery: '/src/assets/images/ngo_community_delivery_1795544843393.jpg',
} as const;

export const REAL_FOOD_GALLERY = [
  {
    src: MEDIA_ASSETS.biryaniMeals,
    label: 'Spiced Rice & Biryani Meals',
    category: 'Cooked Meals',
  },
  {
    src: MEDIA_ASSETS.cookedMeals,
    label: 'Prepared Kitchen Meal Boxes',
    category: 'Cooked Meals',
  },
  {
    src: MEDIA_ASSETS.produceHarvest,
    label: 'Fresh Harvest Vegetables & Fruit',
    category: 'Fresh Produce',
  },
  {
    src: MEDIA_ASSETS.bakery,
    label: 'Artisan Bread & Bakery Loaves',
    category: 'Bakery & Bread',
  },
  {
    src: MEDIA_ASSETS.dryStaples,
    label: 'Rice, Lentils & Pantry Staples',
    category: 'Packaged & Dry Goods',
  },
  {
    src: MEDIA_ASSETS.dairy,
    label: 'Fresh Milk, Yogurt & Dairy',
    category: 'Dairy & Beverages',
  },
] as const;

export function isSafeFoodImageSrc(src?: string | null): src is string {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  return (
    /^\/src\/assets\/images\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/.test(trimmed) ||
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)
  );
}

export function getCategoryImage(
  category: string,
  foodName?: string | null,
  customImageUrl?: string | null
): string {
  if (isSafeFoodImageSrc(customImageUrl)) {
    return customImageUrl;
  }

  const name = (foodName || '').toLowerCase();
  if (
    name.includes('biryani') ||
    name.includes('briyani') ||
    name.includes('pulao') ||
    name.includes('curry') ||
    name.includes('vegetarian dinner')
  ) {
    return MEDIA_ASSETS.biryaniMeals;
  }
  if (
    name.includes('bread') ||
    name.includes('sourdough') ||
    name.includes('roll') ||
    name.includes('bakery') ||
    name.includes('pastry')
  ) {
    return MEDIA_ASSETS.bakery;
  }
  if (
    name.includes('milk') ||
    name.includes('yogurt') ||
    name.includes('butter') ||
    name.includes('cheese') ||
    name.includes('juice') ||
    name.includes('beverage')
  ) {
    return MEDIA_ASSETS.dairy;
  }
  if (
    name.includes('lentil') ||
    name.includes('rice') ||
    name.includes('bean') ||
    name.includes('oil') ||
    name.includes('dry') ||
    name.includes('pantry') ||
    name.includes('flour')
  ) {
    return MEDIA_ASSETS.dryStaples;
  }
  if (
    name.includes('spinach') ||
    name.includes('tomato') ||
    name.includes('carrot') ||
    name.includes('apple') ||
    name.includes('vegetable') ||
    name.includes('greens') ||
    name.includes('fruit')
  ) {
    return MEDIA_ASSETS.produceHarvest;
  }

  switch (category) {
    case 'Cooked Meals':
      return MEDIA_ASSETS.cookedMeals;
    case 'Fresh Produce':
      return MEDIA_ASSETS.produceHarvest;
    case 'Bakery & Bread':
      return MEDIA_ASSETS.bakery;
    case 'Packaged & Dry Goods':
      return MEDIA_ASSETS.dryStaples;
    case 'Dairy & Beverages':
      return MEDIA_ASSETS.dairy;
    default:
      return MEDIA_ASSETS.produce;
  }
}

export function FoodMedia({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !isSafeFoodImageSrc(src)) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#E9F0EA] via-[#F2EDE1] to-[#FAF7F0] text-[#166534] p-6 ${className}`}
      >
        <Leaf className="w-8 h-8 mb-2 opacity-80" aria-hidden="true" />
        <span className="text-xs font-medium text-center text-[#4B5D51] max-w-[20ch] truncate">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a supported image.'));
      img.onload = () => {
        const maxWidth = 880;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to process image in browser.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > 900_000) {
          reject(new Error('Photo is still too large after compression. Please pick a smaller photo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function FoodImagePicker({
  category,
  foodName,
  value,
  onChange,
  onError,
}: {
  category: string;
  foodName: string;
  value: string | null;
  onChange: (nextUrl: string | null) => void;
  onError?: (message: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = useState(false);

  const activePreview = getCategoryImage(category, foodName, value);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      onError?.('Please upload a JPEG, PNG, or WebP food photo.');
      return;
    }
    setProcessing(true);
    try {
      const compressed = await compressImageToDataUrl(file);
      onChange(compressed);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Unable to load selected photo.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="rounded-xl border border-[#E2DDD1] bg-[#FAF7F0] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#166534]" aria-hidden="true" />
          <span className="text-sm font-medium text-[#142219]">
            Real Food Photo {value ? '(Custom Selected)' : '(Auto-Matched to Food)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 rounded-md border border-[#D6E0D8] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#4B5D51] hover:text-[#142219] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Auto-Match</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={processing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#166534] bg-[#FFFFFF] px-3 py-1 text-xs font-semibold text-[#166534] hover:bg-[#E9F0EA] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{processing ? 'Preparing...' : 'Upload Photo'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        <div className="sm:col-span-5 aspect-[4/3] rounded-lg overflow-hidden border border-[#E2DDD1] bg-[#FFFFFF]">
          <FoodMedia
            src={activePreview}
            alt={foodName || category || 'Selected food preview'}
            className="w-full h-full"
          />
        </div>

        <div className="sm:col-span-7 space-y-2">
          <p className="text-xs text-[#4B5D51]">
            Choose a real food photograph below or upload your own photo of the meal or supplies:
          </p>
          <div className="grid grid-cols-3 gap-2">
            {REAL_FOOD_GALLERY.map((item) => {
              const selected = value === item.src || (!value && activePreview === item.src);
              return (
                <button
                  key={item.src}
                  type="button"
                  onClick={() => onChange(item.src)}
                  title={item.label}
                  className={`relative aspect-[4/3] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    selected
                      ? 'border-[#166534] ring-2 ring-[#166534]'
                      : 'border-[#E2DDD1] opacity-85 hover:opacity-100'
                  }`}
                >
                  <FoodMedia src={item.src} alt={item.label} className="w-full h-full" />
                  {selected && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#166534] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
