Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the whole app. Extend the current Tenant / Company Dashboard by adding the complete Sales Invoice Creation Workflow.

The current app already has:

* Super Admin SaaS dashboard.
* Tenant dashboard.
* Arabic-first RTL layout.
* English language switch.
* Owner / Accountant / Cashier role views.
* Tenant navigation.
* Quick action button: “فاتورة بيع جديدة”.

Now create the full tenant sales invoice workflow connected from:
Tenant Dashboard → Quick Action “فاتورة بيع جديدة”
and from sidebar:
المبيعات → فواتير البيع

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
This workflow must be simple enough for a non-technical poultry company owner or cashier to use. Use large inputs, clear labels, big action buttons, simple Arabic, strong visual warnings, and guided steps. Avoid complicated accounting terms in the main UI.

Use the existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Business model for sales invoice:

* Sales are mainly based on KG.
* The invoice line must include carton count, KG, price per KG, and total amount.
* Inventory deduction must track all three together:

  1. Cartons
  2. Pieces
  3. KG
* The invoice can be saved as Draft first.
* Inventory is deducted only after clicking “اعتماد الفاتورة / Approve Invoice”.
* Quotations do not deduct inventory.
* Approved invoice cancellation returns stock to inventory.
* Approved invoice edits must be controlled by permissions and audit logs.
* Discounts during collection may happen after approval due to dead chicken, customer settlement, trader decision, or commercial discount.
* Post-approval money discounts should be represented as “خصم عند التحصيل / Collection Adjustment” and should reduce the customer outstanding balance without changing original stock quantities.

Required Screens:

1. Sales Invoices List Screen
   Create a full sales invoice list page.

Arabic title:
فواتير البيع

Desktop table columns:

* رقم الفاتورة
* التاريخ
* العميل
* عدد الكراتين
* إجمالي الكيلو
* الإجمالي قبل الضريبة
* الضريبة
* الإجمالي النهائي
* المدفوع
* المتبقي
* الحالة
* طريقة الدفع
* المستخدم
* الإجراءات

Mobile layout:
Use invoice cards instead of a table.

Invoice statuses:

* مسودة / Draft
* معتمدة / Approved
* مدفوعة جزئياً / Partially Paid
* مدفوعة / Paid
* ملغاة / Cancelled
* عليها تعديل تحصيل / Adjusted at Collection

Filters:

* Search by invoice number.
* Search by customer.
* Filter by date.
* Filter by status.
* Filter by payment method.
* Filter by unpaid invoices.
* Filter by user/cashier.

Actions:

* إنشاء فاتورة بيع جديدة
* عرض
* تعديل المسودة
* اعتماد
* طباعة
* تصدير PDF
* تسجيل تحصيل
* إلغاء الفاتورة

Show warning badge if invoice is approved but not fully paid.

2. New Sales Invoice Screen
   Create a full invoice creation page with a clear workflow.

Page title:
فاتورة بيع جديدة

Top status:

* Invoice status: Draft
* Auto invoice number preview
* Date
* Created by user
* Branch/location placeholder if needed

Layout:
Use a two-column desktop layout:

* Main invoice builder area
* Right-side summary panel

On mobile:
Use step-by-step sections with sticky bottom action bar.

Main sections:

A. Customer Section
Fields:

* اختيار العميل
* Search customer by name or phone.
* Add new customer quick button.
* Customer type:

  * كاش
  * آجل / على الحساب
* Customer TRN optional.
* Customer phone.
* Customer current balance.
* Customer credit warning.
* Customer special pricing badge if available.

If customer has a special price agreement, show:
“يوجد سعر خاص لهذا العميل”

If customer has outstanding balance, show:
“على العميل مبلغ مستحق: AED X”

If customer exceeded credit limit placeholder, show warning:
“تحذير: العميل تجاوز الحد الائتماني”

B. Invoice Items Section
Create an invoice table inspired by real poultry tax invoices.

Each line should have:

* المنتج / الوزن
* الكرتون Ct
* عدد الحبات Pieces
* الكيلو Kg
* سعر الكيلو
* الإجمالي
* حالة المخزون
* إجراء

Use poultry product rows like:

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
* 1550 GRAM and above as moving/custom weight
* Liver
* Gizzard
* Heart
* Breast
* Leg
* Wings
* Bone

Make the table work like the paper invoice samples:

* Product/weight is listed on the left.
* User enters carton count.
* User enters or confirms KG.
* User enters or confirms price per KG.
* System calculates amount.
* Empty rows show dash or zero.

Important:
For fixed weights, allow system to suggest KG automatically based on:
cartons × pieces per carton × chicken weight in grams ÷ 1000

But also allow manual KG override if the user has permission.

For moving weights 1550g and above:

* Allow manual weight input.
* Allow manual pieces per carton.
* Allow manual KG.

Line calculation:
line amount = KG × price per KG

Show formula in a simple tooltip:
الإجمالي = الكيلو × سعر الكيلو

Add totals:

* Total cartons
* Total pieces
* Total KG
* Total before VAT
* VAT amount
* Grand total

C. Price Handling
Pricing rules:

* Default product price loads automatically.
* Customer-specific price overrides default price if available.
* User can manually edit price only if permission is enabled.
* If price was manually changed, show badge:
  “تم تعديل السعر”
* If product is free, allow setting price to 0 only if permission is enabled.
* Show free product badge:
  “منتج مجاني”

Add warning if price is below cost:
“تحذير: السعر أقل من تكلفة الشراء”
This warning can be visible to Owner and Accountant only.

D. Inventory Availability
Show real-time inventory availability per line:

* Available cartons
* Available pieces
* Available KG
* Source stock batch/supplier placeholder
* Status:

  * متوفر
  * منخفض
  * غير كافي

If entered quantity exceeds available stock:

* Highlight line in red.
* Show message:
  “الكمية المطلوبة أكبر من المخزون المتاح”
* Disable Approve Invoice button.
* Allow Save Draft.

Add an inventory summary card:

* Total stock needed by this invoice
* Total available stock
* Products with shortages
* Button: “عرض حركة المخزون”

E. Tax Section
Support UAE tax invoice fields:

* VAT enabled toggle
* VAT rate default 5%
* Allow changing VAT rate only if permission enabled.
* Company TRN from settings.
* Customer TRN optional.
* Tax amount auto calculated.
* Show warning if company TRN is missing:
  “رقم TRN غير موجود في الإعدادات”
* Show warning if stamp/signature missing:
  “الختم أو التوقيع غير مرفوع في الإعدادات”

Calculation:
VAT amount = total before VAT × VAT rate
Grand total = total before VAT + VAT amount

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

* If paid amount = grand total, invoice status becomes Paid after approval.
* If paid amount > 0 and less than grand total, status becomes Partially Paid after approval.
* If paid amount = 0 and customer type is credit, status becomes Approved / Unpaid.
* Remaining amount updates customer balance after approval.

G. Notes and Attachments
Fields:

* Invoice notes
* Internal notes
* Delivery notes
* Attach document placeholder

3. Save Draft and Approve Flow
   Add sticky bottom action bar.

Actions:

* حفظ كمسودة
* معاينة الفاتورة
* اعتماد الفاتورة
* إلغاء

Draft behavior:

* Draft can be edited.
* Draft does not deduct stock.
* Draft does not update customer balance.
* Draft can be deleted depending on permissions.

Approve behavior:
When user clicks “اعتماد الفاتورة”:
Show confirmation modal:
“هل تريد اعتماد الفاتورة؟ بعد الاعتماد سيتم خصم الكميات من المخزون وتحديث حساب العميل.”

Confirmation modal must show:

* Total cartons
* Total pieces
* Total KG
* Grand total
* Paid amount
* Remaining amount
* Stock deduction summary

Buttons:

* تأكيد الاعتماد
* رجوع

After approval success:
Show success screen/card:
“تم اعتماد الفاتورة بنجاح”
Actions:

