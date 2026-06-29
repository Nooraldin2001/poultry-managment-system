Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Quotations Workflow.

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
* Product Master & Pricing Rules workflow
* Arabic-first RTL layout
* English language switch
* Owner/Admin, Accountant, and Cashier/Sales role views
* Tenant navigation
* Separate module files such as ProductModule, CustomerModule, SupplierModule, PurchaseModule, InventoryModule, ExpensesModule, ReportsModule, and SettingsModule

Implementation direction:
Create a self-contained QuotationsModule file if that matches the current project structure. Keep files balanced and avoid making App.tsx too large. Wire quotation screens into App.tsx using targeted edits only.

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Quotations must be as easy as creating a sales invoice, but clearly show that this is only a price offer. Use simple Arabic, large buttons, clear status badges, and strong warnings that quotations do not deduct stock and do not update customer balance.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Confirmed quotation business rules:

* Quotation can be created for a customer.
* Quotation contains products, cartons, pieces, KG, price, discount, VAT, and total.
* Quotation uses customer special prices when available.
* Quotation can include manually entered price if permission allows.
* Quotation can include free products at zero price if customer agreement or permission allows.
* Quotation calculates item weight and amount automatically.
* Quotation calculates total cartons, pieces, KG, subtotal, VAT, and grand total.
* Quotation can apply VAT or disable VAT depending on settings and permission.
* Quotation can be printed/exported.
* Quotation can be sent by WhatsApp as premium feature.
* Quotation can be converted to sales invoice.
* Creating quotation does not deduct stock.
* Creating quotation does not update customer balance.
* Converting quotation to sales invoice should copy all quotation data into sales invoice draft.
* Stock deduction happens only after sales invoice approval, not when quotation is created.
* Quotation should show stock availability as warning only, because stock may change before conversion.
* Quotation can expire.
* Quotation can be accepted, rejected, expired, cancelled, or converted.

Required screens:

1. Quotations List Screen

Arabic title:
عروض الأسعار

Create a complete quotations management page.

Top KPI cards:

* إجمالي عروض الأسعار
* عروض مفتوحة
* عروض مقبولة
* عروض محولة لفواتير
* عروض منتهية
* قيمة العروض المفتوحة
* عروض هذا الشهر
* معدل التحويل لفواتير

Desktop table columns:

* رقم عرض السعر
* التاريخ
* العميل
* تاريخ الانتهاء
* عدد الكراتين
* إجمالي الكيلو
* الإجمالي قبل الضريبة
* الضريبة
* الإجمالي النهائي
* الحالة
* أنشأ بواسطة
* الإجراءات

Mobile layout:
Use quotation cards instead of dense table.

Statuses:

* مسودة / Draft
* مرسل / Sent
* مقبول / Accepted
* مرفوض / Rejected
* منتهي / Expired
* محول لفاتورة / Converted
* ملغي / Cancelled

Status colors:

* Draft = gray
* Sent = navy
* Accepted = green
* Rejected = red
* Expired = amber/red
* Converted = green/navy
* Cancelled = gray/red

Filters:

* Search by quotation number
* Search by customer
* Filter by date
* Filter by expiry date
* Filter by status
* Filter by created by user
* Filter by converted/not converted

Actions:

* إنشاء عرض سعر جديد
* عرض
* تعديل المسودة
* طباعة
* تصدير PDF
* إرسال واتساب premium
* تحويل إلى فاتورة بيع
* قبول العرض
* رفض العرض
* إلغاء العرض

Important:
If quotation is converted, show linked sales invoice number.

2. New Quotation Screen

Arabic title:
عرض سعر جديد

Top status:

* Quotation status: Draft
* Auto quotation number preview
* Date
* Expiry date
* Created by user
* Customer

Add prominent info banner:
“عرض السعر لا يخصم من المخزون ولا يضيف رصيد على العميل. يتم خصم المخزون فقط عند تحويله إلى فاتورة بيع واعتماد الفاتورة.”

Desktop layout:
Two-column layout:

* Main quotation builder area
* Right-side quotation summary panel

Mobile:
Step-by-step sections with sticky bottom action bar.

Main sections:

A. Customer Section
Fields:

* اختيار العميل
* Search customer by name or phone
* Add new customer quick button
* Customer type:

  * كاش
  * آجل / على الحساب
* Customer phone
* Customer TRN optional
* Customer current balance
* Customer credit limit status
* Customer special pricing badge if available

If customer has special price agreement:
Show:
“يوجد سعر خاص لهذا العميل”

If customer has free product agreement:
Show:
“يوجد اتفاق منتجات مجانية لهذا العميل”

