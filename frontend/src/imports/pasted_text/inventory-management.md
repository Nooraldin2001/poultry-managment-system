Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Inventory Management Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Arabic-first RTL layout
* English language switch
* Owner / Accountant / Cashier role views
* Tenant navigation

Now create the full tenant inventory workflow connected from:
Tenant Dashboard → Inventory summary cards / “عرض المخزون”
Tenant sidebar → المخزون

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Inventory must be extremely simple for poultry company owners. Show total available stock per product only. Do not expose complex batch/source supplier screens to normal users. The system can mention FIFO for costing, but do not make the user choose batches manually.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Confirmed inventory business rules:

* Inventory is tracked in the UI as total stock per product.
* Inventory quantities must show cartons, pieces, and KG together.
* There is one stock location only.
* No separate warehouse/mسلخ location screen.
* Purchases add stock only after purchase invoice approval.
* Sales deduct stock only after sales invoice approval.
* Quotations do not deduct stock.
* Cancelled approved sales return stock.
* Cancelled approved purchases remove/reverse stock only if stock is still available.
* System must prevent approving a sales invoice if stock is insufficient.
* Manual stock adjustments can be applied directly by authorized users.
* Inventory valuation and profit calculation use FIFO behind the scenes.
* Do not expose manual batch selection to normal users.
* FIFO should be displayed as a costing note only.

Required screens:

1. Inventory Overview Screen

Arabic title:
المخزون

Create a clean inventory control center.

Top KPI cards:

* إجمالي الكراتين المتاحة
* إجمالي الحبات المتاحة
* إجمالي الكيلو المتاح
* عدد المنتجات المتوفرة
* منتجات منخفضة المخزون
* منتجات نفدت من المخزون
* قيمة المخزون التقديرية
* مبيعات اليوم من المخزون

Use AED for inventory value.
Use KG clearly for weights.

Add simple date/context note:
“المخزون الحالي حسب آخر فواتير شراء وبيع معتمدة”

Add a small costing note:
“يتم حساب تكلفة المخزون والربح بطريقة FIFO تلقائياً دون الحاجة لاختيار الدفعات.”

2. Current Stock Table

Create a main stock table.

Desktop columns:

* المنتج / الوزن
* الكراتين المتاحة
* الحبات المتاحة
* الكيلو المتاح
* الحد الأدنى للمخزون
* حالة المخزون
* آخر شراء
* آخر بيع
* متوسط سعر البيع
* تكلفة FIFO التقديرية
* الإجراءات

Mobile:
Use product stock cards instead of table.

Status badges:

* متوفر / Available = green
* منخفض / Low = amber
* نفد / Out of Stock = red
* يحتاج مراجعة / Needs Review = gray/amber

Actions:

* عرض الحركة
* تعديل المخزون
* جرد المنتج
* طباعة بطاقة المنتج

Product examples:

* 500 GRAM
* 550 GRAM
* 600 GRAM
* 700 GRAM
* 750 GRAM
* 800 GRAM
* 850 GRAM
* 900 GRAM
* 950 GRAM
* 1000 GRAM
* 1050 GRAM
* 1100 GRAM
* 1150 GRAM
* 1200 GRAM
* 1250 GRAM
* 1300 GRAM
* 1350 GRAM
* 1400 GRAM
* 1450 GRAM
* 1500 GRAM
* 1550 GRAM
* 1600 GRAM
* Liver
* Gizzard
* Heart
* Breast
* Leg
* Wings
* Bone

3. Stock Filters and Search

Add simple filters:

* Search by product/weight
* Filter by status
* Filter by product category:

  * دجاج كامل
  * أوزان كبيرة
  * أجزاء
  * منتجات جانبية
* Filter by low stock only
* Filter by out of stock only
* Date range for movement summary

Keep filters simple and visible.

4. Product Stock Detail Screen

When clicking a product, create a product stock detail page.

Arabic title example:
مخزون دجاج 1000 جرام

Header cards:

* Available cartons
* Available pieces
* Available KG
* Minimum stock level
* Estimated FIFO cost
* Last purchase date
* Last sale date

Sections:
A. Stock Summary
Show:

* Total purchased
* Total sold
* Total returned
* Total adjusted
* Current balance

B. Movement History
Create a movement table.

Columns:

* التاريخ
* نوع الحركة
* المرجع
* الكراتين
* الحبات
* الكيلو
* الرصيد بعد الحركة
* المستخدم
* ملاحظات

Movement types:

* إضافة من فاتورة شراء
* خصم من فاتورة بيع
* إرجاع من إلغاء فاتورة بيع
* عكس فاتورة شراء
* تعديل يدوي زيادة
* تعديل يدوي نقص
* جرد مخزون

Use colors:

* Stock in = green
* Stock out = red
* Adjustment = amber
* System reversal = gray/navy