* طباعة الفاتورة
* تسجيل تحصيل
* إنشاء فاتورة جديدة
* الرجوع لقائمة الفواتير

4. Invoice Preview / Print Screen
   Create a formal UAE Tax Invoice preview.

The invoice must include Arabic and English labels on the same invoice.

Invoice header:

* Company logo
* Company Arabic name
* Company English name
* Address
* Phone
* TRN
* TAX INVOICE / فاتورة ضريبية
* Invoice number
* Date
* Customer name
* Customer TRN
* Customer type:

  * Cash
  * Credit

Invoice table:
Columns:

* Product / المنتج
* Ct / كرتونة
* Pieces / حبة
* Kg / كيلو
* Price / سعر الكيلو
* Amount / المبلغ

Rows:
Use the poultry weights and parts list.

Totals:

* Total cartons
* Total pieces
* Total KG
* Total before VAT
* VAT 5%
* Grand Total
* Amount in words placeholder
* Receiver signature
* Company stamp
* Company signature

Include stamp/signature placeholders from settings.
Create a visual style close to real UAE poultry tax invoices:

* Dense table
* Bilingual labels
* Clear blue/navy header
* Large Tax Invoice title
* Company stamp area
* Receiver signature area
* Total box at bottom

Add print/export buttons:

* Print
* Export PDF
* Send WhatsApp placeholder
* Send Email placeholder

5. Approved Invoice Detail Screen
   Create a detail screen for approved invoice.

Show:

* Invoice status
* Customer
* Invoice totals
* Payment status
* Inventory deduction status
* Linked inventory movement
* Linked customer account movement
* Created by
* Approved by
* Approved time
* Audit history

Tabs:

* Invoice
* Payments
* Collection Adjustments
* Inventory Movement
* Audit Log

Actions:

* Print
* Export PDF
* Record Collection
* Add Collection Discount
* Cancel Invoice
* Duplicate Invoice
* Create Return placeholder

6. Collection / Payment Recording Screen
   Create screen/modal:
   تسجيل تحصيل

Fields:

* Invoice
* Customer
* Grand total
* Previously paid
* Current outstanding
* Amount collected
* Payment method
* Payment date
* Reference number
* Notes

Payment methods:

* Cash
* Bank transfer
* Cheque
* Other

After recording collection:

* Update paid amount.
* Update remaining amount.
* Update customer balance.
* Issue receipt.
* Show button: Print Receipt.

7. Collection Discount / Post-Approval Adjustment
   Create a special workflow because poultry traders may discount during collection.

Arabic title:
خصم عند التحصيل

Use cases:

* دجاج نافق
* خصم تجاري
* تسوية مع العميل
* فرق وزن
* قرار من صاحب الشركة
* سبب آخر

Fields:

* Invoice
* Customer
* Original outstanding amount
* Discount amount
* Reason
* Notes
* Approved by
* Attachment placeholder

Rules:

* This adjustment reduces customer outstanding balance.
* This adjustment does not change original approved invoice quantities.
* This adjustment does not return inventory automatically.
* If inventory return is needed, user must create a separate return/stock adjustment workflow later.
* Adjustment must appear in customer statement.
* Adjustment must appear in audit log.
* Adjustment requires permission.

Show before/after preview:

* Original invoice total
* Paid amount
* Outstanding before adjustment
* Discount amount
* Outstanding after adjustment

Show warning:
“هذا الخصم سيؤثر على رصيد العميل فقط ولن يغير كميات المخزون في الفاتورة المعتمدة.”

8. Cancel Approved Invoice Flow
   Create cancellation confirmation modal.

Rules:

* Cancelling an approved invoice returns stock to inventory.
* Cancelling updates customer balance.
* Cancelling requires permission.
* User must enter cancellation reason.
* Cancelled invoice cannot be edited.
* Cancelled invoice remains visible for audit.

Modal fields:

* Reason
* Confirm checkbox:
  “أفهم أن إلغاء الفاتورة سيعيد الكمية إلى المخزون ويعدل حساب العميل.”

