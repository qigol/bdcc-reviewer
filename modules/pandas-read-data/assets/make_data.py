"""Write the food-mini lesson dataset (Food.com file layout, invented rows) under ./mnt/data/public/food-mini."""
import csv, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mnt", "data", "public", "food-mini")
os.makedirs(ROOT, exist_ok=True)

RECIPES = [
    ("chicken adobo", 1207, 60, 5501, "2019-03-02", ["60-minutes-or-less", "time-to-make", "course", "main-ingredient", "main-dish", "chicken", "easy"], 6, ["chicken thighs", "soy sauce", "vinegar", "garlic", "bay leaves", "peppercorns"]),
    ("garlic fried rice", 2318, 20, 5502, "2019-07-15", ["30-minutes-or-less", "time-to-make", "course", "side-dishes", "rice", "easy", "breakfast"], 4, ["day-old rice", "garlic", "oil", "salt"]),
    ("pancit canton", 3542, 45, 5501, "2020-01-20", ["60-minutes-or-less", "time-to-make", "course", "main-dish", "pasta", "dinner-party"], 8, ["canton noodles", "pork", "shrimp", "cabbage", "carrots", "soy sauce", "calamansi"]),
    ("leche flan", 4415, 90, 5503, "2020-05-09", ["4-hours-or-less", "time-to-make", "course", "desserts", "eggs-dairy", "dinner-party"], 7, ["egg yolks", "condensed milk", "evaporated milk", "sugar", "vanilla"]),
    ("sinigang na baboy", 5021, 75, 5504, "2020-11-30", ["4-hours-or-less", "time-to-make", "course", "main-ingredient", "soups-stews", "pork"], 9, ["pork ribs", "tamarind", "radish", "kangkong", "tomatoes", "onion", "fish sauce"]),
    ("turon", 6110, 30, 5503, "2021-04-11", ["30-minutes-or-less", "time-to-make", "course", "desserts", "fruit", "easy"], 5, ["saba bananas", "jackfruit", "spring roll wrappers", "brown sugar"]),
    ("tortang talong", 7064, 25, 5502, "2021-08-23", ["30-minutes-or-less", "time-to-make", "course", "main-ingredient", "vegetables", "easy", "breakfast"], 5, ["eggplants", "eggs", "salt", "oil"]),
    ("halo-halo", 8233, 40, 5504, "2022-02-14", ["60-minutes-or-less", "time-to-make", "course", "desserts", "no-cook", "dinner-party"], 6, ["shaved ice", "evaporated milk", "ube halaya", "sweetened beans", "leche flan", "nata de coco"]),
]

# (user_id, recipe_id, date, rating, review); rating 0 = a review left without stars (as in Food.com)
INTERACTIONS = [
    (1101, 1207, "2019-04-01", 5, "Tastes like my lola's."),
    (1388, 2318, "2019-08-02", 5, "Perfect with longganisa."),
    (1245, 1207, "2019-09-14", 4, "A bit salty, so I used less soy sauce."),
    (1101, 2318, "2019-10-05", 4, "Quick and good."),
    (1502, 1207, "2020-02-11", 5, "Made it twice this week."),
    (1245, 3542, "2020-03-03", 5, "Great for birthdays."),
    (1388, 1207, "2020-04-18", 5, "Classic."),
    (1101, 4415, "2020-06-21", 5, "Silky, no bubbles!"),
    (1388, 3542, "2020-07-07", 0, "Can I use bihon instead?"),
    (1502, 2318, "2020-08-30", 3, "Needed more garlic."),
    (1690, 1207, "2020-09-12", 4, "Good, but I prefer it drier."),
    (1502, 4415, "2020-10-25", 5, "My family loved it."),
    (1734, 2318, "2020-12-01", 4, "Easy breakfast."),
    (1245, 5021, "2020-12-24", 4, "Sour enough, add more tamarind if you like."),
    (1876, 1207, "2021-01-16", 5, "Best adobo recipe here."),
    (1690, 3542, "2021-02-02", 4, "Too much soy sauce for me."),
    (1101, 7064, "2021-03-09", 3, "Okay."),
    (1734, 4415, "2021-04-04", 4, "Took longer than 90 minutes."),
    (1388, 6110, "2021-05-01", 4, "Crispy, use more sugar."),
    (1690, 5021, "2021-06-13", 5, "Comfort food on a rainy day."),
    (1245, 7064, "2021-09-01", 4, "Simple and filling."),
    (1923, 2318, "2021-10-10", 5, "Every morning."),
    (1876, 3542, "2021-11-20", 5, "Party favorite."),
    (1502, 7064, "2022-01-08", 4, "Good with ketchup."),
    (1923, 4415, "2022-03-15", 0, "Steamed or baked?"),
    (1734, 7064, "2022-05-27", 5, "My kids eat eggplant now."),
    (1876, 5021, "2022-07-04", 3, "Missing the gabi."),
    (1923, 6110, "2022-09-18", 5, "Like the street vendor's."),
    (1690, 8233, "2022-11-11", 5, "So refreshing, \"the\" summer dessert."),
    (1876, 7064, "2023-01-29", 4, "Nice."),
]

with open(os.path.join(ROOT, "RAW_recipes.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["name", "id", "minutes", "contributor_id", "submitted", "tags", "n_steps", "ingredients", "n_ingredients"])
    for name, rid, mins, cid, sub, tags, steps, ingr in RECIPES:
        w.writerow([name, rid, mins, cid, sub, repr(tags), steps, repr(ingr), len(ingr)])

with open(os.path.join(ROOT, "RAW_interactions.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["user_id", "recipe_id", "date", "rating", "review"])
    w.writerows(INTERACTIONS)

# interactions_train.csv: the pre-split training file (rows 1-20, ratings > 0) with integer codes u and i, as in Food.com
users = sorted({r[0] for r in INTERACTIONS})
items = sorted({r[1] for r in INTERACTIONS})
with open(os.path.join(ROOT, "interactions_train.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["user_id", "recipe_id", "date", "rating", "u", "i"])
    for u, i, d, r, _ in INTERACTIONS[:20]:
        if r > 0:
            w.writerow([u, i, d, float(r), users.index(u), items.index(i)])

with open(os.path.join(ROOT, "README.txt"), "w", encoding="utf-8") as f:
    f.write("food-mini: 8 recipes and 30 interactions in the Food.com file layout.\n"
            "RAW_recipes.csv       one row per recipe (tags and ingredients are lists)\n"
            "RAW_interactions.csv  one row per review: user, recipe, date, rating (0 = no stars), text\n"
            "interactions_train.csv  a pre-split training set with integer codes u and i\n")
print("wrote", sorted(os.listdir(ROOT)))
