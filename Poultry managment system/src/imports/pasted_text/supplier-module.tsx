Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Suppliers & Supplier Accounts Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Inventory workflow
* Customers & Customer Accounts workflow
* Arabic-first RTL layout
* English language switch
* Owner / Accountant / Cashier role views
* Tenant navigation
* Separate module files such as CustomerModule, PurchaseModule, InventoryModule

Implementation direction:
Create a self-contained SupplierModule file similar to the existing CustomerModule and PurchaseModule structure if that matches the current project structure. Keep files balanced and avoid making App.tsx too large. Wire the supplier screens into App.tsx using targeted edits only.

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Supplier management must be simple for business owners but strong enough for accountants. Use clear Arabic, large balance cards, obvious payable warnings, guided supplier forms, and simple statement views. Avoid complex accounting terms unless they are necessary.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Confirmed supplier business rules:

* Suppliers can have opening balance.
* Supplier can be cash or credit/account supplier.
* Supplier statement must show all purchase/payable movements:

  * Opening balance
  * Purchase invoices
  * Supplier payments
  * Purchase deductions
  * Purchase cancellations
  * Purchase returns later
  * Manual adjustments placeholder
* Supplier payments can be linked to a specific purchase invoice.
* Supplier payments can also be paid generally against supplier account balance.
* Suppliers can have special purchase prices per product/weight.
* Supplier special prices remain active until changed.
* Suppliers can have categories/types.
* Supplier WhatsApp actions exist as premium features.
* Supplier account statement must be printable/exportable as PDF and Excel.
* Cashier/sales employee access to suppliers is optional and controlled by permission settings.
* Supplier agreements may optionally store:

  * default payment terms
  * default slaughter deduction
  * default transport deduction
  * default VAT behavior
  * default pieces per carton
  * notes and commercial agreement details

Required screens:

1. Suppliers List Screen

Arabic title:
الموردين

Create a complete supplier management page.

Top KPI cards:

* إجمالي الموردين
* الموردين النشطين
* موردين لهم مستحقات
* إجمالي مستحقات الموردين
* موردين كاش
* موردين آجل
* دفعات اليوم للموردين
* مشتريات هذا الشهر

Desktop table columns:

* اسم المورد
* النوع
* التصنيف
* الهاتف
* TRN
* الرصيد الحالي
* شروط الدفع
* آخر فاتورة شراء
* آخر دفعة
* الحالة
* الإجراءات

Mobile layout:
Use supplier cards instead of table.

Supplier status badges:

* نشط / Active = green
* موقوف / Inactive = gray/red
* له مستحقات / Has Payable = amber/red
* لا توجد مستحقات / Clear = green
* مورد كاش / Cash Supplier = gray
* مورد آجل / Credit Supplier = navy/amber

Filters:

* Search by supplier name
* Search by phone
* Search by TRN
* Filter by supplier type:

  * كاش
  * آجل / على الحساب
  * حساب بنكي
* Filter by category:

  * مزرعة دواجن
  * مسلخ
  * شركة مواد غذائية
  * شركة نقل
  * مورد كاش
  * مورد آجل
  * أخرى
* Filter by outstanding balance
* Filter by inactive suppliers
* Filter by recent purchases

Actions:

* إضافة مورد جديد
* عرض الملف
* تعديل
* إنشاء فاتورة شراء
* تسجيل دفعة للمورد
* كشف حساب
* إرسال واتساب premium
* إيقاف المورد

Premium WhatsApp actions:
Show locked badge if tenant plan does not include premium communications:
“ميزة متقدمة”
Tooltip:
“إرسال واتساب متاح في باقات Pro و Enterprise.”

2. Create / Edit Supplier Screen

Arabic title:
إضافة مورد جديد

Use a guided form with simple sections.

A. Basic Information
Fields:

* Supplier name Arabic
* Supplier name English optional
* Phone number
* WhatsApp number
* Email optional
* Address
* Emirate
* TRN optional
* Notes

B. Supplier Type
Fields:

* Supplier type:

  * كاش
  * آجل / على الحساب
  * حساب بنكي
* Supplier category:

  * مزرعة دواجن
  * مسلخ
  * شركة مواد غذائية
  * شركة نقل
  * مورد كاش
  * مورد آجل
  * أخرى
