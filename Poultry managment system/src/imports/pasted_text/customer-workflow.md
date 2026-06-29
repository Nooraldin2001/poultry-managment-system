Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Customers & Customer Accounts Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Inventory workflow
* Arabic-first RTL layout
* English language switch
* Owner / Accountant / Cashier role views
* Tenant navigation

Now create the full tenant customer management and customer accounts workflow connected from:
Tenant Dashboard → customer balance cards / “العملاء المديونين”
Tenant sidebar → العملاء
Tenant sidebar → الحسابات
Sales invoice customer selector → Add/View customer
Sales invoice credit warning → Customer credit limit flow
Collection screens → Customer account

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Customer management must be very easy for poultry business owners, accountants, and cashiers. Use simple Arabic, large buttons, clear account balance cards, obvious warnings, and guided forms. Avoid complicated accounting language where possible.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Confirmed business rules:

* Each customer has an account.
* Customer can have opening balance.
* Customer can be active or inactive.
* Customer can be cash or credit.
* Customer can have a credit limit.
* Credit limit blocks new sales invoice approval if exceeded.
* Tenant Admin / Owner can increase the credit limit on the spot if needed.
* Customer can have special prices per product/weight.
* Customer special prices remain active until changed.
* Customer can have free products by agreement.
* Customer statement must include:

  * Opening balance
  * Sales invoices
  * Collections
  * Collection discounts
  * Sales returns
  * Future tax credit notes placeholder
* Collections can be linked to a specific invoice or paid generally against customer account balance.
* Customer statement must be printable/exportable as PDF and Excel.
* WhatsApp actions must exist, but are a premium feature.
* Premium actions include:

  * Send invoice by WhatsApp
  * Send customer statement by WhatsApp
  * Send payment reminder by WhatsApp

Required screens:

1. Customers List Screen

Arabic title:
العملاء

Create a complete customer management page.

Top KPI cards:

* إجمالي العملاء
* العملاء النشطين
* عملاء عليهم مديونية
* إجمالي مستحقات العملاء
* عملاء تجاوزوا الحد الائتماني
* عملاء نقدي
* عملاء آجل
* تحصيلات اليوم

Desktop table columns:

* اسم العميل
* النوع
* التصنيف
* الهاتف
* TRN
* الرصيد الحالي
* الحد الائتماني
* حالة الحد الائتماني
* آخر فاتورة
* آخر تحصيل
* الحالة
* الإجراءات

Mobile layout:
Use customer cards instead of table.

Customer status badges:

* نشط / Active = green
* موقوف / Inactive = gray/red
* تجاوز الحد / Credit Exceeded = red
* قريب من الحد / Near Limit = amber
* لا توجد مديونية / Clear = green

Filters:

* Search by name
* Search by phone
* Search by TRN
* Filter by customer type:

  * نقدي
  * آجل / على الحساب
* Filter by category:

  * مطعم
  * سوبر ماركت
  * ملحمة
  * فندق
  * مطبخ
  * عميل كاش
  * عميل آجل
  * أخرى
* Filter by outstanding balance
* Filter by exceeded credit limit
* Filter by inactive customers

Actions:

* إضافة عميل جديد
* عرض الملف
* تعديل
* إنشاء فاتورة بيع
* تسجيل تحصيل
* كشف حساب
* إرسال تذكير واتساب premium
* إيقاف العميل

Premium WhatsApp actions:
Show locked badge if tenant plan does not include premium communications:
“ميزة متقدمة”
Tooltip:
“إرسال واتساب متاح في الباقات الأعلى.”

2. Create / Edit Customer Screen

Arabic title:
إضافة عميل جديد

Use a guided form with simple sections.

A. Basic Information
Fields:

* Customer name Arabic
* Customer name English optional
* Phone number
* WhatsApp number
* Email optional
* Address
* Emirate
* TRN optional
* Notes

B. Customer Type
Fields:

* Customer type:

  * نقدي
  * آجل / على الحساب
* Customer category:

  * مطعم
  * سوبر ماركت
  * ملحمة
  * فندق
  * مطبخ
  * عميل كاش
  * عميل آجل
  * أخرى
* Active / inactive toggle

C. Financial Settings
Fields:

* Opening balance
* Opening balance type:

  * على العميل
  * للعميل
  * صفر
* Credit limit
* Default payment terms:

  * فوري
  * 7 أيام
  * 15 يوم
  * 30 يوم
  * مخصص
* Block sales when credit limit exceeded toggle
  Default: enabled
* Allow Admin override toggle
  Default: enabled

Helper text:
“إذا تجاوز العميل الحد الائتماني، سيتم منع اعتماد فاتورة البيع إلا إذا قام المدير برفع الحد.”

