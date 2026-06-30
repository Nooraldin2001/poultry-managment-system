Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Product Master & Pricing Rules Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Inventory workflow
* Customers & Customer Accounts workflow
* Suppliers & Supplier Accounts workflow
* Expenses Management workflow
* Reports & Analytics workflow
* Settings + Users & Permissions workflow
* Arabic-first RTL layout
* English language switch
* Owner/Admin, Accountant, and Cashier/Sales role views
* Tenant navigation
* Separate module files such as CustomerModule, SupplierModule, PurchaseModule, InventoryModule, ExpensesModule, ReportsModule, and SettingsModule

Implementation direction:
Create a self-contained ProductModule file if that matches the current project structure. Keep files balanced and avoid making App.tsx too large. Wire product screens into App.tsx using targeted edits only.

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Product management must be powerful but very easy. Poultry owners should understand product setup without technical language. Use simple Arabic, visual categories, large product cards, clear carton/KG formulas, and obvious warnings when product setup is incomplete.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Confirmed product business rules:

* Products can be added, edited, activated, or disabled.
* Products must be categorized.
* Chicken fixed weights must be supported.
* Fixed weights can include weights from 50g to 1500g, but the poultry workflow commonly uses 400g to 1500g.
* Moving/custom weights start from 1550g and above.
* Moving weights allow manual chicken weight entry.
* Products must support default pieces per carton.
* Cartons may contain 8, 10, or any manually configured number of pieces.
* System must calculate carton weight automatically.
* System must convert grams to KG automatically.
* System must calculate total KG from cartons, pieces, and weight.
* System must support default selling price.
* System must support default purchase price.
* Prices can be overridden by customer, supplier, or invoice if permission allows.
* Customer special prices and supplier special prices already exist in customer/supplier modules and should be visible/linked from Product Master.
* Products can be marked as eligible for free product agreements.
* Products can be used in sales, purchases, quotations, inventory, reports, and statements.
* Products with existing transactions should not be deleted; they can be disabled.
* Sensitive product changes must require reason and audit log if they affect pricing, carton rules, or inventory calculation.

Required screens:

1. Products List Screen

Arabic title:
المنتجات

Create a complete product master list.

Top KPI cards:

* إجمالي المنتجات
* المنتجات النشطة
* المنتجات الموقوفة
* أوزان ثابتة
* أوزان متحركة
* منتجات جانبية
* منتجات منخفضة المخزون
* منتجات بدون سعر

Desktop table columns:

* المنتج / الوزن
* التصنيف
* نوع المنتج
* وزن الحبة
* الحبات في الكرتونة
* وزن الكرتونة
* سعر البيع الافتراضي
* سعر الشراء الافتراضي
* الحد الأدنى للمخزون
* حالة الاستخدام
* الحالة
* الإجراءات

Mobile:
Use product cards instead of table.

Product status badges:

* نشط / Active = green
* موقوف / Disabled = gray/red
* ناقص إعدادات / Incomplete = amber
* يستخدم في الفواتير / In use = navy
* منخفض المخزون / Low stock = amber
* بدون سعر / Missing price = red/amber

Filters:

* Search by product name or weight
* Filter by category
* Filter by product type
* Filter active/inactive
* Filter missing price
* Filter missing carton rules
* Filter low stock
* Filter used in transactions

Actions:

* إضافة منتج
* تعديل
* عرض التفاصيل
* تعطيل المنتج
* نسخ المنتج
* عرض الأسعار الخاصة
* عرض حركة المخزون

2. Product Categories Screen

Arabic title:
تصنيفات المنتجات

Categories:

* دجاج كامل
* أوزان ثابتة
* أوزان متحركة
* أجزاء الدجاج
* منتجات جانبية
* خدمات تعبئة / تغليف
* لحوم أخرى placeholder
* أخرى

Category table/cards:

* Category name Arabic
* Category name English optional
* Description
* Active/inactive
* Product count
* Used in sales
* Used in purchases
* Actions

Actions:

* Add category
* Edit category
* Disable category

Warning:
“لا يمكن حذف تصنيف مستخدم في منتجات أو فواتير، يمكن إيقافه فقط.”

3. Add / Edit Product Screen

Arabic title:
إضافة منتج جديد

Use a guided form.

A. Basic Product Info
Fields:

* Product name Arabic
* Product name English optional
* Product code / SKU
* Category
* Product type:

  * وزن ثابت
  * وزن متحرك
  * جزء دجاج
  * منتج جانبي
  * خدمة / تكلفة
  * أخرى
* Active toggle
* Notes