* Active / inactive toggle

C. Financial Settings
Fields:

* Opening balance
* Opening balance type:

  * للمورد علينا
  * لنا عند المورد
  * صفر
* Default payment terms:

  * فوري
  * 7 أيام
  * 15 يوم
  * 30 يوم
  * مخصص
* Default payment method:

  * كاش
  * حساب بنكي
  * شيك
  * أخرى
* Create supplier account toggle
* Track supplier balance toggle

Helper text:
“يمكن عدم متابعة رصيد مورد الكاش إذا لم تكن هناك مستحقات أو دفعات آجلة.”

D. Optional Supplier Agreement Defaults
Title:
اتفاقات المورد الافتراضية

Fields:

* Default slaughter deduction
* Default transport deduction
* Default loading/unloading cost
* Default VAT behavior:

  * VAT enabled
  * VAT disabled
  * Ask every invoice
* Default pieces per carton
* Default purchase pricing method:

  * بالكيلو
  * بالحبة
  * بالكرتون
* Notes

Important helper:
“هذه القيم اختيارية وتظهر كمقترحات عند إنشاء فاتورة شراء جديدة لهذا المورد.”

E. Pricing & Agreements Summary
Show buttons:

* إضافة أسعار شراء خاصة
* إضافة اتفاق مورد
* رفع مستند اتفاق

F. Save Actions
Buttons:

* حفظ المورد
* حفظ وإنشاء فاتورة شراء
* إلغاء

Validation:

* Supplier name required
* Phone required
* Invalid phone
* Invalid email
* Duplicate TRN warning
* Opening balance cannot be invalid
* TRN optional but validate format if entered
* Payment terms required for credit suppliers

3. Supplier Profile / Detail Screen

Arabic title example:
ملف المورد: WESTLAND FOODSTUFF TRADING LLC

Create supplier profile with tabs.

Header:

* Supplier name
* Type badge
* Category badge
* Active/inactive badge
* Current balance
* Payment terms
* Last purchase invoice date
* Last payment date
* Supplier TRN

Balance visual:

* If company owes supplier, show amber/red payable card:
  “مستحق للمورد”
* If supplier balance is clear, show green:
  “لا توجد مستحقات”
* If supplier owes company, show green/blue:
  “رصيد لنا عند المورد”

Header actions:

* إنشاء فاتورة شراء
* تسجيل دفعة للمورد
* كشف حساب
* تعديل المورد
* إرسال واتساب premium
* إيقاف المورد

Tabs:

* نظرة عامة
* فواتير الشراء
* المدفوعات
* كشف الحساب
* أسعار الشراء الخاصة
* الاتفاقات
* الخصومات والتسويات
* المرفقات والملاحظات
* سجل العمليات

4. Supplier Overview Tab

Show simple business cards:

* Total purchases
* Total payments
* Current payable
* Opening balance
* Average monthly purchases
* Last payment
* Number of unpaid purchase invoices
* Total purchase deductions

Show latest activity:

* Latest purchase invoice
* Latest supplier payment
* Latest purchase deduction
* Latest statement export
* Latest WhatsApp reminder premium

Show quick actions:

* New purchase invoice
* Pay supplier
* Add special purchase price
* Add supplier agreement
* Print statement

5. Supplier Purchase Invoices Tab

Show all supplier purchase invoices.

Columns:

* Purchase invoice number
* Supplier invoice number
* Date
* Total cartons
* Total pieces
* Total KG
* Goods total
* Purchase deductions/costs
* Net payable
* Paid
* Remaining
* Status
* Payment method
* Actions

Actions:

* View purchase invoice
* Print internal purchase record
* Record supplier payment
* Upload supplier invoice
* Cancel purchase invoice if permission allowed

Statuses:

* Draft
* Approved
* Paid
* Partially paid
* Credit/on-account
* Cancelled

6. Supplier Payments Tab

Arabic title:
مدفوعات المورد

Show all supplier payments.

Columns:

* Payment receipt number
* Date
* Amount paid
* Payment method
* Linked purchase invoice
* Reference
* Paid by
* Notes
* Actions

Actions:

* Print payment receipt
* View receipt
* Send receipt WhatsApp premium

Add payment button:
“تسجيل دفعة للمورد”