Credit warning:
If customer exceeds credit limit, show warning only:
“العميل تجاوز الحد الائتماني. يمكن إنشاء عرض السعر، ولكن قد يتم منع اعتماد فاتورة البيع لاحقاً.”

B. Quotation Items Section

Create a quotation table similar to sales invoice table.

Each line should include:

* المنتج / الوزن
* الكرتون Ct
* عدد الحبات Pieces
* الكيلو Kg
* سعر الكيلو / السعر
* الخصم
* الإجمالي
* حالة المخزون
* إجراء

Product rows:

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

For fixed weights:
Suggest KG automatically:
cartons × pieces per carton × chicken weight in grams ÷ 1000

Allow manual KG override if permission enabled.

For moving weights:
Allow manual weight, manual pieces per carton, and manual KG.

Line calculation:
Line amount = KG × price per KG - line discount

Show formula tooltip:
الإجمالي = الكيلو × السعر - الخصم

C. Pricing Rules

* Load default product price.
* Apply customer special price automatically if available.
* Show badge:
  “سعر خاص للعميل”
* If user manually changes price, show badge:
  “تم تعديل السعر”
* If product is free, show badge:
  “منتج مجاني”
* Show below-cost warning to Owner/Accountant only:
  “تحذير: السعر أقل من تكلفة الشراء”
* Manual price edit requires permission.
* Free product requires permission unless already in customer agreement.

D. Stock Availability Warning
Quotation does not reserve stock and does not deduct stock.

Show stock status per line:

* متوفر الآن
* منخفض الآن
* غير متوفر الآن

If not enough stock:
Show amber/red warning:
“المخزون الحالي غير كافي، لكن يمكن حفظ عرض السعر. سيتم التحقق مرة أخرى عند تحويل العرض إلى فاتورة.”

Do not disable save quotation because of stock shortage.
Disable conversion to sales invoice only if user chooses direct approval and stock is not enough.

E. Discount Section
Support:

* Line discount
* Overall quotation discount
* Percentage discount
* Fixed AED discount

Fields:

* Discount type:

  * لا يوجد
  * نسبة
  * مبلغ ثابت
* Discount reason
* Notes

If discount is applied:
Show badge:
“يوجد خصم”

Discount requires permission if settings require it.
Reason required for discount if sensitive action rules require it.

F. VAT Section
Fields:

* VAT enabled toggle
* VAT rate default 5%
* Customer TRN optional
* Company TRN from settings
* VAT amount auto calculated

Warnings:

* Company TRN missing
* Customer TRN missing warning
* VAT disabled requires reason if settings require it
* VAT changed manually requires reason

Calculation:
VAT amount = taxable subtotal after discount × VAT rate
Grand total = subtotal after discount + VAT amount

G. Terms & Conditions Section
Fields:

* Valid until / expiry date
* Delivery terms
* Payment terms
* Notes visible to customer
* Internal notes
* Footer note

Sample terms:

* الأسعار صالحة حتى تاريخ الانتهاء الموضح.
* الكميات حسب توفر المخزون وقت إصدار الفاتورة.
* الأسعار لا تشمل أي مصاريف إضافية إلا إذا تم ذكرها.
* يتم اعتماد الفاتورة بعد موافقة العميل.

3. Save / Send / Approve Flow

Sticky action bar:

* حفظ كمسودة
* معاينة عرض السعر
* إرسال للعميل
* حفظ وإرسال
* إلغاء

Draft behavior:

* Draft can be edited.
* Draft does not affect stock.
* Draft does not affect customer balance.
* Draft does not create payment.

Send behavior:
When clicking “إرسال للعميل”:
Show modal:
“هل تريد إرسال عرض السعر للعميل؟”
Options:

* Print/PDF
* WhatsApp premium
* Email placeholder
* Copy share message

If WhatsApp premium locked:
Show locked state:
“إرسال واتساب متاح في باقات Pro و Enterprise.”
Allow:

* Copy message manually

4. Quotation Preview / Print Screen

Arabic title:
معاينة عرض السعر

Create a formal bilingual quotation document.

Header:

* Company logo
* Company Arabic name
* Company English name
* Address
* Phone
* TRN
* QUOTATION / عرض سعر
* Quotation number
* Date
* Expiry date
* Customer name
* Customer TRN
* Customer type

Important:
This is not a tax invoice.
Add label:
“عرض سعر وليس فاتورة ضريبية”

Quotation table columns:

* Product / المنتج
* Ct / كرتونة
* Pieces / حبة
* Kg / كيلو
* Price / السعر
* Discount / الخصم
* Amount / المبلغ

Totals:

* Total cartons
* Total pieces
* Total KG
* Subtotal
* Discount
* VAT 5% if enabled
* Grand Total
* Amount in words placeholder