D. Pricing & Agreements Summary
Show buttons:

* إضافة أسعار خاصة
* إضافة منتجات مجانية
* حفظ اتفاق تجاري

E. Save Actions
Buttons:

* حفظ العميل
* حفظ وإنشاء فاتورة بيع
* إلغاء

Validation:

* Customer name required
* Phone required
* Invalid phone
* Invalid email
* Duplicate TRN warning
* Opening balance cannot be invalid
* Credit limit required for credit customers
* TRN optional but validate format if entered

3. Customer Profile / Detail Screen

Arabic title example:
ملف العميل: مطعم الخليج

Create customer profile with tabs.

Header:

* Customer name
* Type badge
* Category badge
* Active/inactive badge
* Current balance
* Credit limit
* Credit usage progress bar
* Last invoice date
* Last payment date

Credit progress:

* Green under 70%
* Amber 70–99%
* Red above 100%

If credit exceeded:
Show red banner:
“تم تجاوز الحد الائتماني. لا يمكن اعتماد فواتير جديدة حتى يتم التحصيل أو رفع الحد.”

Header actions:

* إنشاء فاتورة بيع
* تسجيل تحصيل
* كشف حساب
* تعديل العميل
* رفع الحد الائتماني
* إرسال واتساب premium
* إيقاف العميل

Tabs:

* نظرة عامة
* الفواتير
* التحصيلات
* كشف الحساب
* الأسعار الخاصة
* المنتجات المجانية
* الخصومات والتسويات
* المرفقات والملاحظات
* سجل العمليات

4. Customer Overview Tab

Show simple business cards:

* Total sales
* Total collections
* Current outstanding
* Opening balance
* Average monthly sales
* Last payment
* Number of unpaid invoices
* Credit limit usage

Show latest activity:

* Latest sales invoice
* Latest collection
* Latest collection discount
* Latest statement export
* Latest WhatsApp reminder premium

Show quick actions:

* New sale
* Collect payment
* Add special price
* Add free product
* Print statement

5. Customer Special Prices Screen / Tab

Arabic title:
الأسعار الخاصة

Purpose:
Allow customer-specific product prices.

Important:
These prices stay active until changed. No expiry date required.

Table columns:

* المنتج / الوزن
* السعر الافتراضي
* السعر الخاص للعميل
* نوع السعر
* آخر تعديل
* تم التعديل بواسطة
* الحالة
* الإجراءات

Price type:

* سعر الكيلو
* سعر الحبة
* سعر الكرتون

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
* Liver
* Gizzard
* Heart
* Breast
* Leg
* Wings
* Bone

Actions:

* Add special price
* Edit price
* Disable special price
* Bulk update prices
* Import price list placeholder

Show warning when price is below cost:
“تحذير: السعر أقل من تكلفة الشراء”
Visible to Owner and Accountant only.

Show audit badge:
“سعر خاص”

Show note:
“سيتم استخدام السعر الخاص تلقائياً عند إنشاء فاتورة بيع لهذا العميل.”

Modal: Add/Edit Special Price
Fields:

* Product / weight
* Default price
* Special price
* Price type
* Reason
* Notes

Validation:

* Special price required
* Price cannot be negative
* Reason required if price below cost
* Duplicate active special price warning

6. Customer Free Products Screen / Tab

Arabic title:
المنتجات المجانية

Purpose:
Allow customer-specific free products by agreement.

Table columns:

* المنتج
* الاتفاق
* الكمية/الشروط
* الحالة
* آخر تعديل
* ملاحظات
* الإجراءات

Agreement examples:

* Liver free
* Gizzard free
* Free product when invoice exceeds amount
* Free product by manual selection only
* Free product for specific customer agreement

Fields:

* Product
* Free product type:

  * دائماً مجاني لهذا العميل
  * مجاني عند اختياره في الفاتورة
  * مجاني بشرط مبلغ معين
  * مجاني بشرط كمية معينة
* Condition amount optional
* Condition quantity optional
* Notes
* Active toggle

Show warning:
“المنتج المجاني يظهر بسعر صفر في فاتورة البيع ويحتاج صلاحية إذا تم تعديله يدوياً.”

7. Credit Limit Override Modal

This is very important.

Trigger:

* From sales invoice when customer exceeds credit limit.
* From customer profile “رفع الحد الائتماني”.

Arabic title:
رفع الحد الائتماني للعميل

Show current state:

* Current balance
* Current credit limit
* New invoice amount
* Balance after invoice
* Exceeded amount

Fields:

* New credit limit
* Reason required
* Temporary or permanent:

  * دائم
  * مؤقت لهذه الفاتورة فقط
* Approval by Owner/Admin
* Notes

