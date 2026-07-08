from django.db import migrations, models


def backfill_movement_dates(apps, schema_editor):
    StockMovement = apps.get_model("inventory", "StockMovement")
    for movement in StockMovement.objects.all().only("id", "created_at"):
        StockMovement.objects.filter(pk=movement.pk).update(
            movement_date=movement.created_at.date()
        )


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_alter_fifostocklayer_source_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="stockmovement",
            name="movement_date",
            field=models.DateField(db_index=True, null=True),
        ),
        migrations.RunPython(backfill_movement_dates, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="stockmovement",
            name="movement_date",
            field=models.DateField(db_index=True),
        ),
    ]
