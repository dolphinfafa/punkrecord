"""Explicit normalization for human-entered text, never credentials or identifiers."""
from typing import Annotated

from pydantic import BeforeValidator


def normalize_text(value, *, required=False):
    if not isinstance(value, str):
        return value
    cleaned = value.strip()
    if not cleaned and (required or value != ""):
        raise ValueError("请输入有效文本，不能只包含空白字符")
    return cleaned


def nonblank_text(value):
    return normalize_text(value, required=True)


NonBlankText = Annotated[str, BeforeValidator(nonblank_text)]
PlainText = Annotated[str, BeforeValidator(normalize_text)]