Warning:
“رفع الحد الائتماني يسمح بإصدار فواتير إضافية لهذا العميل.”

Actions:

* رفع الحد واعتماد المتابعة
* إلغاء

After success:

* Update credit usage preview
* Allow sales invoice approval
* Add audit log entry

Audit entry:
“تم رفع الحد الائتماني”
Show previous limit, new limit, user, reason, date/time.

8. Customer Invoices Tab

Show all customer sales invoices.

Columns:

* Invoice number
* Date
* Total cartons
* Total KG
* Grand total
* Paid
* Remaining
* Status
* Payment method
* Actions

Actions:

* View invoice
* Print invoice
* Record collection
* Add collection discount
* Send invoice WhatsApp premium

Statuses:

* Draft
* Approved
* Paid
* Partially paid
* Unpaid
* Cancelled
* Adjusted

9. Customer Collections Tab

Arabic title:
التحصيلات

Show all customer collections.

Columns:

* Receipt number
* Date
* Amount collected
* Payment method
* Linked invoice
* Reference
* Collected by
* Notes
* Actions

Actions:

* Print receipt
* View receipt
* Send receipt WhatsApp premium

Add collection button:
“تسجيل تحصيل”

10. Customer Collection Modal

Arabic title:
تسجيل تحصيل من عميل

Support two modes:

Mode 1:
تحصيل على فاتورة محددة

Fields:

* Customer
* Select invoice
* Invoice total
* Already paid
* Invoice outstanding
* Amount collected
* Payment method
* Payment date
* Reference number
* Notes

Mode 2:
تحصيل على حساب العميل

Fields:

* Customer
* Current customer balance
* Amount collected
* Payment method
* Payment date
* Reference number
* Notes
* Allocation method:

  * توزيع تلقائي على أقدم فواتير غير مدفوعة
  * توزيع يدوي على الفواتير
  * تسجيل كرصيد دائن للعميل

Show allocation preview:

* Which invoices will be reduced
* Remaining balance after collection
* If credit remains, show:
  “سيظهر رصيد دائن للعميل”

Validation:

* Amount required
* Amount cannot be negative
* Payment method required
* Amount cannot exceed selected invoice outstanding unless allowing account credit
* Reference required for bank transfer if settings require it

After success:

* Update customer balance
* Update invoice payment status
* Create receipt
* Show success screen with Print Receipt

11. Customer Statement Screen

Arabic title:
كشف حساب العميل

This screen is very important.

Filters:

* Date from
* Date to
* Movement type
* Invoice status
* Show only unpaid
* Show opening balance

Statement header:

* Company logo
* Company name
* Customer name
* Customer phone
* Customer TRN
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
* Sales invoice
* Collection
* Collection discount
* Sales return
* Tax credit note placeholder
* Manual account adjustment placeholder

Use Arabic labels:

* مدين
* دائن
* الرصيد

Show totals:

* Total sales
* Total collections
* Total discounts
* Total returns
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

12. Customer Discounts & Adjustments Tab

Arabic title:
الخصومات والتسويات

Show:

* Collection discounts
* Balance adjustments
* Sales returns placeholder
* Tax credit notes placeholder

Table columns:

* Date
* Type
* Reference
* Amount
* Reason
* Approved by
* Notes

Actions:

* Add collection discount
* View adjustment
* Print adjustment note

Reminder:
Collection discount affects customer balance only and does not change stock.
Sales return affects stock.
Tax credit note affects tax/invoice value later.

13. Premium WhatsApp Communication Panel

Create a side panel or modal.

Arabic title:
إرسال عبر واتساب

Actions:

* Send invoice
* Send statement
* Send payment reminder
* Send receipt

If premium feature disabled:
Show locked state:
“هذه الميزة متاحة في الباقات المتقدمة”
Buttons:

* Upgrade plan placeholder
* Copy message manually

If premium feature enabled:
Show:

* Customer WhatsApp number
* Message template
* Attach invoice/statement toggle
* Send button
* Communication history

Sample reminder message in Arabic:
“مرحباً، نود تذكيركم بوجود مبلغ مستحق بقيمة AED 4,250. يرجى مراجعة كشف الحساب. شكراً لكم.”

14. Customer Account Settings Panel

Arabic title:
إعدادات العملاء والحسابات

Settings:

* Default customer type
* Default credit limit
* Block sales when credit limit exceeded toggle
* Allow Owner/Admin credit override toggle
* Require reason for credit limit change
* Enable customer special prices
* Enable customer free products
* Allow cashier to create customer
* Allow cashier to collect payment
* Allow cashier to view customer balance
* Allow WhatsApp premium communications
* Statement template settings
* Receipt numbering settings

Credit limit settings:

* Warning threshold percentage, example 80%
* Block threshold, example 100%

