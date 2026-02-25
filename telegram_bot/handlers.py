"""
Telegram Bot Handlers for Customer Self-Service.

Customers can:
- Link their account via phone number
- Check their current debt
- View purchase history
- View payment history
- See their personal info
"""

import logging
from datetime import datetime
from aiogram import Router, F
from aiogram.types import (
    Message, CallbackQuery,
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardRemove
)
from aiogram.filters import CommandStart, Command
from aiogram.enums import ParseMode

from customer_api import customer_api
from config import config

logger = logging.getLogger(__name__)

router = Router()


# ═══════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════

def fmt_money(amount) -> str:
    """Format money with spaces: 1 500 000"""
    try:
        return f"{float(amount):,.0f}".replace(",", " ")
    except (ValueError, TypeError):
        return "0"


def main_menu_keyboard() -> InlineKeyboardMarkup:
    """Main menu inline keyboard."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💰 Mening qarzim", callback_data="my_debt")],
        [InlineKeyboardButton(text="📋 Xarid tarixim", callback_data="my_purchases")],
        [InlineKeyboardButton(text="💳 To'lovlar tarixi", callback_data="my_payments")],
        [InlineKeyboardButton(text="👤 Mening ma'lumotlarim", callback_data="my_info")],
        [InlineKeyboardButton(text="📞 Aloqa", callback_data="contact_info")],
    ])


def back_to_menu_keyboard() -> InlineKeyboardMarkup:
    """Back to menu button."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Bosh menyu", callback_data="main_menu")]
    ])


