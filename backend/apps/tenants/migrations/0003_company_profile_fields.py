from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0002_alter_company_logo_alter_company_signature_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="company",
            name="license_expiry_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="company",
            name="manager_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="company",
            name="manager_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="company",
            name="manager_phone",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="company",
            name="notes",
            field=models.TextField(blank=True),
        ),
    ]
