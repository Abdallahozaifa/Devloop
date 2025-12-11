#!/usr/bin/env /Users/hozaifaabdalla/Desktop/devloop/scripts/.venv/bin/python3
"""
Google Ads Campaign Creator for DevLoop

Creates a 7-day test campaign with $30 budget.

Prerequisites:
1. pip install google-ads
2. Run google-ads-oauth.py to get refresh token
3. Update credentials file with all values

Usage:
    python scripts/google-ads.py
"""

import os
import sys
from datetime import datetime, timedelta
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

# Configuration
CREDENTIALS_FILE = os.path.expanduser("~/Desktop/google_ads_credentials.txt")

def load_credentials():
    """Load credentials from file"""
    creds = {}
    with open(CREDENTIALS_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('{'):
                key, value = line.split('=', 1)
                creds[key] = value
    return creds

def create_google_ads_yaml(creds):
    """Create temporary google-ads.yaml config"""
    yaml_content = f"""developer_token: {creds.get('GOOGLE_ADS_DEVELOPER_TOKEN', '')}
client_id: {creds.get('GOOGLE_ADS_CLIENT_ID', '252294257522-23bhj3af5t5ibes30cslu3e679sbvn4d.apps.googleusercontent.com')}
client_secret: {creds.get('GOOGLE_ADS_CLIENT_SECRET', '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')}
refresh_token: {creds.get('GOOGLE_ADS_REFRESH_TOKEN', '')}
login_customer_id: {creds.get('GOOGLE_ADS_CUSTOMER_ID', '').replace('-', '')}
use_proto_plus: True
"""
    yaml_path = "/tmp/google-ads.yaml"
    with open(yaml_path, 'w') as f:
        f.write(yaml_content)
    return yaml_path

def create_campaign(client, customer_id):
    """Create the DevLoop search campaign"""

    # Get services
    campaign_service = client.get_service("CampaignService")
    campaign_budget_service = client.get_service("CampaignBudgetService")

    # Create budget ($4.29/day = $30/week)
    campaign_budget_operation = client.get_type("CampaignBudgetOperation")
    campaign_budget = campaign_budget_operation.create
    campaign_budget.name = f"DevLoop Budget - {datetime.now().strftime('%Y%m%d_%H%M%S')}"
    campaign_budget.amount_micros = 4_290_000  # $4.29 in micros
    campaign_budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD

    # Create budget
    budget_response = campaign_budget_service.mutate_campaign_budgets(
        customer_id=customer_id,
        operations=[campaign_budget_operation]
    )
    budget_resource = budget_response.results[0].resource_name
    print(f"Created budget: {budget_resource}")

    # Create campaign
    campaign_operation = client.get_type("CampaignOperation")
    campaign = campaign_operation.create
    campaign.name = f"DevLoop - 7 Day Test ({datetime.now().strftime('%Y-%m-%d')})"
    campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    campaign.status = client.enums.CampaignStatusEnum.PAUSED  # Start paused for safety
    campaign.campaign_budget = budget_resource

    # Manual CPC bidding with $2 max
    campaign.manual_cpc.enhanced_cpc_enabled = False

    # Set start and end dates
    start_date = datetime.now()
    end_date = start_date + timedelta(days=7)
    campaign.start_date = start_date.strftime("%Y%m%d")
    campaign.end_date = end_date.strftime("%Y%m%d")

    # Network settings - Search only
    campaign.network_settings.target_google_search = True
    campaign.network_settings.target_search_network = True
    campaign.network_settings.target_content_network = False

    # Create campaign
    campaign_response = campaign_service.mutate_campaigns(
        customer_id=customer_id,
        operations=[campaign_operation]
    )
    campaign_resource = campaign_response.results[0].resource_name
    print(f"Created campaign: {campaign_resource}")

    return campaign_resource

def create_ad_group(client, customer_id, campaign_resource):
    """Create ad group"""
    ad_group_service = client.get_service("AdGroupService")

    operation = client.get_type("AdGroupOperation")
    ad_group = operation.create
    ad_group.name = "QA Automation"
    ad_group.campaign = campaign_resource
    ad_group.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    ad_group.cpc_bid_micros = 2_000_000  # $2.00 max CPC
    ad_group.status = client.enums.AdGroupStatusEnum.ENABLED

    response = ad_group_service.mutate_ad_groups(
        customer_id=customer_id,
        operations=[operation]
    )
    ad_group_resource = response.results[0].resource_name
    print(f"Created ad group: {ad_group_resource}")

    return ad_group_resource

def create_keywords(client, customer_id, ad_group_resource):
    """Create keywords with broad match modifier"""
    keyword_service = client.get_service("AdGroupCriterionService")

    keywords = [
        "automated testing tool",
        "QA automation developer",
        "CI CD solo developer",
        "autonomous testing",
        "bug detection tool",
        "automated QA tool",
        "developer testing automation",
        "indie hacker testing",
    ]

    operations = []
    for keyword_text in keywords:
        operation = client.get_type("AdGroupCriterionOperation")
        criterion = operation.create
        criterion.ad_group = ad_group_resource
        criterion.keyword.text = keyword_text
        criterion.keyword.match_type = client.enums.KeywordMatchTypeEnum.BROAD
        criterion.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        operations.append(operation)

    response = keyword_service.mutate_ad_group_criteria(
        customer_id=customer_id,
        operations=operations
    )
    print(f"Created {len(response.results)} keywords")

    return [r.resource_name for r in response.results]

def create_responsive_search_ad(client, customer_id, ad_group_resource):
    """Create responsive search ad"""
    ad_service = client.get_service("AdGroupAdService")

    operation = client.get_type("AdGroupAdOperation")
    ad_group_ad = operation.create
    ad_group_ad.ad_group = ad_group_resource
    ad_group_ad.status = client.enums.AdGroupAdStatusEnum.ENABLED

    ad = ad_group_ad.ad
    ad.final_urls.append("https://devloop.dev?utm_source=google&utm_medium=cpc&utm_campaign=week1_test")

    # Headlines (30 chars max each)
    headlines = [
        "Autonomous QA for Devs",
        "Find Bugs Automatically",
        "Ship Faster, Break Nothing",
        "AI-Powered Bug Detection",
        "Auto-Test Your Code",
        "Stop Manual Testing",
    ]

    for headline_text in headlines:
        headline = client.get_type("AdTextAsset")
        headline.text = headline_text
        ad.responsive_search_ad.headlines.append(headline)

    # Descriptions (90 chars max each)
    descriptions = [
        "DevLoop finds bugs, fixes them, and verifies the fix. One command. Try free.",
        "Stop manual testing. Let AI handle QA while you ship features faster.",
        "Automated testing for indie hackers. $19/mo. Set up in 2 minutes.",
    ]

    for desc_text in descriptions:
        description = client.get_type("AdTextAsset")
        description.text = desc_text
        ad.responsive_search_ad.descriptions.append(description)

    response = ad_service.mutate_ad_group_ads(
        customer_id=customer_id,
        operations=[operation]
    )
    ad_resource = response.results[0].resource_name
    print(f"Created responsive search ad: {ad_resource}")

    return ad_resource

def main():
    print("="*60)
    print("DevLoop Google Ads Campaign Creator")
    print("="*60)

    # Load credentials
    creds = load_credentials()

    # Validate required fields
    required = ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID']
    missing = [k for k in required if not creds.get(k) or creds.get(k) == 'xxx']

    if missing:
        print(f"\nError: Missing credentials: {', '.join(missing)}")
        print("\nTo get these values:")
        print("1. Developer Token: Apply at ads.google.com (Settings > API Center)")
        print("2. Refresh Token: Run 'python scripts/google-ads-oauth.py'")
        print("3. Customer ID: Find in Google Ads (top right, format: XXX-XXX-XXXX)")
        print(f"\nUpdate {CREDENTIALS_FILE} with these values.")
        sys.exit(1)

    # Create yaml config
    yaml_path = create_google_ads_yaml(creds)
    customer_id = creds['GOOGLE_ADS_CUSTOMER_ID'].replace('-', '')

    print(f"\nCustomer ID: {customer_id}")
    print(f"Using config: {yaml_path}")

    try:
        # Initialize client
        client = GoogleAdsClient.load_from_storage(yaml_path)

        # Create campaign components
        print("\n--- Creating Campaign ---")
        campaign_resource = create_campaign(client, customer_id)

        print("\n--- Creating Ad Group ---")
        ad_group_resource = create_ad_group(client, customer_id, campaign_resource)

        print("\n--- Creating Keywords ---")
        create_keywords(client, customer_id, ad_group_resource)

        print("\n--- Creating Ad ---")
        create_responsive_search_ad(client, customer_id, ad_group_resource)

        print("\n" + "="*60)
        print("SUCCESS! Campaign created (PAUSED)")
        print("="*60)
        print(f"\nCampaign: {campaign_resource}")
        print(f"\nTo enable the campaign:")
        print("1. Go to ads.google.com")
        print("2. Find 'DevLoop - 7 Day Test'")
        print("3. Review settings and enable")
        print("\nOr run: python scripts/google-ads-enable.py")

    except GoogleAdsException as ex:
        print(f"\nGoogle Ads API Error:")
        for error in ex.failure.errors:
            print(f"  - {error.error_code}: {error.message}")
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
