from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("purchases", "0002_purchaseinvoice_money_account_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchaseinvoice",
            name="backdate_reason",
            field=models.TextField(blank=True),
        ),
    ]
