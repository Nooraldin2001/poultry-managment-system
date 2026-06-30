Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Purchase Invoice Creation Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Arabic-first RTL layout
* English language switch
* Owner / Accountant / Cashier role views
* Tenant navigation

Now create the full tenant purchase workflow connected from:
Tenant Dashboard → Quick Action “فاتورة شراء جديدة”
and from sidebar:
المشتريات → فواتير الشراء

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
The purchase workflow must be simple enough for a non-technical poultry business owner, but detailed enough for accountants. Use guided steps, large fields, simple Arabic labels, strong warnings, and clear totals.

Use the existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Business rules:

* Purchase invoices may be based on KG × purchase price per KG.
* Purchase invoices may also be based on pieces/cartons × purchase price per piece.
* Supplier invoices often use the same poultry weight rows as sales:
  500g, 550g, 600g, 700g, 750g, 800g, 850g, 900g, 950g, 1000g, 1100g, etc.
* Inventory must be tracked using all three:

  1. Cartons
  2. Pieces
  3. KG
* Purchase invoice can be saved as Draft.
* Stock is added only after clicking “اعتماد فاتورة الشراء”.
* Draft purchase invoice does not affect inventory.
* Approved purchase invoice adds stock to inventory.
* Purchase invoice can be cash, bank, or credit/on-account.
* Supplier balance is updated only when supplier is account/credit supplier or when payment is partial.
* VAT 5% and supplier TRN must be supported but optional.
* Purchase price editing is controlled by permission settings.
* Purchase invoice print is an internal purchase record, not necessarily a formal customer tax invoice.
* User can upload the original supplier invoice as an attachment.

Important purchase cost rule:
Sometimes the supplier invoice amount is reduced by slaughter cost, transport cost, or other purchase-related deductions.

Example:
Supplier invoice amount = AED 10,000
Slaughter and transport deductions = AED 1,000
Net payable to supplier = AED 9,000

The UI must support purchase-related costs/deductions inside the purchase invoice.

Required screens:

1. Purchase Invoices List Screen

Arabic title:
فواتير الشراء

Desktop table columns:

* رقم فاتورة الشراء
* تاريخ الفاتورة
* المورد
* رقم فاتورة المورد
* عدد الكراتين
* إجمالي الحبات
* إجمالي الكيلو
* إجمالي البضاعة
* مصاريف/خصومات مرتبطة
* صافي المستحق للمورد
* المدفوع
* المتبقي
* الحالة
* طريقة الدفع
* المستخدم
* الإجراءات

Mobile layout:
Use purchase invoice cards instead of table.

Statuses:

* مسودة / Draft
* معتمدة / Approved
* مدفوعة / Paid
* مدفوعة جزئياً / Partially Paid
* على الحساب / Credit
* ملغاة / Cancelled

Filters:

* Search by purchase invoice number.
* Search by supplier name.
* Search by supplier invoice number.
* Filter by date.
* Filter by status.
* Filter by payment method.
* Filter by unpaid supplier invoices.
* Filter by product/weight.

Actions:

* إنشاء فاتورة شراء جديدة
* عرض
* تعديل المسودة
* اعتماد
* تسجيل دفعة للمورد
* إلغاء
* رفع فاتورة المورد
* تصدير سجل داخلي

2. New Purchase Invoice Screen

Arabic title:
فاتورة شراء جديدة

Top status:

* Purchase invoice status: Draft
* Auto purchase invoice number preview
* Date
* Created by user

Desktop layout:
Two-column layout:

* Main purchase builder area
* Right-side summary panel

Mobile layout:
Step-by-step card sections with sticky bottom totals.

Main sections:

A. Supplier Section

Fields:

* اختيار المورد
* Search supplier by name or phone.
* Add new supplier quick button.
* Supplier type:

  * كاش
  * حساب بنكي
  * آجل / على الحساب
* Supplier TRN optional.
* Supplier phone.
* Supplier current balance.
* Supplier payment terms.
* Supplier invoice number.
* Supplier invoice date.
* Upload supplier invoice file/image/PDF placeholder.

If supplier is cash and no balance tracking:
Show:
“هذا المورد كاش، لن يتم إنشاء رصيد مستحق إلا إذا تم اختيار دفع جزئي أو آجل.”

If supplier is credit:
Show:
“سيتم تحديث حساب المورد بعد اعتماد الفاتورة.”

B. Purchase Items Section

Create a purchase invoice table inspired by poultry supplier invoice formats.

Each line should support:

* المنتج / الوزن
* طريقة الشراء:

  * بالكيلو
  * بالحبة
  * بالكرتون
* الكرتون Ct
* عدد الحبات Pieces
* الكيلو Kg
* سعر الشراء
* نوع السعر:

  * سعر الكيلو
  * سعر الحبة
  * سعر الكرتون
* الإجمالي
* ملاحظات
* إجراء

Use poultry product rows:

* 400 GRAM
* 450 GRAM
* 500 GRAM
* 550 GRAM
* 600 GRAM
* 650 GRAM
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
* 1650 GRAM
* 1700 GRAM
* 1750 GRAM
* 1800 GRAM
* 1850 GRAM
* 1900 GRAM
* 1950 GRAM
* 2000 GRAM
* Liver
* Gizzard
* Heart
* Breast
* Leg
* Wings
* Bone
* B.G
* Portion
* Others KG

For fixed-weight chicken:
Allow system to suggest:
pieces = cartons × default pieces per carton
KG = pieces × weight in grams ÷ 1000

But allow manual override if user has permission.

For big/moving weights:
Allow manual pieces, cartons, and KG.

Line calculation rules:
If price type = سعر الكيلو:
Line amount = KG × purchase price per KG

If price type = سعر الحبة:
Line amount = pieces × purchase price per piece

If price type = سعر الكرتون:
Line amount = cartons × purchase price per carton

Show formula tooltip depending on selected price type:

* الإجمالي = الكيلو × سعر الكيلو
* الإجمالي = عدد الحبات × سعر الحبة
* الإجمالي = عدد الكراتين × سعر الكرتون

Add visible badges:

* تم تعديل الكيلو
* تم تعديل السعر
* شراء بالحبة
* شراء بالكيلو
* شراء بالكرتون

C. By-products and Portion Section

Create an optional section for poultry parts and by-products.

Title:
المنتجات الجانبية والأجزاء

Items:

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

Fields:

* Trays
* KG optional
* Rate
* Amount

This section should look similar to supplier invoices that split packed chicken and by-products.

D. Purchase-Related Costs / Deductions Section

Arabic title:
مصاريف وخصومات مرتبطة بفاتورة الشراء

Purpose:
Allow the company to record costs or deductions related to this purchase invoice.

Create toggle:

* Add as deduction from supplier payable
* Add as extra cost on purchase
* Record as separate expense linked to purchase

Common items:

* تكلفة الذبح
* تكلفة النقل
* تحميل وتنزيل
* تعبئة وتغليف
* رسوم مسلخ
* خصم من المورد
* فرق وزن
* سبب آخر

Fields:

* Type
* Description
* Amount
* Treatment:

  * Deduct from supplier payable
  * Add to product cost
  * Normal expense linked to purchase
* Notes

Show example preview:
إجمالي البضاعة: AED 10,000
خصومات/تكاليف مرتبطة: AED 1,000
صافي المستحق للمورد: AED 9,000

Important:
Clearly distinguish:

* Gross goods amount
* Purchase-related costs/deductions
* Net payable to supplier
* Cost value used for profit calculation

E. VAT Section

Fields:

* VAT enabled toggle
* VAT rate default 5%
* Supplier TRN optional
* Supplier invoice VAT amount
* VAT included/excluded toggle
* Allow changing VAT rate only with permission

Warnings:

* Supplier TRN missing
* VAT enabled but supplier invoice has no TRN
* VAT amount manually changed

Calculation:
VAT amount = taxable purchase amount × VAT rate
Total with VAT = taxable purchase amount + VAT

F. Payment Section

Payment options:

* كاش
* حساب بنكي
* آجل / على الحساب
* دفع جزئي

Fields:

* Amount paid now
* Remaining amount
* Payment method
* Bank account optional
* Payment reference optional
* Notes

Rules:

* If paid amount = net payable, status becomes Paid after approval.
* If paid amount > 0 and less than net payable, status becomes Partially Paid after approval.
* If paid amount = 0 and supplier is credit, status becomes Credit / On Account.
* Remaining amount updates supplier balance after approval.
* If supplier is cash but user chooses unpaid/partial, show warning:
  “سيتم إنشاء رصيد مستحق لهذا المورد بسبب وجود مبلغ غير مدفوع.”

G. Notes and Attachments

Fields:

* Purchase notes
* Internal notes
* Delivery notes
* Supplier invoice upload
* Slaughterhouse receipt upload
* Transport receipt upload

3. Save Draft and Approve Purchase Flow