Footer:

* Terms and conditions
* Company stamp
* Company signature
* Customer approval signature placeholder

Buttons:

* Print
* Export PDF
* Send WhatsApp premium
* Send Email placeholder
* Convert to Sales Invoice

Visual style:
Formal UAE business document, but clearly different from tax invoice.

5. Quotation Detail Screen

Arabic title:
تفاصيل عرض السعر

Show:

* Quotation status
* Customer
* Expiry date
* Total amount
* Converted invoice number if any
* Created by
* Sent date
* Last updated
* Notes

Tabs:

* العرض
* المنتجات
* السجل
* التحويل لفاتورة
* الملاحظات والمرفقات

Actions:

* Edit quotation if draft/sent and not converted
* Mark as accepted
* Mark as rejected
* Convert to sales invoice
* Print
* Export PDF
* Send WhatsApp premium
* Cancel quotation
* Duplicate quotation

6. Convert Quotation to Sales Invoice Flow

Arabic title:
تحويل عرض السعر إلى فاتورة بيع

This is very important.

Show conversion preview:

* Quotation number
* Customer
* Expiry status
* Products
* Cartons
* Pieces
* KG
* Prices
* Discounts
* VAT
* Grand total

Stock check:
For each item, show current stock:

* Available cartons
* Available pieces
* Available KG
* Required cartons
* Required pieces
* Required KG
* Status:

  * كافي
  * منخفض
  * غير كافي

Rules:

* Conversion creates a sales invoice draft.
* Quotation conversion does not automatically approve invoice unless user explicitly chooses approval and has permission.
* Stock is deducted only when the resulting sales invoice is approved.
* If stock is insufficient, allow creating invoice draft but block direct approval.
* If customer credit limit is exceeded, allow creating invoice draft but block approval unless Owner/Admin overrides credit limit.
* If quotation is expired, show warning:
  “انتهت صلاحية عرض السعر. يمكنك تحويله بعد تأكيد الأسعار.”

Options:

* Create sales invoice as draft
* Create and approve immediately if permitted
* Recalculate prices from current product/customer prices toggle
* Keep quotation prices toggle
* Copy notes and terms toggle

Default:
Keep quotation prices.

Show warning:
“إذا تغيرت الأسعار أو المخزون بعد إنشاء العرض، راجع البيانات قبل اعتماد الفاتورة.”

After conversion:
Success screen:
“تم تحويل عرض السعر إلى فاتورة بيع”
Actions:

* فتح الفاتورة
* طباعة الفاتورة
* الرجوع لعروض الأسعار

7. Quotation Acceptance / Rejection Modal

Accept modal:
Title:
قبول عرض السعر

Fields:

* Accepted date
* Accepted by customer name
* Notes
* Convert to invoice now toggle

Reject modal:
Title:
رفض عرض السعر

Fields:

* Rejection reason
* Notes

Reasons:

* السعر غير مناسب
* الكمية غير متوفرة
* العميل لم يرد
* تم الاتفاق خارج النظام
* سبب آخر

8. Quotation Expiry Handling

Show expiry states:

* Valid
* Expiring soon
* Expired

If expired:

* Show amber/red badge
* Disable “Send” unless user updates expiry date or confirms
* Allow duplicate quotation
* Allow convert with warning and reason

Add “Update expiry date” action.

9. Quotation Settings Panel

Arabic title:
إعدادات عروض الأسعار

Settings:

* Quotation numbering prefix
* Next quotation number
* Default validity days
* Default terms and conditions
* Allow cashier to create quotation
* Allow cashier to edit price in quotation
* Allow cashier to apply discount
* Allow quotation conversion to invoice
* Require reason for discount
* Require reason for manual price change
* Include VAT by default
* Show stock warning in quotation
* Show quotation watermark:
  “عرض سعر وليس فاتورة”
* Print template settings

Numbering preview:
QUO-2026-00012

10. Quotation Reports / Analytics Section

Create a simple quotation analytics screen or tab.

Arabic title:
تحليل عروض الأسعار

KPI cards:

* Total quotations this month
* Open quotations
* Accepted quotations
* Rejected quotations
* Converted quotations
* Conversion rate
* Total open quotation value
* Expired quotation value

Charts:

* Quotation status donut chart
* Quotations by customer
* Conversion trend

Table:

* Quotation number
* Customer
* Date
* Expiry
* Amount
* Status
* Converted invoice
* Created by

Actions:

* Export PDF
* Export Excel

11. Permissions

Owner/Admin:

* Can create/edit quotations
* Can edit prices
* Can apply discounts
* Can apply free products
* Can convert quotation to invoice
* Can approve resulting invoice if permission allows
* Can cancel quotation
* Can edit quotation settings
* Can export quotation reports

