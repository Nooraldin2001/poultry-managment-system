from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="salesinvoice",
            name="backdate_reason",
            field=models.TextField(blank=True),
        ),
    ]