7. Supplier Payment Modal

Arabic title:
تسجيل دفعة للمورد

Support two modes:

Mode 1:
دفعة على فاتورة شراء محددة

Fields:

* Supplier
* Select purchase invoice
* Invoice net payable
* Already paid
* Invoice outstanding
* Amount paid
* Payment method
* Payment date
* Reference number
* Notes

Mode 2:
دفعة على حساب المورد

Fields:

* Supplier
* Current supplier balance
* Amount paid
* Payment method
* Payment date
* Reference number
* Notes
* Allocation method:

  * توزيع تلقائي على أقدم فواتير غير مدفوعة
  * توزيع يدوي على الفواتير
  * تسجيل كرصيد لنا عند المورد

Show allocation preview:

* Which purchase invoices will be reduced
* Remaining supplier balance after payment
* If credit remains, show:
  “سيظهر رصيد لنا عند المورد”

Validation:

* Amount required
* Amount cannot be negative
* Payment method required
* Amount cannot exceed selected invoice outstanding unless allowing supplier credit
* Reference required for bank transfer if settings require it

After success:

* Update supplier balance
* Update purchase invoice payment status
* Create supplier payment receipt
* Show success screen with Print Payment Receipt

8. Supplier Statement Screen

Arabic title:
كشف حساب المورد

This screen is very important.

Filters:

* Date from
* Date to
* Movement type
* Purchase invoice status
* Show only unpaid
* Show opening balance

Statement header:

* Company logo
* Company name
* Supplier name
* Supplier phone
* Supplier TRN
* Period
* Opening balance
* Closing balance

Statement movement table:

* Date
* Movement type
* Reference
* Description
* Debit
* Credit
* Balance
* Notes

Movement types:

* Opening balance
* Purchase invoice
* Supplier payment
* Purchase deduction
* Purchase cancellation
* Purchase return placeholder
* Manual supplier account adjustment placeholder

Use Arabic labels:

* مدين
* دائن
* الرصيد

Important display rule:
Make debit/credit understandable with helper labels:

* “مبلغ مستحق للمورد”
* “دفعة للمورد”
* “خصم من مستحق المورد”

Show totals:

* Total purchases
* Total payments
* Total deductions
* Total cancellations
* Closing balance

Actions:

* Print PDF
* Export Excel
* Send WhatsApp premium
* Send Email placeholder

Premium WhatsApp lock behavior:
If tenant plan does not support premium communications:
Show locked button:
“إرسال واتساب - ميزة متقدمة”
Tooltip:
“هذه الميزة متاحة في باقة Pro أو Enterprise.”

9. Supplier Special Purchase Prices Tab

Arabic title:
أسعار الشراء الخاصة

Purpose:
Allow supplier-specific purchase prices per product/weight.

Important:
These prices stay active until changed. No expiry date required.

Table columns:

* المنتج / الوزن
* سعر الشراء الافتراضي
* سعر المورد الخاص
* نوع السعر
* آخر تعديل
* تم التعديل بواسطة
* الحالة
* الإجراءات

Price type:

* سعر الكيلو
* سعر الحبة
* سعر الكرتون
* سعر الطبق / Tray

Products:

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
* 1700 GRAM
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

Actions:

* Add special purchase price
* Edit price
* Disable special price
* Bulk update purchase prices
* Import supplier price list placeholder

Show note:
“سيتم اقتراح سعر المورد الخاص تلقائياً عند إنشاء فاتورة شراء لهذا المورد.”

Modal: Add/Edit Supplier Special Price
Fields:

* Product / weight
* Default purchase price
* Supplier special price
* Price type
* Reason
* Notes

Validation:

* Special price required
* Price cannot be negative
* Duplicate active special price warning
* Reason required if price is unusually high or low

10. Supplier Agreements Tab

Arabic title:
اتفاقات المورد

Purpose:
Store commercial agreement notes and defaults.

Agreement cards/table:

* Agreement title
* Agreement type
* Default value
* Active/inactive
* Last updated
* Notes
* Actions

Agreement types:

* شروط الدفع
* خصم الذبح
* خصم النقل
* تكلفة التحميل والتنزيل
* طريقة الضريبة
* عدد الحبات الافتراضي في الكرتونة
* طريقة الشراء الافتراضية
* ملاحظات عامة
* اتفاق خاص