C. FIFO Costing Note
Add a simple explanation card:
“عند البيع، يتم احتساب تكلفة البضاعة المباعة من أقدم كميات شراء متاحة أولاً. هذا لا يحتاج أي اختيار يدوي من المستخدم.”

Do not show complex batch tables unless as collapsed advanced preview.

5. Manual Stock Adjustment Modal

Arabic title:
تعديل مخزون يدوي

This action can be applied directly by authorized users.

Fields:

* Product / الوزن
* Adjustment type:

  * زيادة
  * نقص
  * تصحيح رصيد
* Current cartons
* Current pieces
* Current KG
* New cartons or adjustment cartons
* New pieces or adjustment pieces
* New KG or adjustment KG
* Reason required
* Notes
* Attachment optional

Reasons:

* جرد فعلي
* تلف بضاعة
* فرق وزن
* خطأ إدخال
* بضاعة مفقودة
* بضاعة زائدة
* سبب آخر

Show before/after preview:

* Current balance
* Adjustment
* New balance

Warning for stock decrease:
“سيتم خصم الكمية من المخزون فوراً بعد الحفظ.”

Warning for stock increase:
“سيتم إضافة الكمية إلى المخزون فوراً بعد الحفظ.”

Validation:

* Reason required
* Quantity cannot be negative
* Cannot reduce more than available stock
* KG must be valid
* Cartons and pieces must be valid

Action buttons:

* تطبيق التعديل
* إلغاء

After success:
Show toast:
“تم تعديل المخزون بنجاح”
and add movement history record.

6. Stocktaking / Inventory Count Screen

Arabic title:
جرد المخزون

Create a simple stock count workflow.

Purpose:
Allow authorized users to compare system stock with actual counted stock.

Layout:

* Select products to count
* Show system cartons/pieces/KG
* Enter actual cartons/pieces/KG
* Difference auto-calculated
* Reason required for differences
* Apply adjustment

Table columns:

* المنتج
* رصيد النظام كرتون
* رصيد النظام حبة
* رصيد النظام كيلو
* الرصيد الفعلي كرتون
* الرصيد الفعلي حبة
* الرصيد الفعلي كيلو
* الفرق
* الحالة
* ملاحظات

Status:

* مطابق = green
* زيادة = amber/green
* نقص = red/amber
* يحتاج مراجعة = amber

Actions:

* حفظ كمسودة جرد
* تطبيق الفروقات
* تصدير الجرد
* طباعة الجرد

Since authorized users can apply directly, the apply button should be active only for users with permission.

Confirmation modal:
“هل تريد تطبيق فروقات الجرد؟ سيتم تعديل المخزون مباشرة وإنشاء حركة مخزون لكل منتج.”

7. Low Stock Alerts Screen

Arabic title:
تنبيهات انخفاض المخزون

Show:

* Products below minimum stock
* Products out of stock
* Products close to minimum
* Suggested reorder quantity

Table/card fields:

* Product
* Current cartons
* Current pieces
* Current KG
* Minimum level
* Shortage
* Suggested purchase
* Last supplier placeholder
* Action

Actions:

* إنشاء فاتورة شراء
* تعديل الحد الأدنى
* عرض حركة المنتج

Important:
Since UI does not track stock by supplier, “Last supplier” is informational only and should not imply batch selection.

8. Inventory Movement Screen

Arabic title:
حركة المخزون

Create a global movement history page.

Filters:

* Product
* Movement type
* Date range
* User
* Reference type:

  * Sales invoice
  * Purchase invoice
  * Manual adjustment
  * Stock count
  * Cancellation

Desktop table columns:

* التاريخ
* المنتج
* نوع الحركة
* المرجع
* كرتون
* حبة
* كيلو
* الرصيد بعد الحركة
* المستخدم
* ملاحظات

Mobile:
Movement cards.

Movement type examples:

* Purchase Approved: + stock
* Sales Approved: - stock
* Sales Cancelled: + stock
* Purchase Cancelled: - stock
* Manual Increase: + stock
* Manual Decrease: - stock
* Stocktaking Adjustment

Use signs:

* for stock added

- for stock deducted

9. Inventory Valuation / FIFO Screen

Arabic title:
تقييم المخزون والربح

This screen should be visible only to Owner and Accountant.

Purpose:
Show estimated inventory value and FIFO costing explanation.

Do not make this screen too complex.

Cards:

* قيمة المخزون الحالية
* تكلفة البضاعة المباعة هذا الشهر
* هامش الربح التقديري
* آخر تكلفة شراء
* متوسط سعر البيع

Add FIFO explanation:
“يعتمد النظام على FIFO: عند البيع يتم احتساب تكلفة البيع من أقدم كميات مشتراة أولاً.”

Show simple product valuation table:

* Product
* Available KG
* Available cartons
* Estimated FIFO cost
* Estimated stock value
* Last purchase cost
* Average selling price
* Estimated margin

Add warning:
“القيم تقديرية وتعتمد على فواتير الشراء والبيع المعتمدة.”

10. Inventory Settings Panel

Arabic title:
إعدادات المخزون

Fields:

* Enable low stock alerts
* Default minimum cartons
* Default minimum KG
* Allow manual stock adjustment
* Who can adjust stock:

  * Owner
  * Accountant
  * Cashier if permission enabled
* Allow negative stock: always disabled
* Costing method:

  * FIFO selected and locked
* Show FIFO explanation
* Product categories settings
* Default pieces per carton per weight

Important:
Show “Allow negative stock” as disabled/off with explanation:
“لا يمكن بيع كمية أكبر من المخزون المتاح.”

Show costing method as:
FIFO
Locked label:
“طريقة التكلفة المعتمدة للنظام”

11. Role and Permission States

Owner:

* Can view all inventory
* Can adjust stock
* Can run stocktaking
* Can view valuation/FIFO
* Can edit minimum stock levels
* Can access settings

Accountant:

* Can view stock
* Can view movement
* Can view valuation/FIFO
* Can adjust stock only if permission enabled
* Can run stocktaking only if permission enabled

Cashier:

* Can view available stock only
* Cannot view valuation/FIFO
* Cannot adjust stock unless permission enabled
* Cannot access inventory settings

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

12. Validation and Error States

Show:

* Stock cannot go below zero
* Manual adjustment reason required
* Invalid KG
* Invalid cartons
* Invalid pieces
* Low stock alert
* Out of stock alert
* Sale approval blocked because stock is insufficient
* Purchase approval adds stock successfully
* Sales cancellation returns stock successfully
* Purchase cancellation blocked because stock has already been sold
* Stock count differences found
* Stocktaking applied successfully
* FIFO valuation loading state
* No inventory yet empty state

Empty states:

* No inventory:
  “لا يوجد مخزون حالياً. ابدأ باعتماد أول فاتورة شراء.”
  Button:
  “إنشاء فاتورة شراء”

* No movement:
  “لا توجد حركات مخزون لهذا المنتج.”

* No low stock:
  “المخزون بحالة جيدة.”

13. Mobile Inventory Experience

Create mobile responsive inventory flow.

Mobile screens:

* Inventory overview cards
* Product stock cards
* Quick search
* Low stock alert cards
* Product detail as stacked cards
* Manual adjustment modal optimized for mobile
* Stocktaking table converted to cards

Mobile bottom sticky actions:

* تعديل مخزون
* جرد
* إنشاء شراء

Use large tap targets and simple Arabic.

14. Sample Data

Use realistic sample stock data:

Products:
900 GRAM

* Cartons: 34
* Pieces: 340
* KG: 306
* Minimum: 20 cartons
* Status: Available

1000 GRAM

* Cartons: 8
* Pieces: 80
* KG: 80
* Minimum: 20 cartons
* Status: Low

1100 GRAM

* Cartons: 24
* Pieces: 240
* KG: 264
* Minimum: 15 cartons
* Status: Available

1200 GRAM

* Cartons: 0
* Pieces: 0
* KG: 0
* Minimum: 15 cartons
* Status: Out of Stock

Liver

* KG: 13
* Minimum: 10 KG
* Status: Available

Gizzard

* KG: 5
* Minimum: 10 KG
* Status: Low

Sample movement history:

* Purchase invoice PUR-2026-00034 added 34 cartons / 340 pcs / 306 KG of 900 GRAM
* Sales invoice INV-2026-00046 deducted 4 cartons / 40 pcs / 36 KG of 900 GRAM
* Manual adjustment reduced 2 KG of Liver due to تلف بضاعة
* Sales cancellation returned 2 cartons / 20 pcs / 20 KG of 1000 GRAM

Sample valuation:

* Current inventory value: AED 128,450
* FIFO COGS this month: AED 298,000
* Estimated margin: 21.8%

15. Navigation Integration

Connect:
Tenant dashboard inventory card → Inventory Overview.
Tenant sidebar “المخزون” → Inventory Overview.
Inventory overview product row → Product Stock Detail.
Inventory overview “تعديل المخزون” → Manual Stock Adjustment modal.
Inventory overview “جرد المخزون” → Stocktaking screen.
Low stock alert “إنشاء فاتورة شراء” → New Purchase Invoice screen.
Product movement action → Movement History screen.
Inventory valuation shortcut → FIFO Valuation screen.
Inventory settings gear → Inventory Settings panel.

16. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, and business rule visibility.

The final result should feel like a real production inventory workflow for UAE poultry distribution companies, while keeping the UI simple: total stock per product, cartons/pieces/KG, direct manual adjustments by permission, FIFO costing behind the scenes, and no user-facing batch selection.
