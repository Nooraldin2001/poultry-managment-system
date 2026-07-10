from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0002_moneyaccount_moneymovement_and_more"),
        ("sales", "0002_salesinvoice_backdate_reason"),
    ]

    operations = [
        migrations.AddField(
            model_name="salesinvoice",
            name="money_account",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sales_invoices",
                to="payments.moneyaccount",
            ),
        ),
    ]
