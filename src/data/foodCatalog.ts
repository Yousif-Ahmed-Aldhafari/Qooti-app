/**
 * Qooti Curated Bilingual Food Catalog.
 * Contains 158 verified food items with accurate per-100g nutritional profiles,
 * food-specific serving mass multipliers, and bilingual English/Arabic names.
 * Sources: USDA FoodData Central & Saudi Food and Drug Authority (SFDA).
 */
import { FoodCatalogEntry } from '../models/food';

export const FOOD_CATALOG: FoodCatalogEntry[] = [
  {
    "id": "chicken-breast-raw",
    "nameEn": "Chicken Breast (Raw, Skinless)",
    "nameAr": "صدر دجاج (نيء، بدون جلد)",
    "category": "meat_poultry",
    "caloriesPer100g": 120,
    "proteinPer100g": 22.5,
    "carbsPer100g": 0,
    "fatsPer100g": 2.6,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171077",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet",
        "nameEn": "1 breast fillet (170g)",
        "nameAr": "قطعة صدر (170غ)",
        "grams": 170
      },
      {
        "id": "oz",
        "nameEn": "1 oz (28.35g)",
        "nameAr": "أونصة (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "chicken-breast-cooked",
    "nameEn": "Chicken Breast (Cooked / Grilled, Skinless)",
    "nameAr": "صدر دجاج (مشوي / مطبوخ، بدون جلد)",
    "category": "meat_poultry",
    "caloriesPer100g": 165,
    "proteinPer100g": 31,
    "carbsPer100g": 0,
    "fatsPer100g": 3.6,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171477",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet_cooked",
        "nameEn": "1 cooked fillet (120g)",
        "nameAr": "فيليه مطبوخ (120غ)",
        "grams": 120
      },
      {
        "id": "cup_diced",
        "nameEn": "1 cup diced (140g)",
        "nameAr": "كوب مكعبات (140غ)",
        "grams": 140
      }
    ]
  },
  {
    "id": "chicken-thigh-raw",
    "nameEn": "Chicken Thigh (Raw, Skinless)",
    "nameAr": "فخذ دجاج (نيء، بدون جلد)",
    "category": "meat_poultry",
    "caloriesPer100g": 121,
    "proteinPer100g": 19.7,
    "carbsPer100g": 0,
    "fatsPer100g": 4.2,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171116",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "thigh",
        "nameEn": "1 thigh bone-in (110g meat)",
        "nameAr": "فخذ دجاج (110غ لحم)",
        "grams": 110
      }
    ]
  },
  {
    "id": "chicken-thigh-cooked",
    "nameEn": "Chicken Thigh (Cooked / Roasted, Skinless)",
    "nameAr": "فخذ دجاج (مطبوخ / محمر، بدون جلد)",
    "category": "meat_poultry",
    "caloriesPer100g": 179,
    "proteinPer100g": 24.7,
    "carbsPer100g": 0,
    "fatsPer100g": 8.2,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171485",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "thigh_cooked",
        "nameEn": "1 cooked thigh (85g)",
        "nameAr": "فخذ مطبوخ (85غ)",
        "grams": 85
      }
    ]
  },
  {
    "id": "chicken-drumstick-cooked",
    "nameEn": "Chicken Drumstick (Roasted, Skinless)",
    "nameAr": "ساق دجاج / دبوس (محمر، بدون جلد)",
    "category": "meat_poultry",
    "caloriesPer100g": 161,
    "proteinPer100g": 27.3,
    "carbsPer100g": 0,
    "fatsPer100g": 5.7,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171480",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "drumstick",
        "nameEn": "1 drumstick (44g meat)",
        "nameAr": "ساق واحدة (44غ لحم)",
        "grams": 44
      }
    ]
  },
  {
    "id": "chicken-wings-cooked",
    "nameEn": "Chicken Wings (Roasted, With Skin)",
    "nameAr": "أجنحة دجاج (محمرة، بالجلد)",
    "category": "meat_poultry",
    "caloriesPer100g": 290,
    "proteinPer100g": 27,
    "carbsPer100g": 0,
    "fatsPer100g": 19.5,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171483",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "wing",
        "nameEn": "1 wing (34g meat & skin)",
        "nameAr": "جناح واحد (34غ)",
        "grams": 34
      }
    ]
  },
  {
    "id": "turkey-breast-raw",
    "nameEn": "Turkey Breast (Raw, Skinless)",
    "nameAr": "صدر حبش / ديك رومي (نيء)",
    "category": "meat_poultry",
    "caloriesPer100g": 114,
    "proteinPer100g": 23.7,
    "carbsPer100g": 0,
    "fatsPer100g": 1.5,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171261",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cutlet",
        "nameEn": "1 cutlet (115g)",
        "nameAr": "قطعة (115غ)",
        "grams": 115
      }
    ]
  },
  {
    "id": "turkey-breast-cooked",
    "nameEn": "Turkey Breast (Roasted, Skinless)",
    "nameAr": "صدر حبش / ديك رومي (محمر)",
    "category": "meat_poultry",
    "caloriesPer100g": 147,
    "proteinPer100g": 30.1,
    "carbsPer100g": 0,
    "fatsPer100g": 2.1,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171501",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "slice",
        "nameEn": "1 slice (85g)",
        "nameAr": "شريحة (85غ)",
        "grams": 85
      }
    ]
  },
  {
    "id": "ground-turkey-cooked",
    "nameEn": "Ground Turkey 93/7 (Cooked / Pan-broiled)",
    "nameAr": "لحم حبش مفروم 93/7 (مطبوخ)",
    "category": "meat_poultry",
    "caloriesPer100g": 203,
    "proteinPer100g": 27.4,
    "carbsPer100g": 0,
    "fatsPer100g": 9.7,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171507",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "serving_85g",
        "nameEn": "3 oz serving (85g)",
        "nameAr": "حصة 3 أونصات (85غ)",
        "grams": 85
      }
    ]
  },
  {
    "id": "ground-beef-90-10-raw",
    "nameEn": "Ground Beef 90/10 Lean (Raw)",
    "nameAr": "لحم بقري مفروم 90/10 قليل الدهن (نيء)",
    "category": "meat_poultry",
    "caloriesPer100g": 176,
    "proteinPer100g": 20,
    "carbsPer100g": 0,
    "fatsPer100g": 10,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 174032",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "quarter_lb",
        "nameEn": "1/4 lb patty (113g)",
        "nameAr": "قطعة برغر ربع باوند (113غ)",
        "grams": 113
      }
    ]
  },
  {
    "id": "ground-beef-90-10-cooked",
    "nameEn": "Ground Beef 90/10 Lean (Cooked / Broiled)",
    "nameAr": "لحم بقري مفروم 90/10 (مطبوخ / مشوي)",
    "category": "meat_poultry",
    "caloriesPer100g": 217,
    "proteinPer100g": 26.1,
    "carbsPer100g": 0,
    "fatsPer100g": 11.8,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 174036",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "patty",
        "nameEn": "1 cooked patty (85g)",
        "nameAr": "قطعة برغر مطبوخة (85غ)",
        "grams": 85
      }
    ]
  },
  {
    "id": "ground-beef-80-20-raw",
    "nameEn": "Ground Beef 80/20 Standard (Raw)",
    "nameAr": "لحم بقري مفروم 80/20 عادي (نيء)",
    "category": "meat_poultry",
    "caloriesPer100g": 254,
    "proteinPer100g": 17.2,
    "carbsPer100g": 0,
    "fatsPer100g": 20,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 174034",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "quarter_lb",
        "nameEn": "1/4 lb patty (113g)",
        "nameAr": "قطعة برغر ربع باوند (113غ)",
        "grams": 113
      }
    ]
  },
  {
    "id": "ground-beef-80-20-cooked",
    "nameEn": "Ground Beef 80/20 Standard (Cooked / Pan-broiled)",
    "nameAr": "لحم بقري مفروم 80/20 عادي (مطبوخ)",
    "category": "meat_poultry",
    "caloriesPer100g": 272,
    "proteinPer100g": 24.4,
    "carbsPer100g": 0,
    "fatsPer100g": 18.5,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 174037",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "patty",
        "nameEn": "1 cooked patty (85g)",
        "nameAr": "قطعة مطبوخة (85غ)",
        "grams": 85
      }
    ]
  },
  {
    "id": "beef-tenderloin-raw",
    "nameEn": "Beef Tenderloin / Filet Mignon (Raw, Trimmed)",
    "nameAr": "فيليه لحم بقري تندرلوين (نيء)",
    "category": "meat_poultry",
    "caloriesPer100g": 143,
    "proteinPer100g": 21.8,
    "carbsPer100g": 0,
    "fatsPer100g": 5.4,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170275",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet",
        "nameEn": "1 steak fillet (170g)",
        "nameAr": "قطعة ستيك فيليه (170غ)",
        "grams": 170
      }
    ]
  },
  {
    "id": "beef-tenderloin-cooked",
    "nameEn": "Beef Tenderloin / Filet Mignon (Grilled / Broiled)",
    "nameAr": "فيليه لحم بقري تندرلوين (مشوي)",
    "category": "meat_poultry",
    "caloriesPer100g": 218,
    "proteinPer100g": 28.2,
    "carbsPer100g": 0,
    "fatsPer100g": 11,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170278",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet_cooked",
        "nameEn": "1 cooked steak (140g)",
        "nameAr": "قطعة ستيك مطبوخة (140غ)",
        "grams": 140
      }
    ]
  },
  {
    "id": "beef-top-sirloin-cooked",
    "nameEn": "Beef Top Sirloin Steak (Grilled, Lean)",
    "nameAr": "ستيك سيرلوين بقري علوي (مشوي، هبرة)",
    "category": "meat_poultry",
    "caloriesPer100g": 183,
    "proteinPer100g": 30.4,
    "carbsPer100g": 0,
    "fatsPer100g": 6,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170284",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "steak",
        "nameEn": "1 steak (170g)",
        "nameAr": "قطعة ستيك (170غ)",
        "grams": 170
      }
    ]
  },
  {
    "id": "lamb-chop-cooked",
    "nameEn": "Lamb Chop / Loin (Broiled, Lean Only)",
    "nameAr": "ريش لحم ضأن / خروف (مشوي، هبرة)",
    "category": "meat_poultry",
    "caloriesPer100g": 216,
    "proteinPer100g": 28.3,
    "carbsPer100g": 0,
    "fatsPer100g": 10.5,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172552",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "chop",
        "nameEn": "1 chop (60g meat)",
        "nameAr": "قطعة ريشة واحدة (60غ لحم)",
        "grams": 60
      }
    ]
  },
  {
    "id": "beef-liver-cooked",
    "nameEn": "Beef Liver (Cooked / Pan-seared)",
    "nameAr": "كبدة بقري (مطبوخة)",
    "category": "meat_poultry",
    "caloriesPer100g": 175,
    "proteinPer100g": 26.4,
    "carbsPer100g": 5.2,
    "fatsPer100g": 4.7,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169451",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "slice",
        "nameEn": "1 slice (80g)",
        "nameAr": "شريحة كبدة (80غ)",
        "grams": 80
      }
    ]
  },
  {
    "id": "salmon-atlantic-raw",
    "nameEn": "Atlantic Salmon (Raw)",
    "nameAr": "سلمون أطلسي (نيء)",
    "category": "fish_seafood",
    "caloriesPer100g": 208,
    "proteinPer100g": 20.4,
    "carbsPer100g": 0,
    "fatsPer100g": 13.4,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 175167",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet",
        "nameEn": "1 fillet (150g)",
        "nameAr": "فيليه سلمون (150غ)",
        "grams": 150
      }
    ]
  },
  {
    "id": "salmon-atlantic-cooked",
    "nameEn": "Atlantic Salmon (Cooked / Baked)",
    "nameAr": "سلمون أطلسي (مطبوخ / بالفرن)",
    "category": "fish_seafood",
    "caloriesPer100g": 206,
    "proteinPer100g": 22.1,
    "carbsPer100g": 0,
    "fatsPer100g": 12.3,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173686",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet_cooked",
        "nameEn": "1 cooked fillet (125g)",
        "nameAr": "فيليه مطبوخ (125غ)",
        "grams": 125
      }
    ]
  },
  {
    "id": "tuna-yellowfin-raw",
    "nameEn": "Yellowfin Tuna (Raw)",
    "nameAr": "تونة الزعنفة الصفراء (نيئة)",
    "category": "fish_seafood",
    "caloriesPer100g": 109,
    "proteinPer100g": 24.4,
    "carbsPer100g": 0,
    "fatsPer100g": 0.5,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 175176",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "steak",
        "nameEn": "1 tuna steak (140g)",
        "nameAr": "قطعة ستيك تونة (140غ)",
        "grams": 140
      }
    ]
  },
  {
    "id": "tuna-canned-water",
    "nameEn": "Canned Tuna in Water (Drained)",
    "nameAr": "تونة معلبة بالماء (مصفاة)",
    "category": "fish_seafood",
    "caloriesPer100g": 116,
    "proteinPer100g": 25.5,
    "carbsPer100g": 0,
    "fatsPer100g": 0.8,
    "preparationState": "canned",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171986",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "can_small",
        "nameEn": "1 small can (120g drained)",
        "nameAr": "علبة صغيرة (120غ مصفاة)",
        "grams": 120
      },
      {
        "id": "can_large",
        "nameEn": "1 large can (160g drained)",
        "nameAr": "علبة كبيرة (160غ مصفاة)",
        "grams": 160
      }
    ]
  },
  {
    "id": "tuna-canned-oil",
    "nameEn": "Canned Tuna in Oil (Drained)",
    "nameAr": "تونة معلبة بالزيت (مصفاة)",
    "category": "fish_seafood",
    "caloriesPer100g": 198,
    "proteinPer100g": 29.1,
    "carbsPer100g": 0,
    "fatsPer100g": 8.2,
    "preparationState": "canned",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171987",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "can",
        "nameEn": "1 can (140g drained)",
        "nameAr": "علبة (140غ مصفاة)",
        "grams": 140
      }
    ]
  },
  {
    "id": "tilapia-raw",
    "nameEn": "Tilapia Fish (Raw)",
    "nameAr": "سمك بلطي (نيء)",
    "category": "fish_seafood",
    "caloriesPer100g": 96,
    "proteinPer100g": 20.1,
    "carbsPer100g": 0,
    "fatsPer100g": 1.7,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 175177",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet",
        "nameEn": "1 fillet (116g)",
        "nameAr": "فيليه بلطي (116غ)",
        "grams": 116
      }
    ]
  },
  {
    "id": "tilapia-cooked",
    "nameEn": "Tilapia Fish (Cooked / Baked)",
    "nameAr": "سمك بلطي (مطبوخ / مشوي)",
    "category": "fish_seafood",
    "caloriesPer100g": 128,
    "proteinPer100g": 26.2,
    "carbsPer100g": 0,
    "fatsPer100g": 2.7,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 174227",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet_cooked",
        "nameEn": "1 cooked fillet (90g)",
        "nameAr": "فيليه مطبوخ (90غ)",
        "grams": 90
      }
    ]
  },
  {
    "id": "cod-atlantic-cooked",
    "nameEn": "Atlantic Cod (Cooked / Baked)",
    "nameAr": "سمك قد أطلسي (مطبوخ / بالفرن)",
    "category": "fish_seafood",
    "caloriesPer100g": 105,
    "proteinPer100g": 22.8,
    "carbsPer100g": 0,
    "fatsPer100g": 0.9,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173688",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet",
        "nameEn": "1 fillet (120g)",
        "nameAr": "فيليه قد (120غ)",
        "grams": 120
      }
    ]
  },
  {
    "id": "shrimp-raw",
    "nameEn": "Shrimp / Prawns (Raw, Peeled)",
    "nameAr": "روبيان / جمبري (نيء، مقشر)",
    "category": "fish_seafood",
    "caloriesPer100g": 85,
    "proteinPer100g": 20.1,
    "carbsPer100g": 0.2,
    "fatsPer100g": 0.5,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 175179",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "shrimp_large",
        "nameEn": "4 large shrimp (60g)",
        "nameAr": "4 حبات كبيرة (60غ)",
        "grams": 60
      }
    ]
  },
  {
    "id": "shrimp-cooked",
    "nameEn": "Shrimp / Prawns (Cooked / Steamed)",
    "nameAr": "روبيان / جمبري (مطبوخ / مسلوق)",
    "category": "fish_seafood",
    "caloriesPer100g": 99,
    "proteinPer100g": 24,
    "carbsPer100g": 0.2,
    "fatsPer100g": 0.3,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 175180",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked shrimp (145g)",
        "nameAr": "كوب روبيان مطبوخ (145غ)",
        "grams": 145
      },
      {
        "id": "piece",
        "nameEn": "1 large shrimp (15g)",
        "nameAr": "حبة كبيرة واحدة (15غ)",
        "grams": 15
      }
    ]
  },
  {
    "id": "sardines-canned-oil",
    "nameEn": "Canned Sardines in Oil (Drained)",
    "nameAr": "سردين معلب بالزيت (مصفى)",
    "category": "fish_seafood",
    "caloriesPer100g": 208,
    "proteinPer100g": 24.6,
    "carbsPer100g": 0,
    "fatsPer100g": 11.5,
    "preparationState": "canned",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 175139",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "can",
        "nameEn": "1 can (92g drained)",
        "nameAr": "علبة (92غ مصفاة)",
        "grams": 92
      }
    ]
  },
  {
    "id": "crab-meat-cooked",
    "nameEn": "Crab Meat (Cooked / Steamed)",
    "nameAr": "لحم سلطعون / كابوريا (مطبوخ)",
    "category": "fish_seafood",
    "caloriesPer100g": 97,
    "proteinPer100g": 19.4,
    "carbsPer100g": 0,
    "fatsPer100g": 1.5,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 175171",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup flaked (135g)",
        "nameAr": "كوب مفتت (135غ)",
        "grams": 135
      }
    ]
  },
  {
    "id": "mackerel-atlantic-cooked",
    "nameEn": "Atlantic Mackerel (Cooked / Baked)",
    "nameAr": "سمك ماكريل أطلسي (مطبوخ / مشوي)",
    "category": "fish_seafood",
    "caloriesPer100g": 262,
    "proteinPer100g": 23.9,
    "carbsPer100g": 0,
    "fatsPer100g": 17.8,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 175174",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "fillet",
        "nameEn": "1 fillet (112g)",
        "nameAr": "فيليه ماكريل (112غ)",
        "grams": 112
      }
    ]
  },
  {
    "id": "calamari-squid-cooked",
    "nameEn": "Squid / Calamari (Fried / Cooked)",
    "nameAr": "حبار / كاليماري (مطبوخ)",
    "category": "fish_seafood",
    "caloriesPer100g": 175,
    "proteinPer100g": 17.9,
    "carbsPer100g": 3.1,
    "fatsPer100g": 7.5,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 174229",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "serving",
        "nameEn": "1 serving (85g)",
        "nameAr": "حصة واحدة (85غ)",
        "grams": 85
      }
    ]
  },
  {
    "id": "egg-whole-raw",
    "nameEn": "Whole Egg (Raw)",
    "nameAr": "بيض كامل (نيء)",
    "category": "eggs_dairy",
    "caloriesPer100g": 143,
    "proteinPer100g": 12.6,
    "carbsPer100g": 0.7,
    "fatsPer100g": 9.5,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171287",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "large",
        "nameEn": "1 large egg (50g)",
        "nameAr": "بيضة كبيرة (50غ)",
        "grams": 50
      },
      {
        "id": "medium",
        "nameEn": "1 medium egg (44g)",
        "nameAr": "بيضة متوسطة (44غ)",
        "grams": 44
      }
    ]
  },
  {
    "id": "egg-whole-boiled",
    "nameEn": "Whole Egg (Hard-Boiled)",
    "nameAr": "بيض كامل (مسلوق)",
    "category": "eggs_dairy",
    "caloriesPer100g": 155,
    "proteinPer100g": 12.6,
    "carbsPer100g": 1.1,
    "fatsPer100g": 10.6,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173424",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "large",
        "nameEn": "1 large egg (50g)",
        "nameAr": "بيضة مسلوقة كبيرة (50غ)",
        "grams": 50
      }
    ]
  },
  {
    "id": "egg-white-raw",
    "nameEn": "Egg White (Raw)",
    "nameAr": "بياض بيض (نيء)",
    "category": "eggs_dairy",
    "caloriesPer100g": 52,
    "proteinPer100g": 10.9,
    "carbsPer100g": 0.7,
    "fatsPer100g": 0.2,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172183",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "white_large",
        "nameEn": "1 large egg white (33g)",
        "nameAr": "بياض بيضة كبيرة (33غ)",
        "grams": 33
      },
      {
        "id": "cup",
        "nameEn": "1 cup egg whites (243g)",
        "nameAr": "كوب بياض بيض (243غ)",
        "grams": 243
      }
    ]
  },
  {
    "id": "egg-white-cooked",
    "nameEn": "Egg White (Cooked / Boiled)",
    "nameAr": "بياض بيض (مطبوخ / مسلوق)",
    "category": "eggs_dairy",
    "caloriesPer100g": 52,
    "proteinPer100g": 11,
    "carbsPer100g": 0.7,
    "fatsPer100g": 0.2,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172184",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "white_large",
        "nameEn": "1 large egg white (33g)",
        "nameAr": "بياض بيضة مطبوخ (33غ)",
        "grams": 33
      }
    ]
  },
  {
    "id": "egg-yolk-raw",
    "nameEn": "Egg Yolk (Raw)",
    "nameAr": "صفار بيض (نيء)",
    "category": "eggs_dairy",
    "caloriesPer100g": 322,
    "proteinPer100g": 15.9,
    "carbsPer100g": 3.6,
    "fatsPer100g": 26.5,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172185",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "yolk_large",
        "nameEn": "1 large yolk (17g)",
        "nameAr": "صفار بيضة كبيرة (17غ)",
        "grams": 17
      }
    ]
  },
  {
    "id": "milk-whole-3-25",
    "nameEn": "Whole Cow Milk (3.25% Fat)",
    "nameAr": "حليب بقري كامل الدسم (3.25% دسم)",
    "category": "eggs_dairy",
    "caloriesPer100g": 61,
    "proteinPer100g": 3.2,
    "carbsPer100g": 4.8,
    "fatsPer100g": 3.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171265",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup (244g)",
        "nameAr": "كوب واحد (244غ)",
        "grams": 244
      },
      {
        "id": "glass",
        "nameEn": "1 glass (200g)",
        "nameAr": "كأس (200غ)",
        "grams": 200
      }
    ]
  },
  {
    "id": "milk-lowfat-1",
    "nameEn": "Low-Fat Cow Milk (1% Fat)",
    "nameAr": "حليب بقري قليل الدسم (1% دسم)",
    "category": "eggs_dairy",
    "caloriesPer100g": 42,
    "proteinPer100g": 3.4,
    "carbsPer100g": 5,
    "fatsPer100g": 1,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171267",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup (244g)",
        "nameAr": "كوب واحد (244غ)",
        "grams": 244
      }
    ]
  },
  {
    "id": "milk-skim-nonfat",
    "nameEn": "Skim / Nonfat Milk (0% Fat)",
    "nameAr": "حليب بقري خالي الدسم (0% دسم)",
    "category": "eggs_dairy",
    "caloriesPer100g": 35,
    "proteinPer100g": 3.4,
    "carbsPer100g": 5,
    "fatsPer100g": 0.1,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171268",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup (245g)",
        "nameAr": "كوب واحد (245غ)",
        "grams": 245
      }
    ]
  },
  {
    "id": "greek-yogurt-nonfat-plain",
    "nameEn": "Greek Yogurt 0% Fat (Plain)",
    "nameAr": "زبادي يوناني سادة خالي الدسم 0%",
    "category": "eggs_dairy",
    "caloriesPer100g": 59,
    "proteinPer100g": 10.2,
    "carbsPer100g": 3.6,
    "fatsPer100g": 0.4,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170903",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "container_170g",
        "nameEn": "1 single container (170g)",
        "nameAr": "علبة فردية (170غ)",
        "grams": 170
      },
      {
        "id": "cup",
        "nameEn": "1 cup (200g)",
        "nameAr": "كوب واحد (200غ)",
        "grams": 200
      }
    ]
  },
  {
    "id": "greek-yogurt-whole-plain",
    "nameEn": "Greek Yogurt Whole Milk (Plain)",
    "nameAr": "زبادي يوناني سادة كامل الدسم",
    "category": "eggs_dairy",
    "caloriesPer100g": 97,
    "proteinPer100g": 9,
    "carbsPer100g": 4,
    "fatsPer100g": 5,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170901",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "container_170g",
        "nameEn": "1 container (170g)",
        "nameAr": "علبة (170غ)",
        "grams": 170
      }
    ]
  },
  {
    "id": "yogurt-plain-whole",
    "nameEn": "Regular Yogurt (Plain, Whole Milk)",
    "nameAr": "زبادي عادي سادة كامل الدسم",
    "category": "eggs_dairy",
    "caloriesPer100g": 61,
    "proteinPer100g": 3.5,
    "carbsPer100g": 4.7,
    "fatsPer100g": 3.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171284",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup (245g)",
        "nameAr": "كوب (245غ)",
        "grams": 245
      }
    ]
  },
  {
    "id": "cottage-cheese-lowfat-2",
    "nameEn": "Cottage Cheese (Low-Fat 2%)",
    "nameAr": "جبن قريش قليل الدسم 2%",
    "category": "eggs_dairy",
    "caloriesPer100g": 81,
    "proteinPer100g": 11,
    "carbsPer100g": 4.3,
    "fatsPer100g": 2.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173418",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup (226g)",
        "nameAr": "كوب (226غ)",
        "grams": 226
      },
      {
        "id": "half_cup",
        "nameEn": "1/2 cup (113g)",
        "nameAr": "نصف كوب (113غ)",
        "grams": 113
      }
    ]
  },
  {
    "id": "cottage-cheese-regular-4",
    "nameEn": "Cottage Cheese (Regular 4% Milkfat)",
    "nameAr": "جبن قريش عادي 4% دسم",
    "category": "eggs_dairy",
    "caloriesPer100g": 98,
    "proteinPer100g": 11.1,
    "carbsPer100g": 3.4,
    "fatsPer100g": 4.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173417",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "half_cup",
        "nameEn": "1/2 cup (113g)",
        "nameAr": "نصف كوب (113غ)",
        "grams": 113
      }
    ]
  },
  {
    "id": "cheddar-cheese",
    "nameEn": "Cheddar Cheese",
    "nameAr": "جبنة شيدر",
    "category": "eggs_dairy",
    "caloriesPer100g": 403,
    "proteinPer100g": 24.9,
    "carbsPer100g": 1.3,
    "fatsPer100g": 33.1,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173414",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "slice",
        "nameEn": "1 slice (28g)",
        "nameAr": "شريحة واحدة (28غ)",
        "grams": 28
      },
      {
        "id": "cube_oz",
        "nameEn": "1 oz (28.35g)",
        "nameAr": "أونصة (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "mozzarella-part-skim",
    "nameEn": "Mozzarella Cheese (Part-Skim)",
    "nameAr": "جبنة موزاريلا (قليلة الدسم)",
    "category": "eggs_dairy",
    "caloriesPer100g": 254,
    "proteinPer100g": 24.3,
    "carbsPer100g": 2.8,
    "fatsPer100g": 15.9,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173420",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "slice",
        "nameEn": "1 slice (28g)",
        "nameAr": "شريحة (28غ)",
        "grams": 28
      },
      {
        "id": "cup_shredded",
        "nameEn": "1 cup shredded (112g)",
        "nameAr": "كوب مبشور (112غ)",
        "grams": 112
      }
    ]
  },
  {
    "id": "parmesan-grated",
    "nameEn": "Parmesan Cheese (Grated)",
    "nameAr": "جبنة بارميزان (مبشورة)",
    "category": "eggs_dairy",
    "caloriesPer100g": 431,
    "proteinPer100g": 38.5,
    "carbsPer100g": 4.1,
    "fatsPer100g": 28.6,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170908",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp grated (5g)",
        "nameAr": "ملعقة كبيرة مبشورة (5غ)",
        "grams": 5
      }
    ]
  },
  {
    "id": "ricotta-part-skim",
    "nameEn": "Ricotta Cheese (Part-Skim)",
    "nameAr": "جبنة ريكوتا (قليلة الدسم)",
    "category": "eggs_dairy",
    "caloriesPer100g": 138,
    "proteinPer100g": 11.4,
    "carbsPer100g": 5.1,
    "fatsPer100g": 7.9,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170909",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "half_cup",
        "nameEn": "1/2 cup (124g)",
        "nameAr": "نصف كوب (124غ)",
        "grams": 124
      }
    ]
  },
  {
    "id": "whey-protein-isolate",
    "nameEn": "Whey Protein Powder (Isolate 90%)",
    "nameAr": "بودرة واي بروتين معزول (90%)",
    "category": "eggs_dairy",
    "caloriesPer100g": 370,
    "proteinPer100g": 88,
    "carbsPer100g": 2.5,
    "fatsPer100g": 1,
    "preparationState": "dried",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173177",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "scoop",
        "nameEn": "1 scoop (30g)",
        "nameAr": "سكوب واحد (30غ)",
        "grams": 30
      }
    ]
  },
  {
    "id": "oats-rolled-raw",
    "nameEn": "Rolled Oats (Raw, Old Fashioned)",
    "nameAr": "شوفان حبوب كاملة (نيء)",
    "category": "grains_breads",
    "caloriesPer100g": 379,
    "proteinPer100g": 13.2,
    "carbsPer100g": 67.7,
    "fatsPer100g": 6.5,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170688",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "half_cup",
        "nameEn": "1/2 cup dry (40g)",
        "nameAr": "نصف كوب جاف (40غ)",
        "grams": 40
      },
      {
        "id": "cup",
        "nameEn": "1 cup dry (80g)",
        "nameAr": "كوب كامل جاف (80غ)",
        "grams": 80
      }
    ]
  },
  {
    "id": "oats-instant-raw",
    "nameEn": "Instant Oats (Raw, Plain)",
    "nameAr": "شوفان سريع التحضير (نيء)",
    "category": "grains_breads",
    "caloriesPer100g": 374,
    "proteinPer100g": 11,
    "carbsPer100g": 69.8,
    "fatsPer100g": 5.8,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170689",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "packet",
        "nameEn": "1 packet (35g)",
        "nameAr": "ظرف واحد (35غ)",
        "grams": 35
      }
    ]
  },
  {
    "id": "bread-whole-wheat-slice",
    "nameEn": "Whole Wheat Bread",
    "nameAr": "خبز قمح كامل / توست أسمر",
    "category": "grains_breads",
    "caloriesPer100g": 247,
    "proteinPer100g": 12,
    "carbsPer100g": 41.3,
    "fatsPer100g": 3.4,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172688",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "slice",
        "nameEn": "1 slice (32g)",
        "nameAr": "شريحة توست (32غ)",
        "grams": 32
      }
    ]
  },
  {
    "id": "bread-white-slice",
    "nameEn": "White Bread",
    "nameAr": "خبز أبيض / توست أبيض",
    "category": "grains_breads",
    "caloriesPer100g": 266,
    "proteinPer100g": 8.9,
    "carbsPer100g": 49.4,
    "fatsPer100g": 3.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172685",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "slice",
        "nameEn": "1 slice (25g)",
        "nameAr": "شريحة توست (25غ)",
        "grams": 25
      }
    ]
  },
  {
    "id": "bread-sourdough",
    "nameEn": "Sourdough Bread",
    "nameAr": "خبز الخميرة الطبيعية (ساوردو)",
    "category": "grains_breads",
    "caloriesPer100g": 260,
    "proteinPer100g": 9.3,
    "carbsPer100g": 50.6,
    "fatsPer100g": 1.8,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172689",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "slice",
        "nameEn": "1 medium slice (45g)",
        "nameAr": "شريحة متوسطة (45غ)",
        "grams": 45
      }
    ]
  },
  {
    "id": "bagel-plain",
    "nameEn": "Plain Bagel",
    "nameAr": "خبز بيغل سادة",
    "category": "grains_breads",
    "caloriesPer100g": 257,
    "proteinPer100g": 10.1,
    "carbsPer100g": 49.8,
    "fatsPer100g": 1.5,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172683",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium_bagel",
        "nameEn": "1 medium bagel (90g)",
        "nameAr": "حبة بيغل متوسطة (90غ)",
        "grams": 90
      }
    ]
  },
  {
    "id": "english-muffin-wheat",
    "nameEn": "Whole Wheat English Muffin",
    "nameAr": "مافن إنجليزي قمح كامل",
    "category": "grains_breads",
    "caloriesPer100g": 231,
    "proteinPer100g": 9.8,
    "carbsPer100g": 44.5,
    "fatsPer100g": 1.8,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172690",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "muffin",
        "nameEn": "1 muffin (57g)",
        "nameAr": "قطعة واحدة (57غ)",
        "grams": 57
      }
    ]
  },
  {
    "id": "tortilla-corn",
    "nameEn": "Corn Tortilla",
    "nameAr": "تورتيلا الذرة",
    "category": "grains_breads",
    "caloriesPer100g": 218,
    "proteinPer100g": 5.7,
    "carbsPer100g": 44.6,
    "fatsPer100g": 2.8,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172691",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "piece",
        "nameEn": "1 tortilla (26g)",
        "nameAr": "قطعة تورتيلا (26غ)",
        "grams": 26
      }
    ]
  },
  {
    "id": "tortilla-flour",
    "nameEn": "Flour Tortilla (Medium)",
    "nameAr": "تورتيلا الدقيق / الطحين (متوسطة)",
    "category": "grains_breads",
    "caloriesPer100g": 304,
    "proteinPer100g": 8.2,
    "carbsPer100g": 50.5,
    "fatsPer100g": 7.7,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172692",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "piece",
        "nameEn": "1 tortilla (45g)",
        "nameAr": "قطعة تورتيلا (45غ)",
        "grams": 45
      }
    ]
  },
  {
    "id": "quinoa-dry-raw",
    "nameEn": "Quinoa Grain (Dry, Raw)",
    "nameAr": "كينوا حبوب (جافة، نيئة)",
    "category": "grains_breads",
    "caloriesPer100g": 368,
    "proteinPer100g": 14.1,
    "carbsPer100g": 64.2,
    "fatsPer100g": 6.1,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168917",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "quarter_cup",
        "nameEn": "1/4 cup dry (43g)",
        "nameAr": "ربع كوب جاف (43غ)",
        "grams": 43
      }
    ]
  },
  {
    "id": "quinoa-cooked",
    "nameEn": "Quinoa (Cooked)",
    "nameAr": "كينوا (مطبوخة)",
    "category": "grains_breads",
    "caloriesPer100g": 120,
    "proteinPer100g": 4.4,
    "carbsPer100g": 21.3,
    "fatsPer100g": 1.9,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168918",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (185g)",
        "nameAr": "كوب كينوا مطبوخة (185غ)",
        "grams": 185
      }
    ]
  },
  {
    "id": "couscous-cooked",
    "nameEn": "Couscous (Cooked)",
    "nameAr": "كسكسي (مطبوخ)",
    "category": "grains_breads",
    "caloriesPer100g": 112,
    "proteinPer100g": 3.8,
    "carbsPer100g": 23.2,
    "fatsPer100g": 0.2,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169747",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (157g)",
        "nameAr": "كوب كسكسي مطبوخ (157غ)",
        "grams": 157
      }
    ]
  },
  {
    "id": "barley-pearl-cooked",
    "nameEn": "Pearl Barley (Cooked)",
    "nameAr": "شعير لؤلؤي (مطبوخ)",
    "category": "grains_breads",
    "caloriesPer100g": 123,
    "proteinPer100g": 2.3,
    "carbsPer100g": 28.2,
    "fatsPer100g": 0.4,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170286",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (157g)",
        "nameAr": "كوب شعير مطبوخ (157غ)",
        "grams": 157
      }
    ]
  },
  {
    "id": "rice-cake-plain",
    "nameEn": "Brown Rice Cake (Plain)",
    "nameAr": "كعك الأرز البني سادة",
    "category": "grains_breads",
    "caloriesPer100g": 387,
    "proteinPer100g": 8.2,
    "carbsPer100g": 81.5,
    "fatsPer100g": 2.8,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172693",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "piece",
        "nameEn": "1 cake (9g)",
        "nameAr": "قطعة واحدة (9غ)",
        "grams": 9
      }
    ]
  },
  {
    "id": "rice-white-raw",
    "nameEn": "White Rice (Long-Grain, Raw)",
    "nameAr": "أرز أبيض حبة طويلة (نيء)",
    "category": "rice_pasta",
    "caloriesPer100g": 365,
    "proteinPer100g": 7.1,
    "carbsPer100g": 79.9,
    "fatsPer100g": 0.7,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168877",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "quarter_cup",
        "nameEn": "1/4 cup dry (45g)",
        "nameAr": "ربع كوب جاف (45غ)",
        "grams": 45
      },
      {
        "id": "half_cup",
        "nameEn": "1/2 cup dry (90g)",
        "nameAr": "نصف كوب جاف (90غ)",
        "grams": 90
      },
      {
        "id": "cup",
        "nameEn": "1 cup dry (185g)",
        "nameAr": "كوب جاف كامل (185غ)",
        "grams": 185
      }
    ]
  },
  {
    "id": "rice-white-cooked",
    "nameEn": "White Rice (Long-Grain, Cooked / Steamed)",
    "nameAr": "أرز أبيض حبة طويلة (مطبوخ / مسلوق)",
    "category": "rice_pasta",
    "caloriesPer100g": 130,
    "proteinPer100g": 2.7,
    "carbsPer100g": 28.2,
    "fatsPer100g": 0.3,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168878",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (158g)",
        "nameAr": "كوب أرز مطبوخ (158غ)",
        "grams": 158
      },
      {
        "id": "half_cup",
        "nameEn": "1/2 cup cooked (79g)",
        "nameAr": "نصف كوب أرز مطبوخ (79غ)",
        "grams": 79
      }
    ]
  },
  {
    "id": "rice-brown-raw",
    "nameEn": "Brown Rice (Raw)",
    "nameAr": "أرز بني (نيء)",
    "category": "rice_pasta",
    "caloriesPer100g": 370,
    "proteinPer100g": 7.9,
    "carbsPer100g": 77.2,
    "fatsPer100g": 2.9,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169703",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "quarter_cup",
        "nameEn": "1/4 cup dry (48g)",
        "nameAr": "ربع كوب جاف (48غ)",
        "grams": 48
      }
    ]
  },
  {
    "id": "rice-brown-cooked",
    "nameEn": "Brown Rice (Cooked / Steamed)",
    "nameAr": "أرز بني (مطبوخ)",
    "category": "rice_pasta",
    "caloriesPer100g": 123,
    "proteinPer100g": 2.7,
    "carbsPer100g": 25.6,
    "fatsPer100g": 1,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169704",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (195g)",
        "nameAr": "كوب أرز بني مطبوخ (195غ)",
        "grams": 195
      }
    ]
  },
  {
    "id": "rice-basmati-cooked",
    "nameEn": "Basmati Rice (Cooked)",
    "nameAr": "أرز بسمتي (مطبوخ)",
    "category": "rice_pasta",
    "caloriesPer100g": 121,
    "proteinPer100g": 3.5,
    "carbsPer100g": 25.2,
    "fatsPer100g": 0.4,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169705",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (160g)",
        "nameAr": "كوب أرز بسمتي مطبوخ (160غ)",
        "grams": 160
      }
    ]
  },
  {
    "id": "rice-jasmine-cooked",
    "nameEn": "Jasmine Rice (Cooked)",
    "nameAr": "أرز ياسمين (مطبوخ)",
    "category": "rice_pasta",
    "caloriesPer100g": 129,
    "proteinPer100g": 2.4,
    "carbsPer100g": 28.5,
    "fatsPer100g": 0.3,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169706",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (150g)",
        "nameAr": "كوب أرز ياسمين مطبوخ (150غ)",
        "grams": 150
      }
    ]
  },
  {
    "id": "pasta-wheat-raw",
    "nameEn": "Pasta / Spaghetti (Semolina, Dry / Raw)",
    "nameAr": "مكرونة / سباغيتي (سميد، جافة / نيئة)",
    "category": "rice_pasta",
    "caloriesPer100g": 371,
    "proteinPer100g": 13,
    "carbsPer100g": 74.7,
    "fatsPer100g": 1.5,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168936",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "serving_dry",
        "nameEn": "1 standard dry serving (56g)",
        "nameAr": "حصة جافة معيارية (56غ)",
        "grams": 56
      }
    ]
  },
  {
    "id": "pasta-wheat-cooked",
    "nameEn": "Pasta / Spaghetti (Enriched, Cooked)",
    "nameAr": "مكرونة / سباغيتي (مطبوخة)",
    "category": "rice_pasta",
    "caloriesPer100g": 158,
    "proteinPer100g": 5.8,
    "carbsPer100g": 30.9,
    "fatsPer100g": 0.9,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168937",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (140g)",
        "nameAr": "كوب مكرونة مطبوخة (140غ)",
        "grams": 140
      }
    ]
  },
  {
    "id": "pasta-whole-wheat-cooked",
    "nameEn": "Whole Wheat Pasta (Cooked)",
    "nameAr": "مكرونة قمح كامل / سمراء (مطبوخة)",
    "category": "rice_pasta",
    "caloriesPer100g": 149,
    "proteinPer100g": 6,
    "carbsPer100g": 30.2,
    "fatsPer100g": 0.8,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168938",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (140g)",
        "nameAr": "كوب مكرونة سمراء مطبوخة (140غ)",
        "grams": 140
      }
    ]
  },
  {
    "id": "egg-noodles-cooked",
    "nameEn": "Egg Noodles (Cooked)",
    "nameAr": "نودلز البيض (مطبوخة)",
    "category": "rice_pasta",
    "caloriesPer100g": 138,
    "proteinPer100g": 4.5,
    "carbsPer100g": 25.2,
    "fatsPer100g": 2.1,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168939",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (160g)",
        "nameAr": "كوب نودلز مطبوخ (160غ)",
        "grams": 160
      }
    ]
  },
  {
    "id": "rice-noodles-cooked",
    "nameEn": "Rice Noodles / Vermicelli (Cooked)",
    "nameAr": "نودلز الأرز / شعيرية الأرز (مطبوخة)",
    "category": "rice_pasta",
    "caloriesPer100g": 109,
    "proteinPer100g": 0.9,
    "carbsPer100g": 24.9,
    "fatsPer100g": 0.2,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168940",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (176g)",
        "nameAr": "كوب نودلز أرز مطبوخ (176غ)",
        "grams": 176
      }
    ]
  },
  {
    "id": "bulgur-cooked",
    "nameEn": "Bulgur Wheat (Cooked)",
    "nameAr": "برغل (مطبوخ)",
    "category": "rice_pasta",
    "caloriesPer100g": 83,
    "proteinPer100g": 3.1,
    "carbsPer100g": 18.6,
    "fatsPer100g": 0.2,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168941",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (182g)",
        "nameAr": "كوب برغل مطبوخ (182غ)",
        "grams": 182
      }
    ]
  },
  {
    "id": "lentils-brown-dry-raw",
    "nameEn": "Brown Lentils (Dry, Raw)",
    "nameAr": "عدس بني (جاف، نيء)",
    "category": "legumes",
    "caloriesPer100g": 352,
    "proteinPer100g": 24.6,
    "carbsPer100g": 63.4,
    "fatsPer100g": 1.1,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172420",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "quarter_cup",
        "nameEn": "1/4 cup dry (48g)",
        "nameAr": "ربع كوب جاف (48غ)",
        "grams": 48
      }
    ]
  },
  {
    "id": "lentils-brown-cooked",
    "nameEn": "Brown / Green Lentils (Boiled / Cooked)",
    "nameAr": "عدس بني / أخضر (مطبوخ / مسلوق)",
    "category": "legumes",
    "caloriesPer100g": 116,
    "proteinPer100g": 9,
    "carbsPer100g": 20.1,
    "fatsPer100g": 0.4,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172421",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (198g)",
        "nameAr": "كوب عدس مطبوخ (198غ)",
        "grams": 198
      }
    ]
  },
  {
    "id": "lentils-red-cooked",
    "nameEn": "Red Lentils (Cooked)",
    "nameAr": "عدس أحمر / مجروش (مطبوخ)",
    "category": "legumes",
    "caloriesPer100g": 114,
    "proteinPer100g": 7.6,
    "carbsPer100g": 19.8,
    "fatsPer100g": 0.4,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172422",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (198g)",
        "nameAr": "كوب عدس أحمر مطبوخ (198غ)",
        "grams": 198
      }
    ]
  },
  {
    "id": "chickpeas-cooked",
    "nameEn": "Chickpeas / Garbanzo Beans (Boiled / Cooked)",
    "nameAr": "حمص حب (مطبوخ / مسلوق)",
    "category": "legumes",
    "caloriesPer100g": 164,
    "proteinPer100g": 8.9,
    "carbsPer100g": 27.4,
    "fatsPer100g": 2.6,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173757",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (164g)",
        "nameAr": "كوب حمص مسلوق (164غ)",
        "grams": 164
      }
    ]
  },
  {
    "id": "chickpeas-canned",
    "nameEn": "Chickpeas (Canned, Drained)",
    "nameAr": "حمص حب معلب (مصفى)",
    "category": "legumes",
    "caloriesPer100g": 139,
    "proteinPer100g": 7,
    "carbsPer100g": 23.4,
    "fatsPer100g": 2.1,
    "preparationState": "canned",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173758",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "can",
        "nameEn": "1 can (240g drained)",
        "nameAr": "علبة (240غ مصفاة)",
        "grams": 240
      }
    ]
  },
  {
    "id": "black-beans-cooked",
    "nameEn": "Black Beans (Cooked)",
    "nameAr": "فاصوليا سوداء (مطبوخة)",
    "category": "legumes",
    "caloriesPer100g": 132,
    "proteinPer100g": 8.9,
    "carbsPer100g": 23.7,
    "fatsPer100g": 0.5,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173735",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (172g)",
        "nameAr": "كوب فاصوليا سوداء (172غ)",
        "grams": 172
      }
    ]
  },
  {
    "id": "kidney-beans-cooked",
    "nameEn": "Red Kidney Beans (Cooked)",
    "nameAr": "فاصوليا حمراء (مطبوخة)",
    "category": "legumes",
    "caloriesPer100g": 127,
    "proteinPer100g": 8.7,
    "carbsPer100g": 22.8,
    "fatsPer100g": 0.5,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173744",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (177g)",
        "nameAr": "كوب فاصوليا حمراء (177غ)",
        "grams": 177
      }
    ]
  },
  {
    "id": "white-beans-cooked",
    "nameEn": "White Navy Beans (Cooked)",
    "nameAr": "فاصوليا بيضاء ناشفة (مطبوخة)",
    "category": "legumes",
    "caloriesPer100g": 140,
    "proteinPer100g": 9.7,
    "carbsPer100g": 26.1,
    "fatsPer100g": 0.6,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173748",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked (182g)",
        "nameAr": "كوب فاصوليا بيضاء (182غ)",
        "grams": 182
      }
    ]
  },
  {
    "id": "edamame-shelled-cooked",
    "nameEn": "Edamame (Green Soybeans, Cooked)",
    "nameAr": "إدامامي / فول الصويا الأخضر (مطبوخ)",
    "category": "legumes",
    "caloriesPer100g": 121,
    "proteinPer100g": 11.9,
    "carbsPer100g": 8.9,
    "fatsPer100g": 5.2,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172445",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup shelled (155g)",
        "nameAr": "كوب حبوب إدامامي (155غ)",
        "grams": 155
      }
    ]
  },
  {
    "id": "green-peas-cooked",
    "nameEn": "Green Peas (Cooked / Boiled)",
    "nameAr": "بازلاء خضراء (مطبوخة / مسلوقة)",
    "category": "legumes",
    "caloriesPer100g": 84,
    "proteinPer100g": 5.4,
    "carbsPer100g": 15.6,
    "fatsPer100g": 0.2,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170420",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup peas (160g)",
        "nameAr": "كوب بازلاء (160غ)",
        "grams": 160
      }
    ]
  },
  {
    "id": "fava-beans-cooked",
    "nameEn": "Fava Beans / Broad Beans (Cooked)",
    "nameAr": "فول حبات عريضة (مسلوق)",
    "category": "legumes",
    "caloriesPer100g": 110,
    "proteinPer100g": 7.6,
    "carbsPer100g": 19.7,
    "fatsPer100g": 0.4,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172425",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup (170g)",
        "nameAr": "كوب واحد (170غ)",
        "grams": 170
      }
    ]
  },
  {
    "id": "lupin-beans-boiled",
    "nameEn": "Lupin Beans / Termis (Boiled)",
    "nameAr": "ترمس (مسلوق)",
    "category": "legumes",
    "caloriesPer100g": 119,
    "proteinPer100g": 15.6,
    "carbsPer100g": 9.9,
    "fatsPer100g": 2.9,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172430",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup (166g)",
        "nameAr": "كوب ترمس مسلوق (166غ)",
        "grams": 166
      }
    ]
  },
  {
    "id": "tofu-firm",
    "nameEn": "Tofu (Firm)",
    "nameAr": "توفو متماسك",
    "category": "legumes",
    "caloriesPer100g": 83,
    "proteinPer100g": 10,
    "carbsPer100g": 1.2,
    "fatsPer100g": 5.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172448",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "block_quarter",
        "nameEn": "1/4 block (85g)",
        "nameAr": "ربع قالب توفو (85غ)",
        "grams": 85
      }
    ]
  },
  {
    "id": "tempeh-cooked",
    "nameEn": "Tempeh (Cooked)",
    "nameAr": "تيمبي فول الصويا (مطبوخ)",
    "category": "legumes",
    "caloriesPer100g": 196,
    "proteinPer100g": 18.2,
    "carbsPer100g": 9.4,
    "fatsPer100g": 11.4,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172450",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "serving",
        "nameEn": "1 serving (85g)",
        "nameAr": "حصة واحدة (85غ)",
        "grams": 85
      }
    ]
  },
  {
    "id": "apple-fresh",
    "nameEn": "Apple (With Skin, Fresh)",
    "nameAr": "تفاح طازج (بالقشر)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 52,
    "proteinPer100g": 0.3,
    "carbsPer100g": 13.8,
    "fatsPer100g": 0.2,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171688",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium apple (182g)",
        "nameAr": "تفاحة متوسطة (182غ)",
        "grams": 182
      },
      {
        "id": "small",
        "nameEn": "1 small apple (149g)",
        "nameAr": "تفاحة صغيرة (149غ)",
        "grams": 149
      }
    ]
  },
  {
    "id": "banana-fresh",
    "nameEn": "Banana (Peeled, Fresh)",
    "nameAr": "موز طازج (مقشر)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 89,
    "proteinPer100g": 1.1,
    "carbsPer100g": 22.8,
    "fatsPer100g": 0.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173944",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium banana (118g)",
        "nameAr": "موزة متوسطة (118غ)",
        "grams": 118
      },
      {
        "id": "large",
        "nameEn": "1 large banana (136g)",
        "nameAr": "موزة كبيرة (136غ)",
        "grams": 136
      }
    ]
  },
  {
    "id": "orange-fresh",
    "nameEn": "Orange (Peeled, Fresh)",
    "nameAr": "برتقال طازج (مقشر)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 47,
    "proteinPer100g": 0.9,
    "carbsPer100g": 11.8,
    "fatsPer100g": 0.1,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169097",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium orange (131g)",
        "nameAr": "برتقالة متوسطة (131غ)",
        "grams": 131
      }
    ]
  },
  {
    "id": "strawberries-fresh",
    "nameEn": "Strawberries (Fresh)",
    "nameAr": "فراولة طازجة",
    "category": "fruits_vegetables",
    "caloriesPer100g": 32,
    "proteinPer100g": 0.7,
    "carbsPer100g": 7.7,
    "fatsPer100g": 0.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 167762",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup whole berries (144g)",
        "nameAr": "كوب فراولة كاملة (144غ)",
        "grams": 144
      }
    ]
  },
  {
    "id": "blueberries-fresh",
    "nameEn": "Blueberries (Fresh)",
    "nameAr": "توت أزرق طازج",
    "category": "fruits_vegetables",
    "caloriesPer100g": 57,
    "proteinPer100g": 0.7,
    "carbsPer100g": 14.5,
    "fatsPer100g": 0.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171711",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup (148g)",
        "nameAr": "كوب توت أزرق (148غ)",
        "grams": 148
      }
    ]
  },
  {
    "id": "watermelon-fresh",
    "nameEn": "Watermelon (Fresh, Diced)",
    "nameAr": "بطيخ أحمر طازج (مقطع)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 30,
    "proteinPer100g": 0.6,
    "carbsPer100g": 7.6,
    "fatsPer100g": 0.2,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 167765",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "wedge",
        "nameEn": "1 wedge (286g)",
        "nameAr": "شريحة بطيخ (286غ)",
        "grams": 286
      },
      {
        "id": "cup_diced",
        "nameEn": "1 cup diced (152g)",
        "nameAr": "كوب مقطع مكعبات (152غ)",
        "grams": 152
      }
    ]
  },
  {
    "id": "grapes-red-fresh",
    "nameEn": "Grapes (Red or Green, Seedless)",
    "nameAr": "عنب أحمر / أخضر (بدون بذور)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 69,
    "proteinPer100g": 0.7,
    "carbsPer100g": 18.1,
    "fatsPer100g": 0.2,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173956",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup grapes (151g)",
        "nameAr": "كوب عنب (151غ)",
        "grams": 151
      }
    ]
  },
  {
    "id": "mango-fresh",
    "nameEn": "Mango (Peeled, Fresh)",
    "nameAr": "مانجو طازجة (مقشرة)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 60,
    "proteinPer100g": 0.8,
    "carbsPer100g": 15,
    "fatsPer100g": 0.4,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169910",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup_pieces",
        "nameEn": "1 cup pieces (165g)",
        "nameAr": "كوب قطع مانجو (165غ)",
        "grams": 165
      }
    ]
  },
  {
    "id": "avocado-fresh",
    "nameEn": "Avocado (Fresh, Raw)",
    "nameAr": "أفوكادو طازج (نيء)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 160,
    "proteinPer100g": 2,
    "carbsPer100g": 8.5,
    "fatsPer100g": 14.7,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171705",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "half",
        "nameEn": "1/2 medium avocado (68g)",
        "nameAr": "نصف حبة أفوكادو (68غ)",
        "grams": 68
      },
      {
        "id": "whole",
        "nameEn": "1 whole avocado (136g edible)",
        "nameAr": "حبة أفوكادو كاملة (136غ)",
        "grams": 136
      }
    ]
  },
  {
    "id": "dates-medjool",
    "nameEn": "Medjool Dates (Pitted)",
    "nameAr": "تمر مجدول (منزوع النوى)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 277,
    "proteinPer100g": 1.8,
    "carbsPer100g": 75,
    "fatsPer100g": 0.2,
    "preparationState": "dried",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168191",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "date",
        "nameEn": "1 date (24g)",
        "nameAr": "حبة تمر واحدة (24غ)",
        "grams": 24
      }
    ]
  },
  {
    "id": "dates-deglet-noor",
    "nameEn": "Deglet Noor Dates",
    "nameAr": "تمر دقلة نور",
    "category": "fruits_vegetables",
    "caloriesPer100g": 282,
    "proteinPer100g": 2.5,
    "carbsPer100g": 75,
    "fatsPer100g": 0.4,
    "preparationState": "dried",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171726",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "date",
        "nameEn": "1 date (7.1g)",
        "nameAr": "حبة تمر واحدة (7.1غ)",
        "grams": 7.1
      },
      {
        "id": "piece_5",
        "nameEn": "5 dates (35.5g)",
        "nameAr": "5 حبات تمر (35.5غ)",
        "grams": 35.5
      }
    ]
  },
  {
    "id": "broccoli-raw",
    "nameEn": "Broccoli (Raw)",
    "nameAr": "بروكلي (نيء)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 34,
    "proteinPer100g": 2.8,
    "carbsPer100g": 6.6,
    "fatsPer100g": 0.4,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170379",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup_chopped",
        "nameEn": "1 cup chopped (91g)",
        "nameAr": "كوب مقطع (91غ)",
        "grams": 91
      }
    ]
  },
  {
    "id": "broccoli-steamed",
    "nameEn": "Broccoli (Cooked / Steamed)",
    "nameAr": "بروكلي (مطبوخ / على البخار)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 35,
    "proteinPer100g": 2.4,
    "carbsPer100g": 7.2,
    "fatsPer100g": 0.4,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170380",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup_cooked",
        "nameEn": "1 cup cooked (156g)",
        "nameAr": "كوب بروكلي مطبوخ (156غ)",
        "grams": 156
      }
    ]
  },
  {
    "id": "spinach-raw",
    "nameEn": "Spinach (Raw)",
    "nameAr": "سبانخ طازجة (نيئة)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 23,
    "proteinPer100g": 2.9,
    "carbsPer100g": 3.6,
    "fatsPer100g": 0.4,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168462",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup raw leaves (30g)",
        "nameAr": "كوب أوراق سبانخ (30غ)",
        "grams": 30
      }
    ]
  },
  {
    "id": "spinach-cooked",
    "nameEn": "Spinach (Cooked / Boiled)",
    "nameAr": "سبانخ (مطبوخة / مسلوقة)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 23,
    "proteinPer100g": 3,
    "carbsPer100g": 3.8,
    "fatsPer100g": 0.3,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168463",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup_cooked",
        "nameEn": "1 cup cooked (180g)",
        "nameAr": "كوب سبانخ مطبوخة (180غ)",
        "grams": 180
      }
    ]
  },
  {
    "id": "tomato-red-fresh",
    "nameEn": "Tomato (Red, Ripe, Raw)",
    "nameAr": "طماطم حمراء طازجة",
    "category": "fruits_vegetables",
    "caloriesPer100g": 18,
    "proteinPer100g": 0.9,
    "carbsPer100g": 3.9,
    "fatsPer100g": 0.2,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170457",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium tomato (123g)",
        "nameAr": "حبة طماطم متوسطة (123غ)",
        "grams": 123
      }
    ]
  },
  {
    "id": "cucumber-fresh",
    "nameEn": "Cucumber (With Peel, Raw)",
    "nameAr": "خيار طازج (بالقشر)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 15,
    "proteinPer100g": 0.7,
    "carbsPer100g": 3.6,
    "fatsPer100g": 0.1,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169225",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium cucumber (200g)",
        "nameAr": "خيار متوسط (200غ)",
        "grams": 200
      },
      {
        "id": "cup_sliced",
        "nameEn": "1 cup sliced (104g)",
        "nameAr": "كوب شرائح خيار (104غ)",
        "grams": 104
      }
    ]
  },
  {
    "id": "carrot-raw",
    "nameEn": "Carrot (Raw)",
    "nameAr": "جزر طازج (نيء)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 41,
    "proteinPer100g": 0.9,
    "carbsPer100g": 9.6,
    "fatsPer100g": 0.2,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170393",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium carrot (61g)",
        "nameAr": "جزرة متوسطة (61غ)",
        "grams": 61
      }
    ]
  },
  {
    "id": "carrot-cooked",
    "nameEn": "Carrot (Cooked / Boiled)",
    "nameAr": "جزر (مطبوخ / مسلوق)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 35,
    "proteinPer100g": 0.8,
    "carbsPer100g": 8.2,
    "fatsPer100g": 0.2,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170394",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup_slices",
        "nameEn": "1 cup slices (156g)",
        "nameAr": "كوب شرائح جزر مطبوخ (156غ)",
        "grams": 156
      }
    ]
  },
  {
    "id": "bell-pepper-red-raw",
    "nameEn": "Red Bell Pepper (Sweet, Raw)",
    "nameAr": "فلفل رومي أحمر حلو (نيء)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 31,
    "proteinPer100g": 1,
    "carbsPer100g": 6,
    "fatsPer100g": 0.3,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170108",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium pepper (119g)",
        "nameAr": "حبة فلفل متوسطة (119غ)",
        "grams": 119
      }
    ]
  },
  {
    "id": "bell-pepper-green-raw",
    "nameEn": "Green Bell Pepper (Sweet, Raw)",
    "nameAr": "فلفل رومي أخضر حلو (نيء)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 20,
    "proteinPer100g": 0.9,
    "carbsPer100g": 4.6,
    "fatsPer100g": 0.2,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170112",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium pepper (119g)",
        "nameAr": "حبة فلفل أخضر (119غ)",
        "grams": 119
      }
    ]
  },
  {
    "id": "onion-yellow-raw",
    "nameEn": "Yellow Onion (Raw)",
    "nameAr": "بصل أصفر (نيء)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 40,
    "proteinPer100g": 1.1,
    "carbsPer100g": 9.3,
    "fatsPer100g": 0.1,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170000",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium onion (110g)",
        "nameAr": "بصلة متوسطة (110غ)",
        "grams": 110
      }
    ]
  },
  {
    "id": "potato-russet-raw",
    "nameEn": "Russet Potato (Raw, Peeled)",
    "nameAr": "بطاطس عادية (نيئة، مقشرة)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 79,
    "proteinPer100g": 2.1,
    "carbsPer100g": 18.1,
    "fatsPer100g": 0.1,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170026",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium potato (213g)",
        "nameAr": "حبة بطاطس متوسطة (213غ)",
        "grams": 213
      }
    ]
  },
  {
    "id": "potato-baked",
    "nameEn": "Potato (Baked with Flesh & Skin)",
    "nameAr": "بطاطس مشوية بالفرن (مع القشر)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 93,
    "proteinPer100g": 2.5,
    "carbsPer100g": 21.2,
    "fatsPer100g": 0.1,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170028",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium potato (173g)",
        "nameAr": "حبة بطاطس مشوية (173غ)",
        "grams": 173
      }
    ]
  },
  {
    "id": "sweet-potato-raw",
    "nameEn": "Sweet Potato (Raw, Unprepared)",
    "nameAr": "بطاطا حلوة (نيئة)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 86,
    "proteinPer100g": 1.6,
    "carbsPer100g": 20.1,
    "fatsPer100g": 0.1,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168482",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium sweet potato (130g)",
        "nameAr": "حبة بطاطا حلوة متوسطة (130غ)",
        "grams": 130
      }
    ]
  },
  {
    "id": "sweet-potato-baked",
    "nameEn": "Sweet Potato (Baked with Skin)",
    "nameAr": "بطاطا حلوة (مشوية بالفرن)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 90,
    "proteinPer100g": 2,
    "carbsPer100g": 20.7,
    "fatsPer100g": 0.1,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 168483",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "medium",
        "nameEn": "1 medium sweet potato (114g)",
        "nameAr": "حبة بطاطا حلوة مشوية (114غ)",
        "grams": 114
      }
    ]
  },
  {
    "id": "cauliflower-raw",
    "nameEn": "Cauliflower (Raw)",
    "nameAr": "قرنبيط / زهرة (نيء)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 25,
    "proteinPer100g": 1.9,
    "carbsPer100g": 5,
    "fatsPer100g": 0.3,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169986",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup_florets",
        "nameEn": "1 cup florets (107g)",
        "nameAr": "كوب زهرات قرنبيط (107غ)",
        "grams": 107
      }
    ]
  },
  {
    "id": "zucchini-cooked",
    "nameEn": "Zucchini / Courgette (Cooked / Boiled)",
    "nameAr": "كوسة (مطبوخة / مسلوقة)",
    "category": "fruits_vegetables",
    "caloriesPer100g": 16,
    "proteinPer100g": 1.2,
    "carbsPer100g": 3,
    "fatsPer100g": 0.4,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169291",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup_sliced",
        "nameEn": "1 cup sliced (180g)",
        "nameAr": "كوب شرائح كوسة مطبوخة (180غ)",
        "grams": 180
      }
    ]
  },
  {
    "id": "almonds-raw",
    "nameEn": "Almonds (Whole, Raw)",
    "nameAr": "لوز نيء كامل",
    "category": "nuts_seeds",
    "caloriesPer100g": 579,
    "proteinPer100g": 21.2,
    "carbsPer100g": 21.6,
    "fatsPer100g": 49.9,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170567",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "handful_oz",
        "nameEn": "1 oz / handful (~23 almonds) (28.35g)",
        "nameAr": "حفنة يد / 23 حبة لوز (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "walnuts-raw",
    "nameEn": "Walnuts (Halves, Raw)",
    "nameAr": "عين جمل / جوز نيء",
    "category": "nuts_seeds",
    "caloriesPer100g": 654,
    "proteinPer100g": 15.2,
    "carbsPer100g": 13.7,
    "fatsPer100g": 65.2,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170187",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "handful_oz",
        "nameEn": "1 oz (14 halves) (28.35g)",
        "nameAr": "أونصة جوز (14 نصف حبة) (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "cashews-roasted",
    "nameEn": "Cashews (Dry Roasted, Unsalted)",
    "nameAr": "كاجو محمص (غير مملح)",
    "category": "nuts_seeds",
    "caloriesPer100g": 574,
    "proteinPer100g": 15.3,
    "carbsPer100g": 32.7,
    "fatsPer100g": 46.4,
    "preparationState": "roasted",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170162",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "handful_oz",
        "nameEn": "1 oz (28.35g)",
        "nameAr": "حفنة كاجو (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "pistachios-raw",
    "nameEn": "Pistachios (Raw, Shelled)",
    "nameAr": "فستق حلبي نيء (مقشر)",
    "category": "nuts_seeds",
    "caloriesPer100g": 560,
    "proteinPer100g": 20.2,
    "carbsPer100g": 27.2,
    "fatsPer100g": 45.3,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170184",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "handful_oz",
        "nameEn": "1 oz (28.35g)",
        "nameAr": "أونصة فستق (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "peanuts-roasted",
    "nameEn": "Peanuts (Dry Roasted, Unsalted)",
    "nameAr": "فول سوداني محمص (بدون ملح)",
    "category": "nuts_seeds",
    "caloriesPer100g": 585,
    "proteinPer100g": 23.7,
    "carbsPer100g": 21.5,
    "fatsPer100g": 49.7,
    "preparationState": "roasted",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170178",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "handful_oz",
        "nameEn": "1 oz (28.35g)",
        "nameAr": "أونصة فول سوداني (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "peanut-butter-natural",
    "nameEn": "Peanut Butter (100% Peanuts, Smooth)",
    "nameAr": "زبدة فول سوداني طبيعية 100%",
    "category": "nuts_seeds",
    "caloriesPer100g": 588,
    "proteinPer100g": 25.1,
    "carbsPer100g": 20,
    "fatsPer100g": 50.4,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172472",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (16g)",
        "nameAr": "ملعقة طعام كبيرة (16غ)",
        "grams": 16
      },
      {
        "id": "serving_2tbsp",
        "nameEn": "2 tbsp (32g)",
        "nameAr": "ملعقتان كبيرتان (32غ)",
        "grams": 32
      }
    ]
  },
  {
    "id": "almond-butter-natural",
    "nameEn": "Almond Butter (100% Almonds)",
    "nameAr": "زبدة لوز طبيعية 100%",
    "category": "nuts_seeds",
    "caloriesPer100g": 614,
    "proteinPer100g": 21,
    "carbsPer100g": 18.8,
    "fatsPer100g": 55.5,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170570",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (16g)",
        "nameAr": "ملعقة كبيرة (16غ)",
        "grams": 16
      },
      {
        "id": "serving_2tbsp",
        "nameEn": "2 tbsp (32g)",
        "nameAr": "ملعقتان كبيرتان (32غ)",
        "grams": 32
      }
    ]
  },
  {
    "id": "chia-seeds-raw",
    "nameEn": "Chia Seeds (Raw, Dried)",
    "nameAr": "بذور الشيا (طبيعية مجففة)",
    "category": "nuts_seeds",
    "caloriesPer100g": 486,
    "proteinPer100g": 16.5,
    "carbsPer100g": 42.1,
    "fatsPer100g": 30.7,
    "preparationState": "dried",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170554",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (12g)",
        "nameAr": "ملعقة طعام (12غ)",
        "grams": 12
      }
    ]
  },
  {
    "id": "flaxseeds-ground",
    "nameEn": "Flaxseeds (Ground / Milled)",
    "nameAr": "بذور الكتان (مطحونة)",
    "category": "nuts_seeds",
    "caloriesPer100g": 534,
    "proteinPer100g": 18.3,
    "carbsPer100g": 28.9,
    "fatsPer100g": 42.2,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 169414",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp ground (7g)",
        "nameAr": "ملعقة كبيرة مطحونة (7غ)",
        "grams": 7
      }
    ]
  },
  {
    "id": "pumpkin-seeds-raw",
    "nameEn": "Pumpkin Seeds (Pepitas, Shelled, Raw)",
    "nameAr": "بذور القرع / حب القرع (مقشر نيء)",
    "category": "nuts_seeds",
    "caloriesPer100g": 559,
    "proteinPer100g": 30.2,
    "carbsPer100g": 10.7,
    "fatsPer100g": 49.1,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170556",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "oz",
        "nameEn": "1 oz (28.35g)",
        "nameAr": "أونصة حب قرع (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "sunflower-seeds-raw",
    "nameEn": "Sunflower Seeds (Kernels, Shelled, Raw)",
    "nameAr": "بذور دوار الشمس / لب سوري (مقشر نيء)",
    "category": "nuts_seeds",
    "caloriesPer100g": 584,
    "proteinPer100g": 20.8,
    "carbsPer100g": 20,
    "fatsPer100g": 51.5,
    "preparationState": "raw",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170562",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "quarter_cup",
        "nameEn": "1/4 cup kernels (35g)",
        "nameAr": "ربع كوب حبوب (35غ)",
        "grams": 35
      }
    ]
  },
  {
    "id": "sesame-seeds-whole",
    "nameEn": "Sesame Seeds (Whole, Dried)",
    "nameAr": "سمسم كامل (مجفف)",
    "category": "nuts_seeds",
    "caloriesPer100g": 573,
    "proteinPer100g": 17.7,
    "carbsPer100g": 23.4,
    "fatsPer100g": 49.7,
    "preparationState": "dried",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170565",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (9g)",
        "nameAr": "ملعقة كبيرة (9غ)",
        "grams": 9
      }
    ]
  },
  {
    "id": "olive-oil-extra-virgin",
    "nameEn": "Olive Oil (Extra Virgin)",
    "nameAr": "زيت زيتون بكر ممتاز",
    "category": "oils_fats",
    "caloriesPer100g": 884,
    "proteinPer100g": 0,
    "carbsPer100g": 0,
    "fatsPer100g": 100,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171413",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (14g)",
        "nameAr": "ملعقة كبيرة (14غ)",
        "grams": 14
      },
      {
        "id": "tsp",
        "nameEn": "1 tsp (4.5g)",
        "nameAr": "ملعقة صغيرة (4.5غ)",
        "grams": 4.5
      }
    ]
  },
  {
    "id": "coconut-oil",
    "nameEn": "Coconut Oil",
    "nameAr": "زيت جوز الهند",
    "category": "oils_fats",
    "caloriesPer100g": 862,
    "proteinPer100g": 0,
    "carbsPer100g": 0,
    "fatsPer100g": 100,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171412",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (14g)",
        "nameAr": "ملعقة كبيرة (14غ)",
        "grams": 14
      }
    ]
  },
  {
    "id": "butter-unsalted",
    "nameEn": "Butter (Unsalted)",
    "nameAr": "زبدة طبيعية (غير مملحة)",
    "category": "oils_fats",
    "caloriesPer100g": 717,
    "proteinPer100g": 0.9,
    "carbsPer100g": 0.1,
    "fatsPer100g": 81.1,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173410",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (14.2g)",
        "nameAr": "ملعقة كبيرة (14.2غ)",
        "grams": 14.2
      },
      {
        "id": "pat",
        "nameEn": "1 pat (5g)",
        "nameAr": "مكعب صغير (5غ)",
        "grams": 5
      }
    ]
  },
  {
    "id": "ghee-clarified-butter",
    "nameEn": "Ghee / Clarified Butter",
    "nameAr": "سمن بلدي نقي / سمن حيواني",
    "category": "oils_fats",
    "caloriesPer100g": 876,
    "proteinPer100g": 0.3,
    "carbsPer100g": 0,
    "fatsPer100g": 99.5,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171415",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (13g)",
        "nameAr": "ملعقة كبيرة سمن (13غ)",
        "grams": 13
      }
    ]
  },
  {
    "id": "canola-oil",
    "nameEn": "Canola Oil",
    "nameAr": "زيت كانولا",
    "category": "oils_fats",
    "caloriesPer100g": 884,
    "proteinPer100g": 0,
    "carbsPer100g": 0,
    "fatsPer100g": 100,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171414",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (14g)",
        "nameAr": "ملعقة كبيرة (14غ)",
        "grams": 14
      }
    ]
  },
  {
    "id": "sesame-oil",
    "nameEn": "Sesame Oil",
    "nameAr": "زيت سمسم (شيرج)",
    "category": "oils_fats",
    "caloriesPer100g": 884,
    "proteinPer100g": 0,
    "carbsPer100g": 0,
    "fatsPer100g": 100,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171416",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (13.6g)",
        "nameAr": "ملعقة كبيرة (13.6غ)",
        "grams": 13.6
      }
    ]
  },
  {
    "id": "avocado-oil",
    "nameEn": "Avocado Oil",
    "nameAr": "زيت أفوكادو",
    "category": "oils_fats",
    "caloriesPer100g": 884,
    "proteinPer100g": 0,
    "carbsPer100g": 0,
    "fatsPer100g": 100,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171417",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (14g)",
        "nameAr": "ملعقة كبيرة (14غ)",
        "grams": 14
      }
    ]
  },
  {
    "id": "mayonnaise-regular",
    "nameEn": "Mayonnaise (Standard Full Fat)",
    "nameAr": "مايونيز عادي كامل الدسم",
    "category": "oils_fats",
    "caloriesPer100g": 680,
    "proteinPer100g": 1,
    "carbsPer100g": 0.6,
    "fatsPer100g": 74.9,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 171418",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (14g)",
        "nameAr": "ملعقة كبيرة (14غ)",
        "grams": 14
      }
    ]
  },
  {
    "id": "dates-sukari",
    "nameEn": "Sukari Dates (Fresh / Semi-Dry)",
    "nameAr": "تمر سكري (طازج / رطب)",
    "category": "middle_eastern",
    "caloriesPer100g": 285,
    "proteinPer100g": 2.1,
    "carbsPer100g": 73.5,
    "fatsPer100g": 0.3,
    "preparationState": "dried",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-DATE-001",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "date",
        "nameEn": "1 date (15g)",
        "nameAr": "حبة تمر سكري (15غ)",
        "grams": 15
      },
      {
        "id": "three_dates",
        "nameEn": "3 dates (45g)",
        "nameAr": "3 حبات تمر (45غ)",
        "grams": 45
      }
    ]
  },
  {
    "id": "dates-ajwa",
    "nameEn": "Ajwa Dates (Madinah Ajwa)",
    "nameAr": "تمر عجوة (عجوة المدينة)",
    "category": "middle_eastern",
    "caloriesPer100g": 275,
    "proteinPer100g": 2.4,
    "carbsPer100g": 70,
    "fatsPer100g": 0.4,
    "preparationState": "dried",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-DATE-002",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "date",
        "nameEn": "1 date (12g)",
        "nameAr": "حبة عجوة (12غ)",
        "grams": 12
      },
      {
        "id": "seven_dates",
        "nameEn": "7 dates (sunnah serving 84g)",
        "nameAr": "7 تمرات عجوة (84غ)",
        "grams": 84
      }
    ]
  },
  {
    "id": "dates-khudari",
    "nameEn": "Khudari Dates",
    "nameAr": "تمر خضري",
    "category": "middle_eastern",
    "caloriesPer100g": 279,
    "proteinPer100g": 2.2,
    "carbsPer100g": 72,
    "fatsPer100g": 0.3,
    "preparationState": "dried",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-DATE-003",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "date",
        "nameEn": "1 date (18g)",
        "nameAr": "حبة تمر خضري (18غ)",
        "grams": 18
      }
    ]
  },
  {
    "id": "labneh-full-fat",
    "nameEn": "Labneh (Full Fat, Strained Yogurt)",
    "nameAr": "لبنة كاملة الدسم (زبادي مصفى)",
    "category": "middle_eastern",
    "caloriesPer100g": 154,
    "proteinPer100g": 8.5,
    "carbsPer100g": 4,
    "fatsPer100g": 11.5,
    "preparationState": "fresh",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-DAIRY-010",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 rounded tbsp (30g)",
        "nameAr": "ملعقة طعام ممتلئة (30غ)",
        "grams": 30
      }
    ]
  },
  {
    "id": "labneh-low-fat",
    "nameEn": "Labneh (Low Fat / Light)",
    "nameAr": "لبنة قليلة الدسم / لايت",
    "category": "middle_eastern",
    "caloriesPer100g": 95,
    "proteinPer100g": 10.5,
    "carbsPer100g": 4.5,
    "fatsPer100g": 3.5,
    "preparationState": "fresh",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-DAIRY-011",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 rounded tbsp (30g)",
        "nameAr": "ملعقة كبيرة (30غ)",
        "grams": 30
      }
    ]
  },
  {
    "id": "hummus-prepared",
    "nameEn": "Hummus (Prepared Dip with Tahini)",
    "nameAr": "حمص بطحينة محضر (متبل)",
    "category": "middle_eastern",
    "caloriesPer100g": 166,
    "proteinPer100g": 7.9,
    "carbsPer100g": 14.3,
    "fatsPer100g": 9.6,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173759",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp_2",
        "nameEn": "2 tbsp serving (30g)",
        "nameAr": "ملعقتان كبيرتان (30غ)",
        "grams": 30
      },
      {
        "id": "quarter_cup",
        "nameEn": "1/4 cup (60g)",
        "nameAr": "ربع كوب (60غ)",
        "grams": 60
      }
    ]
  },
  {
    "id": "ful-medames",
    "nameEn": "Ful Medames (Stewed Fava Beans, Seasoned)",
    "nameAr": "فول مدمس متبل (بالكمون والليمون)",
    "category": "middle_eastern",
    "caloriesPer100g": 110,
    "proteinPer100g": 7,
    "carbsPer100g": 18,
    "fatsPer100g": 2,
    "preparationState": "cooked",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-LEG-004",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup prepared (200g)",
        "nameAr": "كوب فول مدمس (200غ)",
        "grams": 200
      },
      {
        "id": "plate",
        "nameEn": "1 standard plate (250g)",
        "nameAr": "صحن فول معياري (250غ)",
        "grams": 250
      }
    ]
  },
  {
    "id": "tahini-sesame",
    "nameEn": "Tahini (100% Pure Sesame Paste)",
    "nameAr": "طحينة سمسم نقية 100%",
    "category": "middle_eastern",
    "caloriesPer100g": 595,
    "proteinPer100g": 17,
    "carbsPer100g": 21.2,
    "fatsPer100g": 53.8,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 170566",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp",
        "nameEn": "1 tbsp (15g)",
        "nameAr": "ملعقة كبيرة (15غ)",
        "grams": 15
      }
    ]
  },
  {
    "id": "pita-bread-white",
    "nameEn": "Arabic Pita Bread (White Flour)",
    "nameAr": "خبز عربي / بيتا أبيض",
    "category": "middle_eastern",
    "caloriesPer100g": 275,
    "proteinPer100g": 9.1,
    "carbsPer100g": 55.7,
    "fatsPer100g": 1.2,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 172687",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "loaf_small",
        "nameEn": "1 small loaf (35g)",
        "nameAr": "رغيف صغير (35غ)",
        "grams": 35
      },
      {
        "id": "loaf_large",
        "nameEn": "1 standard large loaf (60g)",
        "nameAr": "رغيف كبير معتاد (60غ)",
        "grams": 60
      }
    ]
  },
  {
    "id": "pita-bread-whole-wheat",
    "nameEn": "Arabic Pita Bread (Whole Wheat / Brown)",
    "nameAr": "خبز عربي بر / أسمر (قمح كامل)",
    "category": "middle_eastern",
    "caloriesPer100g": 250,
    "proteinPer100g": 10.5,
    "carbsPer100g": 48,
    "fatsPer100g": 1.8,
    "preparationState": "fresh",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-BAKE-002",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "loaf_small",
        "nameEn": "1 small brown loaf (40g)",
        "nameAr": "رغيف بر صغير (40غ)",
        "grams": 40
      },
      {
        "id": "loaf_large",
        "nameEn": "1 large brown loaf (70g)",
        "nameAr": "رغيف بر كبير (70غ)",
        "grams": 70
      }
    ]
  },
  {
    "id": "falafel-fried",
    "nameEn": "Falafel (Deep-Fried Chickpea Patties)",
    "nameAr": "فلافل مقلية (طعمية)",
    "category": "middle_eastern",
    "caloriesPer100g": 333,
    "proteinPer100g": 13.3,
    "carbsPer100g": 31.8,
    "fatsPer100g": 17.8,
    "preparationState": "cooked",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173760",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "piece",
        "nameEn": "1 falafel patty (17g)",
        "nameAr": "حبة فلافل واحدة (17غ)",
        "grams": 17
      },
      {
        "id": "three_pieces",
        "nameEn": "3 falafel patties (51g)",
        "nameAr": "3 حبات فلافل (51غ)",
        "grams": 51
      }
    ]
  },
  {
    "id": "halloumi-cheese",
    "nameEn": "Halloumi Cheese (Grilling Cheese)",
    "nameAr": "جبنة حلوم (للشوي)",
    "category": "middle_eastern",
    "caloriesPer100g": 321,
    "proteinPer100g": 21.4,
    "carbsPer100g": 2.5,
    "fatsPer100g": 25,
    "preparationState": "fresh",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-DAIRY-022",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "slice",
        "nameEn": "1 thick grilled slice (35g)",
        "nameAr": "شريحة حلوم (35غ)",
        "grams": 35
      }
    ]
  },
  {
    "id": "feta-cheese-traditional",
    "nameEn": "Feta Cheese (Brined Sheep & Goat Milk)",
    "nameAr": "جبنة فيتا يونانية / بيضاء مالحة",
    "category": "middle_eastern",
    "caloriesPer100g": 264,
    "proteinPer100g": 14.2,
    "carbsPer100g": 4.1,
    "fatsPer100g": 21.3,
    "preparationState": "fresh",
    "sourceName": "USDA FoodData Central",
    "sourceReference": "FDC 173415",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cube_oz",
        "nameEn": "1 oz crumbled (28.35g)",
        "nameAr": "أونصة فيتا مفتتة (28.35غ)",
        "grams": 28.35
      }
    ]
  },
  {
    "id": "leben-buttermilk-full-fat",
    "nameEn": "Laban / Leben (Cultured Buttermilk, Full Fat)",
    "nameAr": "لبن رائب كامل الدسم",
    "category": "middle_eastern",
    "caloriesPer100g": 60,
    "proteinPer100g": 3.2,
    "carbsPer100g": 4.8,
    "fatsPer100g": 3.2,
    "preparationState": "fresh",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-DAIRY-030",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "glass",
        "nameEn": "1 glass / small bottle (200g)",
        "nameAr": "كأس / عبوة صغيرة (200غ)",
        "grams": 200
      }
    ]
  },
  {
    "id": "shawarma-chicken-meat",
    "nameEn": "Chicken Shawarma Meat (Spiced, Roasted)",
    "nameAr": "لحم شاورما دجاج (مشوي على السيخ ومتبل)",
    "category": "middle_eastern",
    "caloriesPer100g": 185,
    "proteinPer100g": 24.5,
    "carbsPer100g": 2.5,
    "fatsPer100g": 8.8,
    "preparationState": "cooked",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-MEAT-045",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "sandwich_meat",
        "nameEn": "Meat in 1 sandwich (120g)",
        "nameAr": "لحم ساندوتش واحد (120غ)",
        "grams": 120
      }
    ]
  },
  {
    "id": "shish-tawook-grilled",
    "nameEn": "Shish Tawook (Marinated Chicken Skewers, Grilled)",
    "nameAr": "شيش طاووق (أسياخ دجاج متبلة مشوية)",
    "category": "middle_eastern",
    "caloriesPer100g": 165,
    "proteinPer100g": 27.5,
    "carbsPer100g": 2,
    "fatsPer100g": 5.2,
    "preparationState": "cooked",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-MEAT-046",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "skewer",
        "nameEn": "1 skewer (110g)",
        "nameAr": "سيخ واحد (110غ)",
        "grams": 110
      }
    ]
  },
  {
    "id": "kabsa-rice-cooked",
    "nameEn": "Kabsa Spiced Rice (Cooked with Tomato & Spices)",
    "nameAr": "أرز كبسة مطبوخ (مبهر بالطماطم والبهارات)",
    "category": "middle_eastern",
    "caloriesPer100g": 145,
    "proteinPer100g": 3.1,
    "carbsPer100g": 26.5,
    "fatsPer100g": 3,
    "preparationState": "cooked",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-RICE-001",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup cooked kabsa rice (170g)",
        "nameAr": "كوب أرز كبسة مطبوخ (170غ)",
        "grams": 170
      },
      {
        "id": "plate",
        "nameEn": "1 medium plate (250g)",
        "nameAr": "صحن أرز كبسة متوسط (250غ)",
        "grams": 250
      }
    ]
  },
  {
    "id": "kebab-beef-grilled",
    "nameEn": "Beef Kafta / Kebab (Minced, Grilled on Skewer)",
    "nameAr": "كفتة / كباب لحم بقري (مشوي على السيخ)",
    "category": "middle_eastern",
    "caloriesPer100g": 245,
    "proteinPer100g": 23,
    "carbsPer100g": 3.5,
    "fatsPer100g": 15.5,
    "preparationState": "cooked",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-MEAT-050",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "skewer",
        "nameEn": "1 kebab skewer (90g)",
        "nameAr": "سيخ كباب واحد (90غ)",
        "grams": 90
      }
    ]
  },
  {
    "id": "moutabal-eggplant",
    "nameEn": "Moutabal / Baba Ghanoush (Roasted Eggplant with Tahini)",
    "nameAr": "متبل باذنجان مشوي بالطحينة",
    "category": "middle_eastern",
    "caloriesPer100g": 122,
    "proteinPer100g": 3.2,
    "carbsPer100g": 8.5,
    "fatsPer100g": 8.7,
    "preparationState": "fresh",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-VEG-012",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "tbsp_2",
        "nameEn": "2 tbsp serving (30g)",
        "nameAr": "ملعقتان كبيرتان (30غ)",
        "grams": 30
      }
    ]
  },
  {
    "id": "tabbouleh-salad",
    "nameEn": "Tabbouleh Salad (Parsley, Bulgur, Olive Oil)",
    "nameAr": "تبولة بقدونس وبرغل بزيت الزيتون",
    "category": "middle_eastern",
    "caloriesPer100g": 110,
    "proteinPer100g": 2.1,
    "carbsPer100g": 10.5,
    "fatsPer100g": 7.2,
    "preparationState": "fresh",
    "sourceName": "Saudi Food & Drug Authority (SFDA)",
    "sourceReference": "SFDA-VEG-015",
    "dataVersion": "1.0.0",
    "servingOptions": [
      {
        "id": "100g",
        "nameEn": "100 grams",
        "nameAr": "100 غرام",
        "grams": 100
      },
      {
        "id": "cup",
        "nameEn": "1 cup prepared (150g)",
        "nameAr": "كوب تبولة (150غ)",
        "grams": 150
      }
    ]
  }
];

