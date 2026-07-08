from django.db import migrations, models


def backfill_money_movement_dates(apps, schema_editor):
    MoneyMovement = apps.get_model("payments", "MoneyMovement")
    for movement in MoneyMovement.objects.all().only("id", "created_at"):
        MoneyMovement.objects.filter(pk=movement.pk).update(
            movement_date=movement.created_at.date()
        )


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0002_moneyaccount_moneymovement_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="moneymovement",
            name="movement_date",
            field=models.DateField(db_index=True, null=True),
        ),
        migrations.RunPython(backfill_money_movement_dates, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="moneymovement",
            name="movement_date",
            field=models.DateField(db_index=True),
        ),
    ]
