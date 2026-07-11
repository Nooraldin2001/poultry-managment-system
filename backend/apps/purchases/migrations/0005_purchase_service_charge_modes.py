"""Add slaughterhouse/transport service charge modes and final invoice total."""

from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("purchases", "0004_purchase_invoice_service_deductions"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseinvoice",
            name="slaughterhouse_mode",
            field=models.CharField(
                choices=[("add", "Add"), ("deduct", "Deduct")],
                default="deduct",
                max_length=8,
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="transport_mode",
            field=models.CharField(
                choices=[("add", "Add"), ("deduct", "Deduct")],
                default="deduct",
                max_length=8,
            ),
        ),
        migrations.AddField(
            model_name="purchaseinvoice",
            name="final_invoice_total",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=16,
            ),
        ),
        migrations.RunSQL(
            sql=(
                "UPDATE purchases_purchaseinvoice "
                "SET final_invoice_total = gross_total "
                "WHERE final_invoice_total = 0 AND gross_total > 0"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