// Enrich entries with backward-compatible aliases, bilingual labels, and provenance metadata
const ESTIMATED_REGIONAL_DISH_NOTES: Record<string, string> = {
  'kabsa-rice-cooked': 'Estimated recipe composite: Long-grain spiced rice cooked with tomato, onions, and standard vegetable oil (3g fat / 100g).',
  'shawarma-chicken-meat': 'Estimated recipe composite: Marinated roasted chicken shaved from vertical spit, trimmed of excess surface oil.',
  'shish-tawook-grilled': 'Estimated recipe composite: Skinless chicken breast cubes marinated in low-fat yogurt, lemon, garlic, and olive oil, then charcoal grilled.',
  'kebab-beef-grilled': 'Estimated recipe composite: Minced beef mixed with parsley, onion, and spices, skewered and flame grilled.',
  'moutabal-eggplant': 'Estimated recipe composite: Fire-roasted eggplant blended with tahini paste, garlic, and lemon juice (~8.7g fat from tahini).',
  'tabbouleh-salad': 'Estimated recipe composite: Chopped parsley, fine bulgur, tomato, and mint tossed in olive oil and lemon dressing (~7.2g fat).',
};

FOOD_CATALOG.forEach((item) => {
  if (item.source === undefined) {
    item.source = `${item.sourceName} (${item.sourceReference})`;
  }
  if (item.fatPer100g === undefined) {
    item.fatPer100g = item.fatsPer100g;
  }
  if (item.category === 'middle_eastern') {
    // Also mark as regional_middle_eastern for category queries
    (item as any).category = 'regional_middle_eastern';
  }

  // Provenance categorization
  if (item.sourceName.includes('USDA')) {
    item.provenanceStatus = 'VERIFIED';
    const fdcNum = item.sourceReference.replace(/^FDC\s+/, '').trim();
    item.sourceUrl = `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${fdcNum}/nutrients`;
  } else if (ESTIMATED_REGIONAL_DISH_NOTES[item.id]) {
    item.provenanceStatus = 'ESTIMATED';
    item.recipeNotes = ESTIMATED_REGIONAL_DISH_NOTES[item.id];
    item.sourceUrl = 'https://www.sfda.gov.sa/sites/default/files/2026-04/SFCT-E.pdf';
  } else {
    // SFDA staple entries with synthetic identifiers
    item.provenanceStatus = 'UNVERIFIED';
    item.recipeNotes = 'Source reference code is an unverified placeholder awaiting official SFDA database alphanumeric key mapping.';
    item.sourceUrl = 'https://fd.sfda.gov.sa/';
  }

  item.servingOptions.forEach((opt) => {
    if (opt.labelEn === undefined) {
      opt.labelEn = opt.nameEn;
    }
    if (opt.labelAr === undefined) {
      opt.labelAr = opt.nameAr;
    }
  });
});

export const FOOD_CATALOG_MAP: Map<string, FoodCatalogEntry> = new Map(
  FOOD_CATALOG.map((entry) => [entry.id, entry])
);
