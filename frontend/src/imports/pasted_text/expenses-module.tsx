Continue from the existing Poultry Hero Figma Make project.

Do not rebuild the app. Extend the current Tenant / Company Dashboard by adding the complete Expenses Management Workflow.

The current app already includes:

* Super Admin SaaS dashboard
* Tenant dashboard
* Sales invoice workflow
* Purchase invoice workflow
* Inventory workflow
* Customers & Customer Accounts workflow
* Suppliers & Supplier Accounts workflow
* Arabic-first RTL layout
* English language switch
* Owner / Accountant / Cashier role views
* Tenant navigation
* Separate module files such as CustomerModule, SupplierModule, PurchaseModule, and InventoryModule

Implementation direction:
Create a self-contained ExpensesModule file if that matches the current project structure. Keep files balanced and avoid making App.tsx too large. Wire the expense screens into App.tsx using targeted edits only.

Product:
Poultry Hero

Market:
UAE poultry traders and poultry distribution companies.

Primary language:
Arabic-first, RTL by default.
Support English LTR through the existing language switch.

Design principle:
Expense management must be extremely simple for poultry business owners and accountants. Use clear Arabic, large buttons, simple categories, obvious daily/monthly separation, and clear impact on profit. Do not make the UI feel like complex accounting software.

Use existing color system:

* Primary Brand: #0F2C59 Deep Navy
* Secondary Accent: #22C55E Agri-Green
* Alert / Danger: #EF4444 Biosecurity Red
* System Warning: #F59E0B Amber Yellow
* Background Neutral: #F8FAFC Slate White
* Data Neutral: #64748B Cool Gray

Confirmed business rules:

* Expenses affect profit calculation.
* Daily expenses reduce daily profit.
* Monthly expenses reduce monthly profit.
* Some expenses may be linked to a purchase invoice.
* Purchase-linked expenses may affect purchase cost and profit depending on treatment.
* General daily/monthly expenses should appear in expense reports and profit reports.
* Users must be able to record cash, bank, cheque, or other payment methods.
* Expenses can have attachments such as receipts.
* Expenses can be one-time or recurring.
* Owner/Admin can manage expense categories and recurring expenses.
* Accountant can record and review expenses.
* Cashier access to expense creation is controlled by permission settings.

Profit formulas to represent visually:
Daily profit:
صافي ربح اليوم = مبيعات اليوم - مشتريات اليوم - مصروفات اليوم

Monthly profit:
صافي ربح الشهر = مجموع أرباح الأيام - المصروفات الشهرية

Important separation:

* مصروف يومي: affects the selected day.
* مصروف شهري: affects the selected month.
* مصروف مرتبط بفاتورة شراء: linked to a purchase invoice and may affect product cost/profit depending on treatment.
* مصروف متكرر: automatically expected every month, such as rent or salaries.

Required screens:

1. Expenses Overview Screen

Arabic title:
المصروفات

Create a clean expenses control center.

Top KPI cards:

* مصروفات اليوم
* مصروفات هذا الشهر
* مصروفات يومية
* مصروفات شهرية
* مصروفات مرتبطة بالمشتريات
* مصروفات متكررة قادمة
* أكبر تصنيف مصروف
* تأثير المصروفات على الربح

Add simple explanation banner:
“المصروفات اليومية تخص يوم العمل، والمصروفات الشهرية تخص الشهر بالكامل، والمصروفات المرتبطة بالمشتريات يمكن ربطها بفاتورة شراء.”

Dashboard sections:

* Expense trend chart by day.
* Expense category donut chart.
* Latest expenses list.
* Upcoming recurring expenses.
* Quick actions:

  * إضافة مصروف يومي
  * إضافة مصروف شهري
  * إضافة مصروف متكرر
  * عرض تقرير المصروفات

2. Expenses List Screen

Arabic title:
قائمة المصروفات

Desktop table columns:

* رقم المصروف
* التاريخ
* نوع المصروف
* التصنيف
* الوصف
* المبلغ
* طريقة الدفع
* مرتبط بفاتورة شراء
* المستخدم
* الحالة
* الإجراءات

Mobile layout:
Use expense cards instead of table.

Expense types:

* يومي
* شهري
* مرتبط بفاتورة شراء
* متكرر
* تسوية

Categories:
Daily expense categories:

* مصاريف سيارات
* مصاريف عمال
* مصاريف تشغيل
* مصروفات متنوعة
* وقود
* صيانة
* تحميل وتنزيل
* وجبات
* رسوم حكومية
* أخرى

Monthly expense categories:

* إيجار السكن
* إيجار السيارات
* أقساط السيارات
* الرواتب
* اشتراكات
* كهرباء ومياه
* إنترنت واتصالات
* تأمين
* مصاريف شهرية ثابتة
* أخرى

Purchase-linked categories:

* تكلفة النقل
* تكلفة الذبح
* تحميل وتنزيل
* تعبئة وتغليف
* رسوم مسلخ
* فرق وزن
* أخرى

Filters:

* Search by description
* Filter by date
* Filter by expense type
* Filter by category
* Filter by payment method
* Filter by user
* Filter by purchase-linked expenses
* Filter by recurring expenses

Actions:

* إضافة مصروف
* عرض
* تعديل
* إلغاء / حذف حسب الصلاحية
* طباعة سند مصروف
* رفع مرفق
* تصدير

3. Add Daily Expense Screen / Modal

Arabic title:
إضافة مصروف يومي

Fields:

* Date
* Category
* Description
* Amount AED
* Payment method:

  * كاش
  * حساب بنكي
  * شيك
  * أخرى
* Paid from:

  * خزنة
  * حساب بنكي
  * موظف
  * أخرى
* Reference number optional
* Notes
* Attachment / receipt upload

Show helper text:
“هذا المصروف سيتم احتسابه ضمن مصروفات اليوم ويؤثر على صافي ربح اليوم.”

Validation:

* Amount required
* Amount must be greater than zero
* Category required
* Date required
* Payment method required
* Attachment optional
* Reference required for bank transfer if settings require it

Actions:

* حفظ المصروف
* حفظ وإضافة آخر
* إلغاء

After success:
Show toast:
“تم تسجيل المصروف اليومي بنجاح”

4. Add Monthly Expense Screen / Modal

Arabic title:
إضافة مصروف شهري

Fields:

* Month
* Category
* Description
* Amount AED
* Payment method
* Paid from
* Due date
* Paid date optional
* Status:

  * مدفوع
  * غير مدفوع
  * مدفوع جزئياً
* Notes
* Attachment upload

Show helper text:
“هذا المصروف سيتم احتسابه ضمن مصروفات الشهر ويؤثر على صافي ربح الشهر.”

Common examples:

* إيجار السكن
* إيجار السيارات
* أقساط السيارات
* الرواتب
* مصاريف شهرية ثابتة

If unpaid:
Show warning:
“سيظهر هذا المصروف كمستحق غير مدفوع.”

5. Recurring Expenses Screen

Arabic title:
المصروفات المتكررة

Purpose:
Manage expected recurring monthly expenses.

Cards/table columns:

* اسم المصروف
* التصنيف
* المبلغ المتوقع
* التكرار
* يوم الاستحقاق
* آخر دفع
* القادم
* الحالة
* الإجراءات

Recurring frequencies:

* شهري
* أسبوعي
* سنوي
* مخصص

Actions:

* إضافة مصروف متكرر
* إنشاء مصروف لهذا الشهر
* إيقاف التكرار
* تعديل
* عرض التاريخ

Add/Edit recurring expense fields:

* Expense name
* Category
* Expected amount
* Frequency
* Due day
* Default payment method
* Auto-create monthly expense toggle
* Reminder before due date
* Notes

Show upcoming alert:
“إيجار السكن مستحق خلال 3 أيام”

6. Purchase-Linked Expense Screen / Section

Arabic title:
مصروف مرتبط بفاتورة شراء

This is important because purchase workflow already has purchase-related costs/deductions.

Fields:

* Select purchase invoice
* Supplier
* Purchase invoice amount
* Expense category
* Description
* Amount
* Treatment:

  * يضاف على تكلفة المخزون
  * مصروف مرتبط بالشراء فقط
  * يخصم من مستحق المورد
* Payment method
* Notes
* Attachment upload

Show visual explanation:

* If treatment = يضاف على تكلفة المخزون:
  “سيؤثر على تكلفة البضاعة وحساب الربح.”

* If treatment = مصروف مرتبط بالشراء فقط:
  “سيظهر في تقرير المصروفات دون تغيير تكلفة المخزون.”

* If treatment = يخصم من مستحق المورد:
  “سيقلل المبلغ المستحق للمورد.”

