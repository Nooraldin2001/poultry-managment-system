"""Shared enums used across business apps."""

from django.db import models


class PriceType(models.TextChoices):
    KG = "kg", "Per KG"
    PIECE = "piece", "Per Piece"
    CARTON = "carton", "Per Carton"
    TRAY = "tray", "Per Tray"


class Unit(models.TextChoices):
    KG = "kg", "KG"
    PIECE = "piece", "Piece"
    CARTON = "carton", "Carton"
    TRAY = "tray", "Tray"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    BANK = "bank", "Bank"
    CREDIT = "credit", "Credit / On Account"
    # Legacy values (still accepted for existing rows / payment movements)
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    CHEQUE = "cheque", "Cheque"
    OTHER = "other", "Other"