9. Permissions Visual States
   Design role/permission behavior.

Tenant Admin / Owner:

* Can create invoice.
* Can edit draft.
* Can approve invoice.
* Can edit price if allowed.
* Can edit KG/cartons if allowed.
* Can apply free product.
* Can cancel approved invoice.
* Can add collection adjustment.
* Can print/export.

Accountant:

* Can record collections.
* Can view tax.
* Can view customer balance.
* Can apply collection discount only if permission enabled.
* Can approve invoice only if permission enabled.

Cashier / Sales:
Permission settings controlled by Tenant Admin:

* Can create draft invoices.
* Can approve invoices: yes/no.
* Can edit prices: yes/no.
* Can edit quantities/cartons/KG: yes/no.
* Can apply discount: yes/no.
* Can apply free product: yes/no.
* Can edit VAT: yes/no.
* Can cancel invoice: yes/no.
* Can record collection: yes/no.

Show disabled buttons with tooltips:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

10. Validation and Error States
    Show the following:

* Missing customer.
* Missing product quantity.
* Invalid KG.
* Invalid carton count.
* Price is missing.
* Stock not enough.
* TRN missing warning.
* Stamp/signature missing warning.
* VAT disabled warning.
* Customer balance overdue.
* Price below cost.
* Draft saved successfully.
* Approval failed due to stock shortage.
* Payment amount greater than invoice total.
* Discount amount greater than outstanding balance.
* Cancel reason required.

11. Mobile Sales Invoice Experience
    Create a mobile-friendly invoice creation flow.

Mobile sections:

* Customer
* Products
* Totals
* Payment
* Preview

Use large cards instead of dense tables.

For products on mobile:
Each product row should be a card:

* Product name/weight
* Ct input
* Pieces input
* KG input
* Price input
* Amount
* Stock badge

Add sticky bottom summary:

* Total KG
* Grand Total
* Save Draft
* Approve

Add floating quick button:
“إضافة منتج”

12. Sample Data
    Use realistic UAE sample data.

Company:
Prime Fresh Meat LLC

Customers:

* مطعم الخليج
* سوبر ماركت المدينة
* مطبخ الإمارات
* Prime Fresh Meat LLC

Products:

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
* Liver
* Gizzard
* Heart
* Breast
* Leg
* Wings
* Bone

Sample invoice line examples:

* 1100 GRAM, Ct 2, Pieces 20, Kg 22, Price 14.75, Amount 324.50
* 1200 GRAM, Ct 2, Pieces 20, Kg 24, Price 14.75, Amount 354.00
* 1250 GRAM, Ct 2, Pieces 20, Kg 25, Price 14.75, Amount 368.75
* 1300 GRAM, Ct 4, Pieces 40, Kg 52, Price 14.75, Amount 767.00
* Liver, Kg 13, Price 4, Amount 52.00
* Gizzard, Kg 5, Price 4, Amount 20.00

Sample totals:

* Total before VAT: AED 1,906.25
* VAT 5%: AED 95.31
* Grand Total: AED 2,001.56

13. Navigation Integration
    Connect:
    Tenant Dashboard “فاتورة بيع جديدة” button → New Sales Invoice screen.
    Tenant sidebar “المبيعات” → Sales Invoice List.
    Invoice list “إنشاء فاتورة بيع جديدة” → New Sales Invoice.
    Approved invoice “تسجيل تحصيل” → Collection screen.
    Approved invoice “خصم عند التحصيل” → Collection Adjustment screen.
    Approved invoice “طباعة” → Invoice Preview.

14. Do Not Build Backend Logic
    This is still Figma Make UI/UX work.
    Use realistic mock data.
    Focus on screens, flows, states, responsiveness, and business rule visibility.

The final result should feel like a real production sales invoice workflow for UAE poultry distribution companies, with strong support for carton/KG pricing, formal tax invoice printing, customer balances, partial payments, collection discounts, stock deduction after approval, and role-based permissions.