Show calculation preview:
Purchase goods total

* Inventory cost additions

- Supplier payable deductions
  = Supplier payable / inventory cost basis

7. Expense Detail Screen

Arabic title:
تفاصيل المصروف

Show:

* Expense number
* Date
* Type
* Category
* Description
* Amount
* Payment method
* Paid from
* Related purchase invoice if any
* Status
* Created by
* Created time
* Last edited by
* Attachments
* Notes

Actions:

* Edit expense
* Print expense voucher
* Upload receipt
* Cancel expense
* Duplicate expense

Tabs:

* Details
* Attachments
* Audit Log

Audit log entries:

* Expense created
* Amount edited
* Category changed
* Attachment uploaded
* Expense cancelled

8. Expense Voucher Preview

Arabic title:
سند مصروف

Create printable internal expense voucher.

Header:

* Company logo
* Company name Arabic/English
* Expense Voucher / سند مصروف
* Voucher number
* Date

Body:

* Expense type
* Category
* Description
* Amount
* Payment method
* Paid from
* Paid to / beneficiary optional
* Related purchase invoice optional
* Notes

Footer:

* Prepared by
* Approved by
* Receiver signature
* Attachment reference

Buttons:

* Print
* Export PDF
* Send WhatsApp premium placeholder
* Send Email placeholder

9. Expense Reports Screen

Arabic title:
تقرير المصروفات

Filters:

* Date from
* Date to
* Expense type
* Category
* Payment method
* User
* Purchase-linked only
* Recurring only

Report KPIs:

* Total expenses
* Daily expenses total
* Monthly expenses total
* Purchase-linked expenses total
* Highest category
* Average daily expense

Charts:

* Expenses by category donut chart
* Expenses over time line chart
* Daily vs monthly expenses bar chart
* Payment method distribution

Table:

* Date
* Expense number
* Type
* Category
* Description
* Amount
* Payment method
* Related purchase invoice
* User

Actions:

* Export PDF
* Export Excel
* Print report

10. Profit Impact Panel

Arabic title:
تأثير المصروفات على الربح

Create a simple panel showing how expenses affect profit.

Daily view:

* Sales today
* Purchases today
* Daily expenses
* Net profit today

Formula:
صافي ربح اليوم = المبيعات - المشتريات - المصروفات اليومية

Monthly view:

* Monthly sales
* Monthly purchases
* Monthly daily expenses
* Monthly fixed expenses
* Net profit month

Formula:
صافي ربح الشهر = مبيعات الشهر - مشتريات الشهر - المصروفات اليومية خلال الشهر - المصروفات الشهرية

Show warning if expenses are high:
“تنبيه: المصروفات مرتفعة مقارنة بالمبيعات.”

11. Expense Categories Settings

Arabic title:
إعدادات تصنيفات المصروفات

Allow Owner/Admin to manage categories.

Fields/table:

* Category name Arabic
* Category name English optional
* Type:

  * Daily
  * Monthly
  * Purchase-linked
  * General
* Active/inactive
* Default payment method optional
* Requires attachment toggle
* Notes

Actions:

* Add category
* Edit category
* Disable category

Default categories should already exist:

* مصاريف سيارات
* مصاريف عمال
* مصاريف تشغيل
* مصروفات متنوعة
* إيجار السكن
* إيجار السيارات
* أقساط السيارات
* الرواتب
* تكلفة النقل
* تكلفة الذبح
* تحميل وتنزيل
* تعبئة وتغليف

12. Expense Settings Panel

Arabic title:
إعدادات المصروفات

Settings:

* Allow cashier to add daily expenses
* Allow cashier to edit expenses
* Allow accountant to approve/cancel expenses
* Require attachment for expenses above amount
* Require reason when editing expense amount
* Require reference for bank payments
* Enable recurring expenses
* Auto-create monthly recurring expenses
* Include purchase-linked expenses in profit report
* Default expense numbering prefix
* Expense voucher template settings

Permission note:
“يمكن التحكم في من يستطيع إضافة أو تعديل أو إلغاء المصروفات من هذه الإعدادات.”

13. Role and Permission States

Owner / Tenant Admin:

* Can view all expenses
* Can create daily/monthly/purchase-linked expenses
* Can edit expenses
* Can cancel expenses
* Can manage categories
* Can manage recurring expenses
* Can view profit impact
* Can export reports

Accountant:

