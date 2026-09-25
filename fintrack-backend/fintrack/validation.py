import re
from datetime import date
from decimal import Decimal, InvalidOperation

from flask import request


class ValidationError(ValueError):
    pass


def json_body():
    if not request.is_json:
        raise ValidationError("Content-Type must be application/json.")
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ValidationError("A valid JSON object is required.")
    return body


def required_text(data, key, maximum, optional=False):
    value = data.get(key)
    if optional and (value is None or (isinstance(value, str) and not value.strip())):
        return ""
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise ValidationError(f"{key} must be a non-empty string of at most {maximum} characters.")
    return value.strip()


def parse_amount(value, field="amount", allow_zero=False):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(f"{field} must be a valid monetary amount.")
    if not amount.is_finite() or amount < 0 or (amount == 0 and not allow_zero):
        raise ValidationError(f"{field} must be {'non-negative' if allow_zero else 'positive'}.")
    if amount.as_tuple().exponent < -2 or amount >= Decimal("10000000000"):
        raise ValidationError(f"{field} must have at most two decimal places and be less than 10000000000.")
    return amount.quantize(Decimal("0.01"))


def parse_date(value, field="date"):
    if not isinstance(value, str):
        raise ValidationError(f"{field} must use YYYY-MM-DD format.")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError(f"{field} must use YYYY-MM-DD format.")


def parse_period(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
        raise ValidationError("period must use YYYY-MM format.")
    return value


def valid_email(value):
    if not isinstance(value, str) or len(value) > 254:
        return False
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value.strip()))
