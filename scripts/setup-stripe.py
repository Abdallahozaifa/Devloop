#!/usr/bin/env python3
"""Setup Stripe products and prices for DevLoop."""
import os
import sys
from pathlib import Path

# Add parent dir for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import stripe
except ImportError:
    print("Installing stripe...")
    os.system("pip install stripe")
    import stripe

from dotenv import load_dotenv

# Load env from api/.env
env_path = Path(__file__).parent.parent / "api" / ".env"
load_dotenv(env_path)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

if not stripe.api_key:
    print("ERROR: STRIPE_SECRET_KEY not found in api/.env")
    sys.exit(1)

print("Setting up Stripe products for DevLoop...")
print(f"Using key: {stripe.api_key[:12]}...")

# Product definitions
PRODUCTS = [
    {
        "name": "DevLoop Solo",
        "description": "Autonomous QA for indie hackers - 1 project",
        "metadata": {"plan": "solo", "max_projects": "1"},
        "price": 1900,  # $19.00 in cents
        "env_key": "STRIPE_SOLO_PRICE_ID",
    },
    {
        "name": "DevLoop Pro",
        "description": "Autonomous QA for growing teams - 5 projects",
        "metadata": {"plan": "pro", "max_projects": "5"},
        "price": 3900,  # $39.00 in cents
        "env_key": "STRIPE_PRO_PRICE_ID",
    },
    {
        "name": "DevLoop Team",
        "description": "Autonomous QA for teams - Unlimited projects",
        "metadata": {"plan": "team", "max_projects": "unlimited"},
        "price": 7900,  # $79.00 in cents
        "env_key": "STRIPE_TEAM_PRICE_ID",
    },
]

created_prices = {}

for product_def in PRODUCTS:
    print(f"\nCreating {product_def['name']}...")

    # Check if product already exists
    existing = stripe.Product.search(query=f"name:'{product_def['name']}'")

    if existing.data:
        product = existing.data[0]
        print(f"  Product exists: {product.id}")
    else:
        product = stripe.Product.create(
            name=product_def["name"],
            description=product_def["description"],
            metadata=product_def["metadata"],
        )
        print(f"  Created product: {product.id}")

    # Check if price exists for this product
    prices = stripe.Price.list(product=product.id, active=True)

    matching_price = None
    for price in prices.data:
        if price.unit_amount == product_def["price"] and price.recurring:
            matching_price = price
            break

    if matching_price:
        price = matching_price
        print(f"  Price exists: {price.id}")
    else:
        price = stripe.Price.create(
            product=product.id,
            unit_amount=product_def["price"],
            currency="usd",
            recurring={"interval": "month"},
        )
        print(f"  Created price: {price.id}")

    created_prices[product_def["env_key"]] = price.id

# Update .env file
print("\n\nUpdating api/.env with price IDs...")

env_content = env_path.read_text()

for env_key, price_id in created_prices.items():
    # Replace empty value or existing value
    import re
    pattern = rf"^{env_key}=.*$"
    replacement = f"{env_key}={price_id}"

    if re.search(pattern, env_content, re.MULTILINE):
        env_content = re.sub(pattern, replacement, env_content, flags=re.MULTILINE)
    else:
        env_content += f"\n{env_key}={price_id}"

env_path.write_text(env_content)

print("\nStripe setup complete!")
print("\nPrice IDs:")
for env_key, price_id in created_prices.items():
    print(f"  {env_key}={price_id}")

print("\nYou can now start the API and use these prices for checkout.")
