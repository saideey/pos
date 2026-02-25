"""
Customer API Client for Telegram Bot.
Calls the main API's internal bot endpoints to fetch customer data.
"""

import logging
from typing import Optional, Dict, Any
import httpx

from config import config

logger = logging.getLogger(__name__)

API_BASE = config.API_URL.rstrip("/")
# Internal bot API is at /internal/bot
BOT_API_BASE = API_BASE.replace("/api/v1", "") + "/internal/bot"


class CustomerAPI:
    """API client for fetching customer data from the main API."""

    def __init__(self):
        self.base_url = BOT_API_BASE
        self.timeout = 15.0

    async def _get(self, path: str, params: dict = None) -> Optional[dict]:
        """Make GET request to internal bot API."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                url = f"{self.base_url}{path}"
                response = await client.get(url, params=params)
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"API error {response.status_code}: {response.text}")
                    return None
        except httpx.ConnectError:
            logger.error(f"Cannot connect to API at {self.base_url}")
            return None
        except Exception as e:
            logger.error(f"API request error: {e}")
            return None

    async def _post(self, path: str, data: dict) -> Optional[dict]:
        """Make POST request to internal bot API."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                url = f"{self.base_url}{path}"
                response = await client.post(url, json=data)
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"API error {response.status_code}: {response.text}")
                    return None
        except httpx.ConnectError:
            logger.error(f"Cannot connect to API at {self.base_url}")
            return None
        except Exception as e:
            logger.error(f"API request error: {e}")
            return None

    async def get_customer_by_telegram_id(self, telegram_id: str) -> Optional[Dict[str, Any]]:
        """Find customer by their Telegram ID."""
        result = await self._get(f"/customer/by-telegram/{telegram_id}")
        if result and result.get("success"):
            return result["data"]
        return None

    async def get_customer_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        """Find customer by phone number."""
        result = await self._get(f"/customer/by-phone/{phone}")
        if result and result.get("success"):
            return result["data"]
        return None

    async def link_telegram(self, phone: str, telegram_id: str) -> Dict[str, Any]:
        """Link Telegram ID to customer account."""
        result = await self._post("/customer/link-telegram", {
            "phone": phone,
            "telegram_id": telegram_id
        })
        if result:
            return result
        return {"success": False, "error": "API bilan bog'lanib bo'lmadi"}

    async def get_customer_info(self, customer_id: int) -> Optional[Dict[str, Any]]:
        """Get full customer information."""
        result = await self._get(f"/customer/{customer_id}/info")
        if result and result.get("success"):
            return result["data"]
        return None

    async def get_customer_purchases(
            self, customer_id: int, page: int = 1, per_page: int = 10
    ) -> Optional[Dict[str, Any]]:
        """Get customer purchase history."""
        result = await self._get(
            f"/customer/{customer_id}/purchases",
            params={"page": page, "per_page": per_page}
        )
        if result and result.get("success"):
            return result
        return None

    async def get_customer_debt_details(self, customer_id: int) -> Optional[Dict[str, Any]]:
        """Get detailed debt information."""
        result = await self._get(f"/customer/{customer_id}/debt-details")
        if result and result.get("success"):
            return result["data"]
        return None


# Global instance
customer_api = CustomerAPI()