def phone_share_keyboard() -> ReplyKeyboardMarkup:
    """Keyboard with phone share button."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Telefon raqamni yuborish", request_contact=True)]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )


def purchases_pagination_keyboard(page: int, total: int, per_page: int = 5) -> InlineKeyboardMarkup:
    """Pagination for purchase history."""
    buttons = []
    total_pages = max(1, (total + per_page - 1) // per_page)

    nav_row = []
    if page > 1:
        nav_row.append(InlineKeyboardButton(text="⬅️ Oldingi", callback_data=f"purchases_page_{page - 1}"))

    nav_row.append(InlineKeyboardButton(text=f"{page}/{total_pages}", callback_data="noop"))

    if page < total_pages:
        nav_row.append(InlineKeyboardButton(text="Keyingi ➡️", callback_data=f"purchases_page_{page + 1}"))

    if nav_row:
        buttons.append(nav_row)

    buttons.append([InlineKeyboardButton(text="🔙 Bosh menyu", callback_data="main_menu")])

    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def get_linked_customer(telegram_id: str) -> dict | None:
    """Get customer data linked to this Telegram ID."""
    return await customer_api.get_customer_by_telegram_id(telegram_id)


# ═══════════════════════════════════════
#  /start COMMAND
# ═══════════════════════════════════════

@router.message(CommandStart())
async def cmd_start(message: Message):
    """Handle /start command."""
    telegram_id = str(message.from_user.id)

    # Check if already linked
    customer = await get_linked_customer(telegram_id)

    if customer:
        # Already linked - show main menu
        await message.answer(
            f"👋 Assalomu alaykum, <b>{customer['name']}</b>!\n\n"
            f"🏪 <b>{config.COMPANY_NAME}</b> botiga xush kelibsiz.\n\n"
            f"Quyidagi tugmalar orqali ma'lumotlaringizni ko'rishingiz mumkin:",
            reply_markup=main_menu_keyboard(),
            parse_mode=ParseMode.HTML
        )
    else:
        # Not linked - ask for phone number
        await message.answer(
            f"👋 Assalomu alaykum!\n\n"
            f"🏪 <b>{config.COMPANY_NAME}</b> mijozlar botiga xush kelibsiz.\n\n"
            f"Hisobingizni ulash uchun telefon raqamingizni yuboring.\n"
            f"Quyidagi tugmani bosing 👇",
            reply_markup=phone_share_keyboard(),
            parse_mode=ParseMode.HTML
        )


# ═══════════════════════════════════════
#  /menu COMMAND
# ═══════════════════════════════════════

@router.message(Command("menu"))
async def cmd_menu(message: Message):
    """Show main menu."""
    telegram_id = str(message.from_user.id)
    customer = await get_linked_customer(telegram_id)

    if not customer:
        await message.answer(
            "❌ Siz hali ro'yxatdan o'tmagansiz.\n"
            "/start buyrug'ini yuboring.",
            parse_mode=ParseMode.HTML
        )
        return

    await message.answer(
        f"📋 <b>Bosh menyu</b>\n\n"
        f"👤 {customer['name']}\n"
        f"💰 Joriy qarz: <b>{fmt_money(customer['current_debt'])} so'm</b>",
        reply_markup=main_menu_keyboard(),
        parse_mode=ParseMode.HTML
    )


# ═══════════════════════════════════════
#  PHONE NUMBER / CONTACT HANDLER
# ═══════════════════════════════════════

@router.message(F.contact)
async def handle_contact(message: Message):
    """Handle shared phone number (contact)."""
    telegram_id = str(message.from_user.id)
    phone = message.contact.phone_number

    if not phone:
        await message.answer("❌ Telefon raqam olinmadi. Qayta urinib ko'ring.")
        return

    # Normalize phone
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+" + phone

    # Try to link
    result = await customer_api.link_telegram(phone, telegram_id)

    if result.get("success"):
        data = result["data"]
        if data.get("already_linked"):
            await message.answer(
                f"✅ Siz allaqachon <b>{data['name']}</b> sifatida ro'yxatdan o'tgansiz!\n\n"
                f"Quyidagi tugmalar orqali ma'lumotlaringizni ko'ring:",
                reply_markup=main_menu_keyboard(),
                parse_mode=ParseMode.HTML
            )
        else:
            await message.answer(
                f"✅ Muvaffaqiyatli ulandi!\n\n"
                f"👤 <b>{data['name']}</b>\n"
                f"📱 {data['phone']}\n\n"
                f"Endi quyidagi tugmalar orqali ma'lumotlaringizni ko'rishingiz mumkin:",
                reply_markup=main_menu_keyboard(),
                parse_mode=ParseMode.HTML
            )
    else:
        error = result.get("error", "Noma'lum xato")
        await message.answer(
            f"❌ <b>Ulanib bo'lmadi</b>\n\n"
            f"Sabab: {error}\n\n"
            f"Iltimos, do'konimizga tashrif buyurib ro'yxatdan o'ting yoki\n"
            f"📞 {config.COMPANY_PHONE} raqamiga qo'ng'iroq qiling.",
            reply_markup=ReplyKeyboardRemove(),
            parse_mode=ParseMode.HTML
        )


# Also handle text phone number
@router.message(F.text.regexp(r'^\+?998\d{9}$'))
async def handle_phone_text(message: Message):
    """Handle phone number sent as text."""
    telegram_id = str(message.from_user.id)
    phone = message.text.strip()

    if not phone.startswith("+"):
        phone = "+" + phone

    result = await customer_api.link_telegram(phone, telegram_id)

    if result.get("success"):
        data = result["data"]
        await message.answer(
            f"✅ Muvaffaqiyatli ulandi!\n\n"
            f"👤 <b>{data['name']}</b>\n"
            f"📱 {data['phone']}\n\n"
            f"Quyidagi tugmalar orqali ma'lumotlaringizni ko'ring:",
            reply_markup=main_menu_keyboard(),
            parse_mode=ParseMode.HTML
        )
    else:
        error = result.get("error", "Noma'lum xato")
        await message.answer(
            f"❌ Bu raqamli mijoz topilmadi.\n\n"
            f"📞 Yordam uchun: {config.COMPANY_PHONE}",
            parse_mode=ParseMode.HTML
        )


# ═══════════════════════════════════════
#  CALLBACK HANDLERS
# ═══════════════════════════════════════

@router.callback_query(F.data == "noop")
async def handle_noop(callback: CallbackQuery):
    """Ignore noop callbacks (page counter)."""
    await callback.answer()


@router.callback_query(F.data == "main_menu")
async def handle_main_menu(callback: CallbackQuery):
    """Show main menu."""
    telegram_id = str(callback.from_user.id)
    customer = await get_linked_customer(telegram_id)

    if not customer:
        await callback.message.edit_text(
            "❌ Sessiya tugadi. /start buyrug'ini yuboring."
        )
        await callback.answer()
        return

    await callback.message.edit_text(
        f"📋 <b>Bosh menyu</b>\n\n"
        f"👤 {customer['name']}\n"
        f"💰 Joriy qarz: <b>{fmt_money(customer['current_debt'])} so'm</b>",
        reply_markup=main_menu_keyboard(),
        parse_mode=ParseMode.HTML
    )
    await callback.answer()


# ═══════════════════════════════════════
#  💰 MY DEBT
# ═══════════════════════════════════════

@router.callback_query(F.data == "my_debt")
async def handle_my_debt(callback: CallbackQuery):
    """Show customer debt details."""
    telegram_id = str(callback.from_user.id)
    customer = await get_linked_customer(telegram_id)

    if not customer:
        await callback.message.edit_text("❌ Sessiya tugadi. /start buyrug'ini yuboring.")
        await callback.answer()
        return

    # Fetch detailed debt info
    debt_info = await customer_api.get_customer_debt_details(customer["id"])

    if not debt_info:
        await callback.message.edit_text(
            f"💰 <b>Qarz ma'lumotlari</b>\n\n"
            f"👤 {customer['name']}\n"
            f"💵 Joriy qarz: <b>{fmt_money(customer['current_debt'])} so'm</b>\n"
            f"💚 Avans: <b>{fmt_money(customer['advance_balance'])} so'm</b>\n\n"
            f"⚠️ Batafsil ma'lumotni yuklab bo'lmadi.",
            reply_markup=back_to_menu_keyboard(),
            parse_mode=ParseMode.HTML
        )
        await callback.answer()
        return

    # Build debt message
    current_debt = debt_info["current_debt"]
    advance = debt_info["advance_balance"]
    credit_limit = debt_info["credit_limit"]

    lines = [
        f"💰 <b>QARZ MA'LUMOTLARI</b>",
        f"",
        f"👤 <b>{customer['name']}</b>",
        f"",
    ]

    if current_debt > 0:
        lines.append(f"🔴 <b>Joriy qarz: {fmt_money(current_debt)} so'm</b>")
    else:
        lines.append(f"✅ <b>Qarzingiz yo'q!</b>")

    if advance > 0:
        lines.append(f"💚 Avans balans: {fmt_money(advance)} so'm")

    if credit_limit > 0:
        lines.append(f"📊 Kredit limit: {fmt_money(credit_limit)} so'm")

    # Unpaid sales
    unpaid = debt_info.get("unpaid_sales", [])
    if unpaid:
        lines.append(f"\n━━━━━━━━━━━━━━━━━")
        lines.append(f"📋 <b>Qarzli xaridlar:</b>")
        lines.append("")

        for idx, sale in enumerate(unpaid[:10], 1):
            date_str = ""
            if sale.get("sale_date"):
                try:
                    dt = datetime.fromisoformat(sale["sale_date"])
                    date_str = dt.strftime("%d.%m.%Y")
                except:
                    date_str = sale["sale_date"]

            lines.append(
                f"  {idx}. 📅 {date_str} | #{sale['sale_number']}\n"
                f"      💰 {fmt_money(sale['total_amount'])} so'm | "
                f"🔴 Qarz: {fmt_money(sale['debt_amount'])} so'm"
            )
            if sale.get("items_summary"):
                lines.append(f"      📦 {sale['items_summary']}")
            lines.append("")

        if len(unpaid) > 10:
            lines.append(f"  ... va yana {len(unpaid) - 10} ta xarid")

    lines.extend([
        "",
        f"━━━━━━━━━━━━━━━━━",
        f"🏪 <b>{config.COMPANY_NAME}</b>",
        f"📞 {config.COMPANY_PHONE}",
    ])

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=back_to_menu_keyboard(),
        parse_mode=ParseMode.HTML
    )
    await callback.answer()


# ═══════════════════════════════════════
#  📋 MY PURCHASES
# ═══════════════════════════════════════

@router.callback_query(F.data == "my_purchases")
async def handle_my_purchases(callback: CallbackQuery):
    """Show purchase history page 1."""
    await show_purchases_page(callback, page=1)


@router.callback_query(F.data.startswith("purchases_page_"))
async def handle_purchases_pagination(callback: CallbackQuery):
    """Handle purchase history pagination."""
    page = int(callback.data.split("_")[-1])
    await show_purchases_page(callback, page=page)


async def show_purchases_page(callback: CallbackQuery, page: int):
    """Display a page of purchase history."""
    telegram_id = str(callback.from_user.id)
    customer = await get_linked_customer(telegram_id)

    if not customer:
        await callback.message.edit_text("❌ Sessiya tugadi. /start buyrug'ini yuboring.")
        await callback.answer()
        return

    per_page = 5
    result = await customer_api.get_customer_purchases(customer["id"], page=page, per_page=per_page)

    if not result:
        await callback.message.edit_text(
            "⚠️ Ma'lumotlarni yuklab bo'lmadi. Keyinroq urinib ko'ring.",
            reply_markup=back_to_menu_keyboard(),
            parse_mode=ParseMode.HTML
        )
        await callback.answer()
        return

    sales = result.get("data", [])
    total = result.get("total", 0)

    if not sales and page == 1:
        await callback.message.edit_text(
            f"📋 <b>Xarid tarixi</b>\n\n"
            f"Hali xarid qilinmagan.",
            reply_markup=back_to_menu_keyboard(),
            parse_mode=ParseMode.HTML
        )
        await callback.answer()
        return

    lines = [
        f"📋 <b>XARID TARIXI</b>",
        f"👤 {customer['name']}",
        f"📊 Jami: {total} ta xarid",
        "",
    ]

    for sale in sales:
        date_str = ""
        if sale.get("sale_date"):
            try:
                dt = datetime.fromisoformat(sale["sale_date"])
                date_str = dt.strftime("%d.%m.%Y")
            except:
                date_str = sale["sale_date"]

        status_emoji = "✅" if sale.get("payment_status") == "PAID" else "🔴"

        lines.append(f"━━━━━━━━━━━━━━━━━")
        lines.append(f"📅 <b>{date_str}</b> | #{sale['sale_number']}")

        # Items
        for item in sale.get("items", [])[:4]:
            lines.append(
                f"  📦 {item['product_name']} - {item['quantity']} {item['uom']} "
                f"= {fmt_money(item['total_price'])} so'm"
            )
        if len(sale.get("items", [])) > 4:
            lines.append(f"  ... +{len(sale['items']) - 4} ta tovar")

        lines.append(f"  💰 Jami: <b>{fmt_money(sale['total_amount'])} so'm</b>")

        if sale.get("discount_amount", 0) > 0:
            lines.append(f"  🏷 Chegirma: {fmt_money(sale['discount_amount'])} so'm")

        if sale.get("debt_amount", 0) > 0:
            lines.append(f"  {status_emoji} Qarz: <b>{fmt_money(sale['debt_amount'])} so'm</b>")
        else:
            lines.append(f"  {status_emoji} To'liq to'langan")

        lines.append("")

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=purchases_pagination_keyboard(page, total, per_page),
        parse_mode=ParseMode.HTML
    )
    await callback.answer()


# ═══════════════════════════════════════
#  💳 MY PAYMENTS
# ═══════════════════════════════════════

@router.callback_query(F.data == "my_payments")
async def handle_my_payments(callback: CallbackQuery):
    """Show payment history."""
    telegram_id = str(callback.from_user.id)
    customer = await get_linked_customer(telegram_id)

    if not customer:
        await callback.message.edit_text("❌ Sessiya tugadi. /start buyrug'ini yuboring.")
        await callback.answer()
        return

    debt_info = await customer_api.get_customer_debt_details(customer["id"])

    if not debt_info:
        await callback.message.edit_text(
            "⚠️ Ma'lumotlarni yuklab bo'lmadi.",
            reply_markup=back_to_menu_keyboard(),
            parse_mode=ParseMode.HTML
        )
        await callback.answer()
        return

    payments = debt_info.get("recent_payments", [])

    lines = [
        f"💳 <b>TO'LOVLAR TARIXI</b>",
        f"👤 {customer['name']}",
        "",
    ]

    if not payments:
        lines.append("To'lovlar hali yo'q.")
    else:
        lines.append(f"Oxirgi {len(payments)} ta to'lov:")
        lines.append("")

        for idx, p in enumerate(payments, 1):
            date_str = ""
            if p.get("date"):
                try:
                    dt = datetime.fromisoformat(p["date"])
                    date_str = dt.strftime("%d.%m.%Y %H:%M")
                except:
                    date_str = p["date"]

            lines.append(
                f"  {idx}. 📅 {date_str}\n"
                f"      ✅ <b>{fmt_money(p['amount'])} so'm</b>\n"
                f"      💰 Qoldiq: {fmt_money(p['balance_after'])} so'm"
            )
            if p.get("description"):
                lines.append(f"      📝 {p['description']}")
            lines.append("")

    lines.extend([
        "━━━━━━━━━━━━━━━━━",
        f"💰 Joriy qarz: <b>{fmt_money(debt_info['current_debt'])} so'm</b>",
    ])

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=back_to_menu_keyboard(),
        parse_mode=ParseMode.HTML
    )
    await callback.answer()


# ═══════════════════════════════════════
#  👤 MY INFO
# ═══════════════════════════════════════

@router.callback_query(F.data == "my_info")
async def handle_my_info(callback: CallbackQuery):
    """Show customer personal info."""
    telegram_id = str(callback.from_user.id)
    customer = await get_linked_customer(telegram_id)

    if not customer:
        await callback.message.edit_text("❌ Sessiya tugadi. /start buyrug'ini yuboring.")
        await callback.answer()
        return

    # Fetch fresh info
    info = await customer_api.get_customer_info(customer["id"])
    if not info:
        info = customer

    customer_type_labels = {
        "REGULAR": "Oddiy mijoz",
        "VIP": "⭐ VIP mijoz",
        "WHOLESALE": "Ulgurji xaridor",
        "CONTRACTOR": "Pudratchi",
    }
    type_label = customer_type_labels.get(info.get("customer_type", ""), info.get("customer_type", ""))

    lines = [
        f"👤 <b>MENING MA'LUMOTLARIM</b>",
        "",
        f"📛 <b>Ism:</b> {info['name']}",
        f"📱 <b>Telefon:</b> {info['phone']}",
    ]

    if info.get("company_name"):
        lines.append(f"🏢 <b>Kompaniya:</b> {info['company_name']}")

    lines.append(f"🏷 <b>Turi:</b> {type_label}")

    if info.get("address"):
        lines.append(f"📍 <b>Manzil:</b> {info['address']}")

    if info.get("personal_discount_percent", 0) > 0:
        lines.append(f"🏷 <b>Shaxsiy chegirma:</b> {info['personal_discount_percent']}%")

    lines.extend([
        "",
        "━━━━━━━━━━━━━━━━━",
        f"📊 <b>STATISTIKA</b>",
        "",
        f"🛒 Jami xaridlar: <b>{info.get('total_purchases_count', 0)} ta</b>",
        f"💰 Umumiy summa: <b>{fmt_money(info.get('total_purchases', 0))} so'm</b>",
    ])

    if info.get("last_purchase_date"):
        try:
            dt = datetime.fromisoformat(info["last_purchase_date"])
            lines.append(f"📅 Oxirgi xarid: <b>{dt.strftime('%d.%m.%Y')}</b>")
        except:
            lines.append(f"📅 Oxirgi xarid: <b>{info['last_purchase_date']}</b>")

    lines.extend([
        "",
        "━━━━━━━━━━━━━━━━━",
        f"💵 <b>MOLIYAVIY</b>",
        "",
        f"🔴 Joriy qarz: <b>{fmt_money(info.get('current_debt', 0))} so'm</b>",
        f"💚 Avans: <b>{fmt_money(info.get('advance_balance', 0))} so'm</b>",
    ])

    if info.get("credit_limit", 0) > 0:
        lines.append(f"📊 Kredit limit: <b>{fmt_money(info['credit_limit'])} so'm</b>")

    await callback.message.edit_text(
        "\n".join(lines),
        reply_markup=back_to_menu_keyboard(),
        parse_mode=ParseMode.HTML
    )
    await callback.answer()


# ═══════════════════════════════════════
#  📞 CONTACT INFO
# ═══════════════════════════════════════

@router.callback_query(F.data == "contact_info")
async def handle_contact_info(callback: CallbackQuery):
    """Show company contact info."""
    await callback.message.edit_text(
        f"📞 <b>ALOQA MA'LUMOTLARI</b>\n\n"
        f"🏪 <b>{config.COMPANY_NAME}</b>\n\n"
        f"📱 Telefon: {config.COMPANY_PHONE}\n\n"
        f"💬 Savollaringiz bo'lsa, qo'ng'iroq qiling yoki\n"
        f"do'konimizga tashrif buyuring.\n\n"
        f"🕐 Ish vaqti: 08:00 - 18:00 (Dushanba-Shanba)",
        reply_markup=back_to_menu_keyboard(),
        parse_mode=ParseMode.HTML
    )
    await callback.answer()


# ═══════════════════════════════════════
#  UNKNOWN MESSAGE HANDLER
# ═══════════════════════════════════════

@router.message()
async def handle_unknown(message: Message):
    """Handle any unrecognized message."""
    telegram_id = str(message.from_user.id)
    customer = await get_linked_customer(telegram_id)

    if customer:
        await message.answer(
            "🤖 Buyruqni tushunmadim.\n\n"
            "Menyu uchun /menu buyrug'ini yuboring.",
            reply_markup=main_menu_keyboard(),
            parse_mode=ParseMode.HTML
        )
    else:
        await message.answer(
            "👋 Botdan foydalanish uchun /start buyrug'ini yuboring.",
            parse_mode=ParseMode.HTML
        )