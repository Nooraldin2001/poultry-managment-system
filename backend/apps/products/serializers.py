from rest_framework import serializers

from .models import Product, ProductCategory, ProductType


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = [
            "id", "name_ar", "name_en", "code", "description",
            "is_active", "sort_order",
        ]
        read_only_fields = ["id"]


class ProductPriceSummarySerializer(serializers.Serializer):
    sales_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    sales_price_type = serializers.CharField()
    purchase_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    purchase_price_type = serializers.CharField()
    vat_taxable = serializers.BooleanField()
    carton_weight_kg = serializers.SerializerMethodField()

    def get_carton_weight_kg(self, obj):
        val = obj.carton_weight_kg
        return str(val) if val is not None else None


class ProductListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name_ar", read_only=True)
    carton_weight_kg = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name_ar", "name_en", "sku", "product_type",
            "category", "category_name", "sales_price", "sales_price_type",
            "purchase_price", "purchase_price_type",
            "weight_grams", "default_pieces_per_carton", "carton_weight_kg",
            "is_active", "can_sell", "can_purchase", "can_quote", "track_inventory",
        ]

    def get_carton_weight_kg(self, obj):
        val = obj.carton_weight_kg
        return str(val) if val is not None else None


class ProductDetailSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name_ar", read_only=True)
    carton_weight_kg = serializers.SerializerMethodField()
    price_summary = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "company", "category", "category_name",
            "name_ar", "name_en", "sku", "product_type",
            "weight_grams", "default_pieces_per_carton", "default_unit",
            "sales_price", "sales_price_type", "purchase_price", "purchase_price_type",
            "minimum_stock_cartons", "minimum_stock_pieces", "minimum_stock_kg",
            "track_inventory", "vat_taxable",
            "allow_customer_special_price", "allow_supplier_special_price",
            "allow_free_product", "can_sell", "can_purchase", "can_quote",
            "is_active", "disabled_at", "disable_reason",
            "carton_weight_kg", "price_summary", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "company", "disabled_at", "disable_reason",
            "created_at", "updated_at",
        ]

    def get_carton_weight_kg(self, obj):
        val = obj.carton_weight_kg
        return str(val) if val is not None else None

    def get_price_summary(self, obj):
        return ProductPriceSummarySerializer(obj).data


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id", "category", "name_ar", "name_en", "sku", "product_type",
            "weight_grams", "default_pieces_per_carton", "default_unit",
            "sales_price", "sales_price_type", "purchase_price", "purchase_price_type",
            "minimum_stock_cartons", "minimum_stock_pieces", "minimum_stock_kg",
            "track_inventory", "vat_taxable",
            "allow_customer_special_price", "allow_supplier_special_price",
            "allow_free_product", "can_sell", "can_purchase", "can_quote",
        ]
        read_only_fields = ["id"]

    def validate_category(self, category):
        request = self.context.get("request")
        if request and category.company_id != request.user.company_id:
            raise serializers.ValidationError("Category does not belong to this company.")
        return category

    def validate(self, attrs):
        # Run model.clean() validations against the (merged) instance.
        if self.instance is None:
            product = Product(**attrs)
            product.company_id = self.context["request"].user.company_id
        else:
            product = self.instance
            for key, value in attrs.items():
                setattr(product, key, value)
        product.clean()
        return attrs


class ProductUsageSerializer(serializers.Serializer):
    """Placeholder usage foundation (no transactions exist yet)."""

    product_id = serializers.IntegerField()
    used_in_sales = serializers.IntegerField(default=0)
    used_in_purchases = serializers.IntegerField(default=0)
    used_in_quotations = serializers.IntegerField(default=0)
    has_inventory = serializers.BooleanField(default=False)
    can_delete = serializers.BooleanField(default=False)