Accountant:

* Can create/edit quotations if permission enabled
* Can convert quotation to invoice if permission enabled
* Can edit price/discount if permission enabled
* Can export quotation reports if permission enabled

Cashier/Sales:

* Can create quotation if permission enabled
* Can select customer/products
* Can use default/customer special prices
* Cannot edit price unless permission enabled
* Cannot apply discount unless permission enabled
* Cannot convert to approved invoice unless permission enabled
* Can print/send quotation if permission enabled

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

12. Validation and Error States

Show:

* Missing customer
* Missing product
* Invalid carton count
* Invalid pieces count
* Invalid KG
* Missing price
* Price below cost warning
* Discount greater than line amount
* Overall discount greater than subtotal
* Expiry date missing
* Expiry date already passed
* VAT disabled requires reason
* Manual price change requires reason
* Stock insufficient warning
* Customer credit limit warning
* Premium WhatsApp locked
* Quotation already converted
* Cannot edit converted quotation
* Cannot convert cancelled quotation
* Cannot send expired quotation without confirmation

13. Empty States

No quotations:
“لا توجد عروض أسعار حالياً”
Button:
“إنشاء أول عرض سعر”

No open quotations:
“لا توجد عروض مفتوحة”

No expired quotations:
“لا توجد عروض منتهية”

No quotation items:
“أضف المنتجات لعرض السعر”

No quotation analytics:
“لا توجد بيانات كافية للتحليل”

14. Mobile Quotation Experience

Create mobile responsive screens.

Mobile behavior:

* Quotation list as cards
* New quotation as step-by-step sections:

  * Customer
  * Products
  * Discount/VAT
  * Terms
  * Preview
* Product rows as cards
* Sticky bottom summary:

  * Total KG
  * Grand total
  * Save
  * Preview
* Convert flow as a simple review screen
* Large status badges
* WhatsApp button locked if premium unavailable

15. Sample Data

Use realistic UAE poultry sample data.

Customers:

* مطعم الخليج
* سوبر ماركت المدينة
* مطبخ الإمارات
* Prime Fresh Meat LLC

Products:

* 900 GRAM
* 1000 GRAM
* 1100 GRAM
* 1200 GRAM
* 1300 GRAM
* Liver
* Gizzard
* Heart
* Wings
* Bone

Sample quotation lines:

* 1000 GRAM, Ct 5, Pieces 50, Kg 50, Price 14.75, Amount 737.50
* 1100 GRAM, Ct 3, Pieces 30, Kg 33, Price 14.75, Amount 486.75
* Liver, Kg 5, Price 4.00, Amount 20.00
* Bone, Kg 3, Price 0.00, Amount 0.00, badge: منتج مجاني

Sample totals:

* Subtotal: AED 1,244.25
* Discount: AED 50.00
* VAT 5%: AED 59.71
* Grand total: AED 1,253.96

Sample statuses:

* QUO-2026-00012 Sent to مطعم الخليج
* QUO-2026-00013 Accepted by سوبر ماركت المدينة
* QUO-2026-00014 Expired
* QUO-2026-00015 Converted to INV-2026-00051

16. Navigation Integration

Connect:
Tenant sidebar “عروض الأسعار” → Quotations List.
Tenant dashboard quick action “عرض سعر جديد” → New Quotation.
Sales invoice screen “Create from quotation” → Quotations List or conversion flow.
Customer profile “New quotation” action → New Quotation with customer pre-selected.
Product detail “Use in quotation” → New Quotation with product pre-selected.
Quotation row “Convert” → Convert Quotation to Sales Invoice.
Quotation preview “Convert to Sales Invoice” → Convert Flow.
Converted quotation “Open invoice” → Sales Invoice Detail.

17. App.tsx Wiring

Add quotation-related TenantScreen values such as:

* quotations
* quotations-new
* quotation-detail
* quotation-preview
* quotation-convert
* quotation-analytics
* quotation-settings

Wire sidebar:
“عروض الأسعار” should open Quotations List.

Wire dashboard:
“عرض سعر جديد” quick action should open New Quotation.

Wire sales module:
Sales invoice creation should include optional “Create from quotation” entry.

Mobile bottom navigation:
Put Quotations under “المزيد” if no direct bottom nav item exists.

18. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, permissions, quotation statuses, conversion behavior, premium locks, pricing rules, stock warnings, and Arabic-first clarity.

The final result should feel like a real production Quotations Workflow for UAE poultry distribution companies, with product/carton/KG pricing, customer special prices, free products, discounts, VAT, print/export, WhatsApp premium sending, expiry handling, and safe conversion to sales invoice without stock deduction until invoice approval.