Add/Edit Agreement Modal fields:

* Agreement type
* Description
* Default amount optional
* Percentage optional
* Applies automatically toggle
* Show as suggestion only toggle
* Notes
* Attachment optional

Important:
Show helper message:
“الاتفاقات هنا تساعد المستخدم عند إنشاء فاتورة شراء، ويمكن تعديلها داخل الفاتورة حسب الصلاحيات.”

11. Supplier Deductions & Adjustments Tab

Arabic title:
الخصومات والتسويات

Show:

* Purchase deductions
* Supplier balance adjustments
* Purchase cancellations
* Purchase returns placeholder

Table columns:

* Date
* Type
* Reference
* Amount
* Reason
* Approved by
* Notes

Actions:

* View deduction
* Add manual supplier adjustment placeholder
* Print adjustment note

Explain clearly:

* Purchase deduction can reduce supplier payable.
* Purchase cancellation can reverse payable and inventory if allowed.
* Purchase return later may affect inventory.
* Manual adjustment placeholder affects supplier balance only.

12. Premium WhatsApp Communication Panel

Arabic title:
إرسال للمورد عبر واتساب

Actions:

* Send payment receipt
* Send supplier statement
* Send outstanding balance confirmation
* Send purchase invoice reference

If premium feature disabled:
Show locked state:
“هذه الميزة متاحة في الباقات المتقدمة”
Buttons:

* Upgrade plan placeholder
* Copy message manually

If premium feature enabled:
Show:

* Supplier WhatsApp number
* Message template
* Attach statement/payment receipt toggle
* Send button
* Communication history

Sample Arabic message:
“مرحباً، نؤكد لكم أنه تم تسجيل دفعة بقيمة AED 3,000 لحسابكم. يرجى مراجعة كشف الحساب. شكراً لكم.”

13. Supplier Account Settings Panel

Arabic title:
إعدادات الموردين والحسابات

Settings:

* Default supplier type
* Create supplier account by default
* Track cash supplier balance toggle
* Default payment terms
* Require supplier invoice number
* Warn on duplicate supplier invoice number
* Enable supplier special purchase prices
* Enable supplier agreements
* Allow cashier to view suppliers
* Allow cashier to create supplier
* Allow cashier to create purchase invoice
* Allow cashier to record supplier payment
* Allow WhatsApp premium communications
* Statement template settings
* Supplier payment receipt numbering settings

Access note:
“صلاحيات الكاشير يمكن فتحها أو إغلاقها من الإعدادات حسب سياسة الشركة.”

14. Role and Permission States

Owner / Tenant Admin:

* Can create/edit suppliers
* Can set opening balance
* Can edit supplier agreements
* Can add/edit supplier special prices
* Can create purchase invoice
* Can record supplier payments
* Can print/export supplier statements
* Can use premium WhatsApp if plan allows
* Can stop/reactivate supplier
* Can view all supplier balances and reports

Accountant:

* Can view supplier accounts
* Can record supplier payments
* Can print/export supplier statements
* Can edit supplier opening balance only if permission enabled
* Can edit special purchase prices only if permission enabled
* Can edit supplier agreements only if permission enabled

Cashier / Sales:

* Supplier access is disabled by default
* Can view suppliers only if permission enabled
* Can create purchase draft only if permission enabled
* Can record supplier payment only if permission enabled
* Cannot edit supplier special prices unless permission enabled
* Cannot edit opening balance unless permission enabled

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

15. Validation and Error States

Show:

* Missing supplier name
* Missing phone
* Duplicate phone warning
* Duplicate TRN warning
* Invalid TRN
* Invalid opening balance
* Supplier invoice number required warning
* Duplicate supplier invoice number warning
* Special purchase price duplicate
* Special purchase price invalid
* Supplier payment amount invalid
* Payment amount exceeds invoice remaining
* Statement export loading
* WhatsApp premium feature locked
* Supplier inactive warning
* Cannot create purchase invoice for inactive supplier unless Owner/Admin reactivates
* Supplier has unpaid purchases warning before deactivation

16. Empty States

No suppliers:
“لا يوجد موردين حالياً”
Button:
“إضافة أول مورد”