* Can create and review expenses
* Can edit/cancel if permission enabled
* Can manage recurring expenses if permission enabled
* Can export reports
* Can view profit impact

Cashier:

* Can add daily expenses only if permission enabled
* Cannot view profit impact unless permission enabled
* Cannot manage categories
* Cannot cancel expenses unless permission enabled

Show disabled buttons with tooltip:
“ليس لديك صلاحية لتنفيذ هذا الإجراء”

14. Validation and Error States

Show:

* Missing category
* Missing amount
* Amount must be greater than zero
* Missing payment method
* Missing date
* Attachment required
* Bank reference required
* Cannot edit cancelled expense
* Permission denied
* Recurring expense already created for this month
* Purchase invoice required for purchase-linked expense
* Treatment required for purchase-linked expense
* Expense saved successfully
* Expense cancelled successfully
* Report export loading

15. Empty States

No expenses today:
“لا توجد مصروفات اليوم”
Button:
“إضافة مصروف يومي”

No monthly expenses:
“لا توجد مصروفات شهرية”
Button:
“إضافة مصروف شهري”

No recurring expenses:
“لا توجد مصروفات متكررة”
Button:
“إضافة مصروف متكرر”

No expense report data:
“لا توجد بيانات في هذه الفترة”

No categories:
“لا توجد تصنيفات مصروفات”

16. Mobile Expense Experience

Create mobile responsive screens.

Mobile behavior:

* Expenses overview as cards
* Add expense as simple step form
* Large category chips
* Sticky bottom save button
* Expense list as cards
* Recurring expenses as cards
* Profit impact simplified
* Report filters collapsed into bottom sheet

Mobile quick actions:

* إضافة مصروف
* مصروف شهري
* تقرير المصروفات

17. Sample Data

Use realistic UAE poultry company sample expenses:

Daily expenses:

* Fuel for delivery vehicle: AED 120
* Worker daily allowance: AED 80
* Loading/unloading: AED 150
* Vehicle maintenance: AED 450
* Misc operational expense: AED 60

Monthly expenses:

* Accommodation rent: AED 4,500
* Vehicle rent/installment: AED 2,300
* Salaries: AED 18,000
* Internet and phone: AED 650
* Electricity and water: AED 1,200

Purchase-linked expenses:

* Slaughter cost linked to PUR-2026-00034: AED 700
* Transport cost linked to PUR-2026-00034: AED 300
* Loading cost linked to PUR-2026-00035: AED 150

Sample dashboard numbers:

* Today expenses: AED 850
* This month daily expenses: AED 12,400
* Monthly fixed expenses: AED 26,650
* Total monthly expenses: AED 39,050

18. Navigation Integration

Connect:
Tenant sidebar “المصروفات” → Expenses Overview.
Tenant dashboard “مصروفات اليوم” KPI → Expenses Overview filtered by today.
Tenant dashboard quick action “إضافة مصروف” → Add Daily Expense.
Tenant dashboard profit card → Profit Impact Panel.
Purchase invoice “Add purchase-linked expense” → Purchase-Linked Expense screen.
Expense row → Expense Detail.
Expense report shortcut → Expense Reports Screen.
Settings gear → Expense Settings Panel.

Mobile bottom navigation:
Add or highlight expenses under “المزيد” if there is no direct bottom nav item.

19. App.tsx Wiring

Add expense-related TenantScreen values such as:

* expenses
* expenses-new
* expenses-monthly
* expenses-recurring
* expense-detail
* expenses-report
* expenses-profit-impact

Wire sidebar:
“المصروفات” should open ExpensesOverviewScreen.

Wire dashboard:
“مصروفات اليوم” KPI card should open ExpensesOverviewScreen filtered by today.
Quick action “إضافة مصروف” should open Add Daily Expense modal/screen.

Wire purchase module:
Purchase-linked expense buttons should open Purchase-Linked Expense screen with purchase invoice context if available.

20. Do Not Build Backend Logic

This is still Figma Make UI/UX work.
Use realistic mock data.
Focus on screens, flows, states, responsiveness, permissions, recurring expense UX, purchase-linked expenses, and business rule visibility.

The final result should feel like a real production Expenses Management workflow for UAE poultry distribution companies, with daily expenses, monthly expenses, recurring expenses, purchase-linked expenses, expense vouchers, profit impact, PDF/Excel reports, and permission-controlled actions.
