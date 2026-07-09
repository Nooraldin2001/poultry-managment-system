# Generated manually for purchase slaughterhouse/transport deductions.

from decimal import Decimal

import django.core.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("purchases", "0003_purchaseinvoice_backdate_reason"),
        ("suppliers", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseinvoice",
            name="gross_total",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=16,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="slaughterhouse_supplier",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="slaughterhouse_purchase_deductions",
                to="suppliers.supplier",
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="slaughterhouse_deduction_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=16,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="slaughterhouse_deduction_posted",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=16,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="transport_supplier",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="transport_purchase_deductions",
                to="suppliers.supplier",
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="transport_deduction_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=16,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="transport_deduction_posted",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=16,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="deduction_notes",
            field=models.TextField(blank=True),
        ),
    ]