No purchase invoices:
“لا توجد فواتير شراء لهذا المورد”

No supplier payments:
“لا توجد دفعات لهذا المورد”

No special purchase prices:
“لا توجد أسعار شراء خاصة. سيتم استخدام الأسعار الافتراضية.”

No agreements:
“لا توجد اتفاقات محفوظة لهذا المورد.”

No statement movements:
“لا توجد حركات في هذه الفترة.”

17. Mobile Supplier Experience

Create mobile responsive screens.

Mobile behavior:

* Supplier list as cards
* Large call/WhatsApp buttons
* Payable balance visible at top
* Sticky action button:
  “تسجيل دفعة”
* Supplier profile tabs as horizontal scroll chips
* Statement movements as cards
* Special prices as simple rows
* Supplier payment modal optimized for one-handed use

18. Sample Data

Use realistic UAE poultry supplier data:

Suppliers:

1. WESTLAND FOODSTUFF TRADING LLC
   Type: آجل
   Category: شركة مواد غذائية
   Balance: AED 18,500
   Payment terms: 15 days
   Status: Has payable

2. MNM Foodstuff Trading LLC
   Type: آجل
   Category: شركة مواد غذائية
   Balance: AED 6,942.86
   Payment terms: 7 days
   Status: Active

3. مزرعة العين للدواجن
   Type: آجل
   Category: مزرعة دواجن
   Balance: AED 25,000
   Payment terms: 30 days
   Status: Has payable

4. نقل الإمارات
   Type: كاش
   Category: شركة نقل
   Balance: AED 0
   Payment terms: Immediate
   Status: Clear

Special purchase price examples:

* 900 GRAM: AED 1.15 / piece
* 1000 GRAM: AED 1.20 / piece
* 1100 GRAM: AED 1.15 / piece
* Liver 500G: AED 0.70 / tray
* Gizzard 500G: AED 1.00 / tray
* Chilled Beef Chuck: AED 23.50 / KG

Supplier agreement examples:

* Default slaughter deduction: AED 700
* Default transport deduction: AED 300
* Default VAT behavior: Ask every invoice
* Default pieces per carton: 10
* Default payment terms: 15 days

Statement movement examples:

* Opening balance: AED 5,000 payable
* Purchase invoice PUR-2026-00034: AED 3,470.83 payable
* Supplier payment PAY-2026-00018: AED 2,000 paid
* Purchase deduction DED-2026-00004: AED 300 deduction
* Purchase cancellation placeholder: AED 0
* Purchase return placeholder: AED 0

19. Navigation Integration

Connect:
Tenant sidebar “الموردين” → Suppliers List.
Tenant dashboard “مستحقات الموردين” card → Suppliers List filtered by outstanding.
Supplier row → Supplier Profile.
Supplier profile “إنشاء فاتورة شراء” → New Purchase Invoice with supplier pre-selected.
Supplier profile “تسجيل دفعة للمورد” → Supplier Payment Modal.
Supplier profile “كشف حساب” → Supplier Statement Screen.
Purchase invoice supplier selector “إضافة مورد” → Create Supplier Screen.
Purchase invoice supplier selector “عرض المورد” → Supplier Profile.
Supplier purchase invoice tab “View” → Purchase Invoice Detail.
Supplier purchase invoice tab “Pay” → Supplier Payment Modal.
WhatsApp buttons → Premium WhatsApp Communication Panel.

20. App.tsx Wiring

Add supplier-related TenantScreen values such as:

* suppliers
* suppliers-new
* supplier-profile
* supplier-statement

Wire sidebar:
“الموردين” should open SuppliersListScreen.

Wire dashboard:
Supplier payables card should open SuppliersListScreen filtered by suppliers with outstanding balance.

Wire purchase module:
Supplier selector actions should be able to open Create Supplier and Supplier Profile screens.

Mobile bottom navigation:
Highlight “الموردين” or “المزيد” appropriately for supplier screens depending on the existing navigation structure.

21. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, permissions, premium locks, and business rule visibility.

The final result should feel like a real production Suppliers & Supplier Accounts workflow for UAE poultry distribution companies, with supplier balances, opening balance, purchase invoices, payments, supplier statements, special purchase prices, supplier agreements, payment receipts, PDF/Excel export, and premium WhatsApp communication actions.