15. Role and Permission States

Owner / Tenant Admin:

* Can create/edit customers
* Can set opening balance
* Can set credit limit
* Can override credit limit
* Can add/edit special prices
* Can add free products
* Can record collections
* Can apply collection discounts
* Can print/export statements
* Can use premium WhatsApp if plan allows
* Can stop/reactivate customer

Accountant:

* Can view customer accounts
* Can record collections
* Can print/export statements
* Can apply collection discounts if permission enabled
* Can edit opening balance only if permission enabled
* Can edit special prices only if permission enabled

Cashier:

* Can select customer for sale
* Can create customer only if permission enabled
* Can record collection only if permission enabled
* Can view customer balance only if permission enabled
* Cannot change credit limit unless permission enabled
* Cannot edit special prices unless permission enabled

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

16. Validation and Error States

Show:

* Missing customer name
* Missing phone
* Duplicate phone warning
* Duplicate TRN warning
* Invalid TRN
* Invalid opening balance
* Credit limit exceeded
* Credit limit override reason required
* Special price below cost
* Duplicate special price
* Free product agreement missing product
* Collection amount invalid
* Collection amount exceeds invoice remaining
* Statement export loading
* WhatsApp premium feature locked
* Customer inactive warning
* Cannot create invoice for inactive customer unless Owner/Admin reactivates

17. Empty States

No customers:
“لا يوجد عملاء حالياً”
Button:
“إضافة أول عميل”

No invoices:
“لا توجد فواتير لهذا العميل”

No collections:
“لا توجد تحصيلات لهذا العميل”

No special prices:
“لا توجد أسعار خاصة. سيتم استخدام الأسعار الافتراضية.”

No free products:
“لا توجد منتجات مجانية لهذا العميل.”

No statement movements:
“لا توجد حركات في هذه الفترة.”

18. Mobile Customer Experience

Create mobile responsive screens.

Mobile behavior:

* Customer list as cards
* Large call/WhatsApp buttons
* Balance and credit limit visible at top
* Sticky action button:
  “تسجيل تحصيل”
* Customer profile tabs as horizontal scroll chips
* Statement movements as cards
* Special prices as simple rows
* Collection modal optimized for one-handed use

19. Sample Data

Use realistic UAE poultry customer data:

Customers:

1. مطعم الخليج
   Type: آجل
   Category: مطعم
   Balance: AED 12,450
   Credit limit: AED 15,000
   Status: Near limit

2. سوبر ماركت المدينة
   Type: آجل
   Category: سوبر ماركت
   Balance: AED 18,700
   Credit limit: AED 15,000
   Status: Credit exceeded

3. مطبخ الإمارات
   Type: كاش
   Category: مطبخ
   Balance: AED 0
   Credit limit: AED 0
   Status: Clear

4. Prime Fresh Meat LLC
   Type: آجل
   Category: ملحمة
   Balance: AED 4,250
   Credit limit: AED 20,000
   Status: Active

Special price examples:

* 900 GRAM: AED 14.75 / KG
* 1000 GRAM: AED 14.50 / KG
* 1100 GRAM: AED 14.75 / KG
* Liver: AED 4.00 / KG
* Gizzard: AED 4.00 / KG

Free product examples:

* Liver free by manual selection
* Bone free always
* Gizzard free if invoice exceeds AED 5,000

Statement movement examples:

* Opening balance: AED 2,000 debit
* Sales invoice INV-2026-00046: AED 2,001.56 debit
* Collection receipt REC-2026-00012: AED 1,000 credit
* Collection discount ADJ-2026-00004: AED 150 credit
* Sales return placeholder: AED 0
* Tax credit note placeholder: AED 0

20. Navigation Integration

Connect:
Tenant sidebar “العملاء” → Customers List.
Tenant dashboard “العملاء المديونين” card → Customers List filtered by outstanding.
Customer row → Customer Profile.
Customer profile “إنشاء فاتورة بيع” → New Sales Invoice with customer pre-selected.
Customer profile “تسجيل تحصيل” → Customer Collection Modal.
Customer profile “كشف حساب” → Customer Statement Screen.
Sales invoice customer selector “إضافة عميل” → Create Customer Screen.
Sales invoice credit exceeded warning → Credit Limit Override Modal.
Customer invoice tab “Print” → Sales Invoice Preview.
Customer invoice tab “Record Collection” → Collection Modal.
WhatsApp buttons → Premium WhatsApp Communication Panel.

21. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, and business rule visibility.

The final result should feel like a real production Customers & Customer Accounts workflow for UAE poultry distribution companies, with customer balances, credit limit blocking, instant admin credit override, special prices, free product agreements, collections, statement printing/export, and premium WhatsApp communication actions.