B. Weight & Carton Rules

If product type = fixed weight:
Fields:

* Chicken weight in grams
* Default pieces per carton
* Allow manual pieces per carton toggle
* Carton weight preview in KG
* Default carton type:

  * 8 pieces
  * 10 pieces
  * Custom
* Allow KG override in invoice by permission

Formula preview:
وزن الكرتونة = وزن الحبة × عدد الحبات ÷ 1000

Example:
1000g × 10 pieces = 10 KG

If product type = moving weight:
Fields:

* Minimum weight starts from 1550g
* Manual chicken weight entry required
* Manual pieces per carton required
* Manual KG entry allowed
* Default pieces per carton optional
* Show warning:
  “هذا المنتج يحتاج إدخال الوزن يدوياً داخل الفاتورة.”

If product type = part/by-product:
Fields:

* Default unit:

  * KG
  * Tray
  * Piece
  * Carton
* Allow tray quantity
* Allow KG quantity
* Default conversion optional
* Example items:

  * Liver 500G
  * Gizzard 500G
  * Heart 500G
  * Feet 500G
  * Neck 500G
  * Boneless Breast
  * Whole Legs
  * Drumstick
  * Thighs
  * Wings
  * Bone
  * Others KG

C. Pricing Defaults
Fields:

* Default sales price
* Sales price type:

  * Price per KG
  * Price per piece
  * Price per carton
  * Price per tray
* Default purchase price
* Purchase price type:

  * Price per KG
  * Price per piece
  * Price per carton
  * Price per tray
* Minimum allowed sale price optional
* Warn if sale price below cost toggle
* VAT taxable toggle
* VAT rate uses company default

D. Inventory Defaults
Fields:

* Track inventory toggle
* Minimum stock cartons
* Minimum stock pieces
* Minimum stock KG
* Show low stock alert toggle
* Allow negative stock:

  * Always disabled
  * Show locked explanation:
    “لا يمكن بيع كمية أكبر من المخزون المتاح.”

E. Agreement Eligibility
Fields:

* Can be used in customer special prices
* Can be used in supplier special prices
* Can be free product for customers
* Can appear in quotations
* Can appear in sales invoices
* Can appear in purchase invoices

F. Save Actions
Buttons:

* Save product
* Save and add another
* Cancel

Validation:

* Product name required
* Category required
* Product type required
* Fixed weight requires grams
* Fixed weight cannot be zero
* Moving weight should be 1550g or above
* Default pieces per carton required for fixed weight
* Price cannot be negative
* Inventory minimum cannot be negative
* Duplicate product code warning
* Duplicate product weight warning if same category
* Cannot disable product if open draft invoices use it
* Product with approved transactions can be disabled but not deleted

4. Product Detail Screen

Arabic title example:
تفاصيل المنتج: دجاج 1000 جرام

Header:

* Product name
* Category badge
* Product type badge
* Active/inactive badge
* Current stock summary
* Default sales price
* Default purchase price
* Low stock status

Header actions:

* Edit product
* Disable product
* View inventory
* View sales
* View purchases
* View special prices
* Print product card

Tabs:

* نظرة عامة
* قواعد الوزن والكرتون
* الأسعار
* المخزون
* أسعار العملاء الخاصة
* أسعار الموردين الخاصة
* الفواتير المرتبطة
* سجل العمليات

5. Weight & Carton Rules Tab

Show:

* Product type
* Chicken weight grams
* Pieces per carton
* Carton weight KG
* Manual override rules
* Moving weight rules if applicable

Create a visual calculator:
Inputs:

* Cartons
* Pieces per carton
* Chicken weight grams
  Outputs:
* Total pieces
* Total KG
* Amount preview if price entered

Formula:
Total pieces = cartons × pieces per carton
Total KG = total pieces × weight grams ÷ 1000
Amount = KG × price per KG

Use simple Arabic labels:

* عدد الكراتين
* الحبات في الكرتونة
* وزن الحبة
* إجمالي الحبات
* إجمالي الكيلو
* الإجمالي

6. Product Pricing Tab

Show default pricing plus related customer/supplier prices.

Sections:
A. Default Pricing

* Sales price
* Sales price type
* Purchase price
* Purchase price type
* Last updated
* Updated by

B. Customer Special Prices
Table:

* Customer
* Special price
* Price type
* Difference from default
* Active/inactive
* Last updated
* Actions

C. Supplier Special Prices
Table:

* Supplier
* Special purchase price
* Price type
* Difference from default
* Active/inactive
* Last updated
* Actions

D. Price Change History
Table:

* Date
* User
* Field
* Old price
* New price
* Reason

Actions:

* Edit default price
* Add customer special price
* Add supplier special price
* Bulk update prices

Important:
Changing default price requires reason and audit log.

Show reason modal:
سبب تعديل السعر

7. Bulk Product Setup Screen

Arabic title:
إعداد المنتجات دفعة واحدة

Purpose:
Allow quick setup for common poultry weights.

Create a grid/table for weights:

* 400g
* 450g
* 500g
* 550g
* 600g
* 650g
* 700g
* 750g
* 800g
* 850g
* 900g
* 950g
* 1000g
* 1050g
* 1100g
* 1150g
* 1200g
* 1250g
* 1300g
* 1350g
* 1400g
* 1450g
* 1500g
* 1550g
* 1600g
* 1650g
* 1700g
* 1750g
* 1800g
* 1850g
* 1900g
* 1950g
* 2000g
* 2050g
* 2100g
* 2150g
* 2200g
* 2250g

Columns:

* Enable product
* Weight
* Product name
* Pieces per carton
* Sales price
* Purchase price
* Minimum stock
* Product type
* Active

Defaults:

* 400g to 1500g = Fixed Weight
* 1550g and above = Moving Weight / Big Weight
* Default pieces per carton:

  * 10 for smaller weights
  * 8 for bigger weights
  * editable by user

Actions:

* Select all common weights
* Save enabled products
* Preview created products

Warning:
“يمكن تعديل هذه القيم لاحقاً من ملف كل منتج.”

8. By-Products Setup Screen

Arabic title:
إعداد المنتجات الجانبية والأجزاء

Products:

* Liver 500G
* Gizzard 500G
* Heart 500G
* Feet 500G
* Neck 500G
* Boneless Breast
* Whole Legs
* Drumstick
* Thighs
* Wings
* Bone
* B.G
* Portion
* Others KG

Table columns:

* Enable
* Product name
* Category
* Default unit
* Sales price
* Purchase price
* Price type
* Track inventory
* Minimum stock
* Active

Default unit options:

* KG
* Tray
* Piece
* Carton

Actions:

* Save by-products
* Add custom by-product
* Disable unused item

9. Product Import / Export Screen

Arabic title:
استيراد وتصدير المنتجات

Purpose:
Allow future Excel product setup.

Sections:

* Download sample Excel template placeholder
* Upload product Excel placeholder
* Validate uploaded file placeholder
* Import preview table
* Export current products

Import validation examples:

* Missing product name
* Invalid weight
* Invalid price
* Duplicate product code
* Unknown category
* Invalid pieces per carton

Actions:

* Download template
* Upload file
* Validate
* Import
* Export Excel

Keep this as UI placeholder only.

10. Product Usage / Linked Records Screen

Arabic title:
استخدامات المنتج

Show where the product is used:

* Sales invoices
* Purchase invoices
* Quotations
* Inventory movements
* Customer special prices
* Supplier special prices
* Free product agreements

Table columns:

* Date
* Module
* Reference
* Customer/Supplier
* Quantity
* KG
* Amount
* Status
* Action

Purpose:
Explain why product cannot be deleted if already used.

Show warning:
“هذا المنتج مستخدم في معاملات سابقة، لذلك يمكن إيقافه فقط ولا يمكن حذفه.”

11. Product Audit Log Screen

Arabic title:
سجل عمليات المنتج

Track:

* Product created
* Product edited
* Product disabled
* Product reactivated
* Default sales price changed
* Default purchase price changed
* Pieces per carton changed
* Product type changed
* Minimum stock changed
* VAT taxable changed
* Customer special price added
* Supplier special price added

Columns:

* Date/time
* User
* Action
* Old value
* New value
* Reason
* Risk level

12. Product Settings Panel

Arabic title:
إعدادات المنتجات

Settings:

* Default pieces per carton for fixed weights
* Default pieces per carton for big weights
* Default minimum stock cartons
* Default minimum stock KG
* Enable low stock alerts for new products
* Allow customer special prices
* Allow supplier special prices
* Allow free products
* Require reason for price changes
* Require reason for carton rule changes
* Require reason for product disable
* Default VAT taxable
* Auto-create common poultry weights toggle
* Show product code/SKU toggle

Locked settings:

* Negative stock disabled
* FIFO costing method locked in inventory settings

13. Permission States

Owner/Admin:

* Can create/edit products
* Can disable/reactivate products
* Can edit default prices
* Can bulk setup products
* Can import/export products
* Can view product audit log
* Can change product settings

Accountant:

* Can view products
* Can edit prices if permission enabled
* Can view pricing/audit if permission enabled
* Can export products if permission enabled

Cashier/Sales:

* Can view active products
* Can use products in sales invoices
* Cannot edit products by default
* Cannot edit prices unless permission enabled
* Cannot view purchase cost unless permission enabled

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

14. Validation and Error States

Show:

* Missing product name
* Missing category
* Missing product type
* Invalid weight
* Moving weight below 1550g warning
* Missing pieces per carton
* Invalid pieces per carton
* Price cannot be negative
* Minimum stock cannot be negative
* Duplicate product code
* Duplicate product name/weight
* Product used in transactions cannot be deleted
* Product disabled warning in invoice selector
* Missing default price warning
* Reason required for price change
* Reason required for carton rule change
* Permission denied

15. Empty States

No products:
“لا توجد منتجات حالياً”
Button:
“إعداد المنتجات الأساسية”

No special prices:
“لا توجد أسعار خاصة لهذا المنتج”

No usage records:
“لا توجد معاملات مرتبطة بهذا المنتج”

No audit logs:
“لا توجد عمليات مسجلة لهذا المنتج”

16. Mobile Product Experience

Create mobile responsive screens.

Mobile behavior:

* Product list as cards
* Product setup as step-by-step cards
* Weight grid scrollable horizontally
* Product detail tabs as chips
* Pricing tables converted to cards
* Sticky save button
* Large inputs for carton/pieces/KG rules

17. Sample Data

Use realistic product sample data:

Products:

1. 900 GRAM
   Category: دجاج كامل
   Type: وزن ثابت
   Weight: 900g
   Pieces per carton: 10
   Carton weight: 9 KG
   Default sales price: AED 14.75 per KG
   Default purchase price: AED 1.15 per piece
   Minimum stock: 20 cartons
   Status: Active

2. 1000 GRAM
   Category: دجاج كامل
   Type: وزن ثابت
   Weight: 1000g
   Pieces per carton: 10
   Carton weight: 10 KG
   Default sales price: AED 14.75 per KG
   Default purchase price: AED 1.20 per piece
   Minimum stock: 20 cartons
   Status: Active

3. 1600 GRAM
   Category: أوزان متحركة
   Type: وزن متحرك
   Weight: manual
   Pieces per carton: 8
   Default sales price: AED 13.75 per KG
   Default purchase price: AED 1.15 per piece
   Status: Active

4. Liver 500G
   Category: منتجات جانبية
   Type: منتج جانبي
   Default unit: Tray/KG
   Default sales price: AED 4.00 per KG
   Default purchase price: AED 0.70 per tray
   Status: Active

5. Gizzard 500G
   Category: منتجات جانبية
   Type: منتج جانبي
   Default sales price: AED 4.00 per KG
   Default purchase price: AED 1.00 per tray
   Status: Active

Customer special price examples:

* مطعم الخليج: 1000 GRAM = AED 14.50 per KG
* سوبر ماركت المدينة: Liver = AED 3.75 per KG

Supplier special price examples:

* WESTLAND: 900 GRAM = AED 1.15 per piece
* MNM Foodstuff: Chilled Beef Chuck = AED 23.50 per KG

18. Navigation Integration

Connect:
Tenant sidebar “المنتجات” → Products List.
Tenant dashboard product/inventory cards → Products List or Inventory Overview depending on existing behavior.
Sales invoice product selector “Manage products” → Products List.
Purchase invoice product selector “Manage products” → Products List.
Customer special price “Product” field → Product selector.
Supplier special price “Product” field → Product selector.
Inventory product detail → Product Detail.
Product detail “View inventory” → Inventory Product Detail.
Product detail “View sales” → Sales Report filtered by product.
Product detail “View purchases” → Purchase Report filtered by product.

19. App.tsx Wiring

Add product-related TenantScreen values such as:

* products
* products-new
* product-detail
* product-categories
* products-bulk-setup
* products-byproducts
* products-import-export
* product-usage
* product-audit

Wire sidebar:
“المنتجات” should open Products List.

If sidebar does not currently have “المنتجات”, add it near المخزون.

Mobile bottom navigation:
Put Products under “المزيد” if there is no direct bottom nav item.

20. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, permissions, product formulas, product defaults, pricing visibility, and business rule clarity.

The final result should feel like a real production Product Master & Pricing Rules workflow for UAE poultry distribution companies, with fixed weights, moving weights, carton/piece/KG rules, default sales/purchase pricing, customer/supplier special prices, free product eligibility, inventory minimums, audit logs, and safe disabling instead of deletion.