Add sticky bottom action bar.

Actions:

* حفظ كمسودة
* معاينة سجل الشراء
* اعتماد فاتورة الشراء
* إلغاء

Draft behavior:

* Draft can be edited.
* Draft does not add stock.
* Draft does not update supplier balance.
* Draft can be deleted depending on permissions.

Approve behavior:
When user clicks “اعتماد فاتورة الشراء”:
Show confirmation modal:
“هل تريد اعتماد فاتورة الشراء؟ بعد الاعتماد سيتم إضافة الكميات إلى المخزون وتحديث حساب المورد.”

Confirmation modal must show:

* Total cartons
* Total pieces
* Total KG
* Goods total
* Purchase-related costs/deductions
* VAT amount
* Net payable to supplier
* Paid amount
* Remaining supplier balance
* Stock addition summary

Buttons:

* تأكيد الاعتماد
* رجوع

After approval success:
Show success card:
“تم اعتماد فاتورة الشراء وإضافة الكميات إلى المخزون بنجاح”

Actions:

* عرض المخزون
* تسجيل دفعة للمورد
* إنشاء فاتورة شراء جديدة
* الرجوع لقائمة المشتريات

4. Purchase Invoice Detail Screen

Create approved purchase detail screen.

Show:

* Purchase invoice status
* Supplier
* Supplier invoice number
* Supplier invoice date
* Uploaded supplier invoice preview placeholder
* Purchase totals
* Payment status
* Inventory addition status
* Linked inventory movement
* Linked supplier account movement
* Created by
* Approved by
* Approved time
* Audit history

Tabs:

* تفاصيل الفاتورة
* المنتجات
* المصاريف/الخصومات المرتبطة
* المدفوعات
* حركة المخزون
* حساب المورد
* المرفقات
* سجل العمليات

Actions:

* تسجيل دفعة للمورد
* إلغاء فاتورة الشراء
* رفع فاتورة المورد
* تصدير سجل داخلي
* تكرار الفاتورة

5. Internal Purchase Record Preview

Create an internal purchase record preview.

This is not necessarily a customer-facing tax invoice. It is an internal company record.

Header:

* Company logo
* Company name Arabic/English
* Internal Purchase Record / سجل شراء داخلي
* Purchase invoice number
* Date
* Supplier
* Supplier TRN optional
* Supplier invoice number
* Supplier invoice date

Table columns:

* Product / المنتج
* Purchase method / طريقة الشراء
* Ct / كرتونة
* Pieces / حبة
* Kg / كيلو
* Rate / السعر
* Rate type / نوع السعر
* Amount / المبلغ

Totals:

* Total cartons
* Total pieces
* Total KG
* Goods total
* VAT
* Purchase-related deductions/costs
* Net payable to supplier
* Paid
* Remaining

Footer:

* Prepared by
* Approved by
* Supplier invoice attachment reference
* Internal notes

Buttons:

* Print
* Export PDF
* Upload supplier invoice
* Send WhatsApp placeholder
* Send Email placeholder

6. Supplier Payment Recording Modal

Arabic title:
تسجيل دفعة للمورد

Fields:

* Purchase invoice
* Supplier
* Net payable
* Previously paid
* Current outstanding
* Amount paid
* Payment method
* Payment date
* Reference number
* Notes

Payment methods:

* Cash
* Bank transfer
* Cheque
* Other

After recording payment:

* Update paid amount.
* Update remaining amount.
* Update supplier balance.
* Issue payment receipt.
* Show button: Print Payment Receipt.

7. Cancel Approved Purchase Invoice Flow

Create cancellation confirmation modal.

Rules:

* Cancelling approved purchase invoice removes/returns stock from inventory if stock is still available.
* Cancelling updates supplier balance.
* Cancelling requires permission.
* User must enter cancellation reason.
* Cancelled purchase invoice cannot be edited.
* Cancelled purchase invoice remains visible for audit.

Important warning:
If any stock from this purchase has already been sold, show:
“لا يمكن إلغاء الفاتورة بالكامل لأن جزءاً من المخزون تم بيعه. استخدم تعديل مخزون أو تسوية لاحقاً.”

Modal fields:

* Reason
* Confirm checkbox:
  “أفهم أن إلغاء فاتورة الشراء سيؤثر على المخزون وحساب المورد.”

8. Permissions Visual States

Tenant Admin / Owner:

* Can create purchase invoice.
* Can edit draft.
* Can approve purchase invoice.
* Can edit purchase price if allowed.
* Can edit KG/cartons/pieces if allowed.
* Can add purchase-related costs/deductions.
* Can cancel approved purchase invoice.
* Can upload supplier invoice.
* Can record supplier payments.

Accountant:

* Can view purchase invoices.
* Can record supplier payments.
* Can view supplier account.
* Can view VAT.
* Can approve purchase invoice only if permission enabled.
* Can edit costs/deductions only if permission enabled.

Cashier / Sales:
Usually should not access purchases unless permission is enabled.

Permission settings controlled by Tenant Admin:

* Can create purchase draft: yes/no
* Can approve purchase: yes/no
* Can edit purchase price: yes/no
* Can edit quantities/cartons/KG: yes/no
* Can change VAT: yes/no
* Can add purchase-related costs/deductions: yes/no
* Can cancel purchase invoice: yes/no
* Can record supplier payment: yes/no
* Can upload supplier invoice: yes/no

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

9. Validation and Error States

Show:

* Missing supplier.
* Missing supplier invoice number warning.
* Duplicate supplier invoice number warning.
* Invalid KG.
* Invalid carton count.
* Invalid pieces count.
* Missing purchase price.
* Invalid price type.
* VAT enabled but supplier TRN missing warning.
* Purchase-related deduction greater than goods total.
* Payment amount greater than net payable.
* Supplier invoice attachment missing warning.
* Approval blocked due to invalid lines.
* Draft saved successfully.
* Purchase approved and stock added.
* Supplier balance updated.
* Cannot cancel because stock was already sold.
* Permission denied.

10. Mobile Purchase Experience

Create mobile-friendly purchase invoice creation flow.

Mobile sections:

* Supplier
* Products
* By-products
* Costs/Deductions
* VAT
* Payment
* Preview

Use large product cards instead of dense table.

Each product card:

* Product/weight
* Purchase method
* Ct input
* Pieces input
* KG input
* Rate input
* Rate type
* Amount
* Notes

Sticky bottom summary:

* Total KG
* Net payable
* Save Draft
* Approve

Floating quick button:
“إضافة منتج”

11. Sample Data

Use realistic UAE sample data.

Suppliers:

* WESTLAND FOODSTUFF TRADING LLC
* MNM Foodstuff Trading LLC
* مزرعة العين للدواجن
* شركة الإمارات للدواجن

Products:

* 700 GRAM, Ct 6, Pieces 60, Rate 1.15, Amount 69
* 750 GRAM, Ct 11, Pieces 110, Rate 1.15, Amount 126.50
* 800 GRAM, Ct 20, Pieces 200, Rate 1.15, Amount 230
* 900 GRAM, Ct 34, Pieces 340, Rate 1.15, Amount 391
* 1000 GRAM, Ct 36, Pieces 360, Rate 1.15, Amount 414
* 1100 GRAM, Ct 24, Pieces 240, Rate 1.15, Amount 276
* 1200 GRAM, Ct 15, Pieces 150, Rate 1.15, Amount 172.50
* Liver 500G, Trays 170, Rate 0.70, Amount 119
* Gizzard 500G, Trays 59, Rate 1.00, Amount 59
* Heart 500G, Trays 29, Rate 0.70, Amount 20.30
* Boneless Breast, Trays 17, Rate 1.25, Amount 21.25
* Wings, Trays 7, Rate 1.25, Amount 8.75

Sample totals:

* Goods subtotal: AED 3,305.55
* VAT 5%: AED 165.28
* Payable amount: AED 3,470.83

Alternative sample:

* Goods total: AED 10,000
* Slaughter deduction: AED 700
* Transport deduction: AED 300
* Net payable to supplier: AED 9,000

12. Navigation Integration

Connect:
Tenant Dashboard “فاتورة شراء جديدة” button → New Purchase Invoice screen.
Tenant sidebar “المشتريات” → Purchase Invoices List.
Purchase list “إنشاء فاتورة شراء جديدة” → New Purchase Invoice.
Approved purchase “تسجيل دفعة للمورد” → Supplier Payment modal.
Approved purchase “رفع فاتورة المورد” → Attachment section.
Approved purchase “عرض حركة المخزون” → Inventory movement tab.

13. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, and business rule visibility.

The final result should feel like a real production purchase invoice workflow for UAE poultry distribution companies, with support for KG-based purchases, piece-based purchases, carton-based purchases, VAT, supplier TRN, uploaded supplier invoices, purchase-related costs/deductions, supplier balances, stock addition after approval, and permission-controlled edits.
