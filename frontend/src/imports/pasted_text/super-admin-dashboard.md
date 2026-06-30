Create a complete Arabic-first SaaS Super Admin Dashboard UI/UX for a poultry trading ERP product called “Poultry Hero”.

The purpose of this design is to allow the SaaS owner to manage poultry distribution companies using the platform. This is not the tenant/company business dashboard yet. This prompt focuses only on the SaaS owner / Super Admin area.

The design must be extremely simple, clean, and easy to understand. Assume the future users of the tenant system may be poultry business owners who are not technical and may have low education levels, so the overall product language, visual system, and navigation must feel simple, obvious, and guided. However, this specific dashboard is for the SaaS owner.

Use Arabic as the primary language and RTL layout by default. Add an English language switch option and make sure all screens can support both Arabic RTL and English LTR. Arabic labels should appear first. Use clear Arabic business terms, not technical developer terms.

Product name:
Poultry Hero

Brand positioning:
A modern SaaS platform for UAE poultry traders and poultry distribution companies. It manages companies, users, subscriptions, payments, and later their full poultry ERP operations.

Color system:

* Primary Brand: #0F2C59 Deep Navy — use for navigation bars, headers, primary buttons, active menu items, dashboard structure.
* Secondary Accent: #22C55E Agri-Green — use for active companies, paid status, positive growth, success messages.
* Alert / Danger: #EF4444 Biosecurity Red — use for suspended tenants, overdue payments, critical alerts.
* System Warning: #F59E0B Amber Yellow — use for trials ending soon, pending payments, upcoming renewals.
* Background Neutral: #F8FAFC Slate White — use as the main application background.
* Data Neutral: #64748B Cool Gray — use for secondary text, table borders, inactive states, chart grid lines.

Visual style:

* Modern enterprise SaaS dashboard.
* Clean UAE business software feel.
* Large readable typography.
* High contrast.
* Simple icons beside text.
* Rounded cards.
* Clear action buttons.
* Avoid clutter.
* Avoid decorative poultry illustrations except very subtle branding.
* Make it feel trustworthy, professional, and easy.

Main user role:
SUPER_ADMIN

Super Admin responsibilities:

* View SaaS business overview.
* Create new tenant/company.
* Create the first tenant admin user.
* Manage company subscription plan.
* Manage company status.
* Record manual subscription payments.
* Track outstanding payments.
* View renewal dates.
* Suspend or reactivate companies.
* Manage available plans.
* View audit logs.

SaaS hierarchy:
SUPER_ADMIN creates Company / Tenant.
Company / Tenant has one or more Tenant Admin Users.
Tenant Admin later configures the company ERP system.

Tenant plans:

* Basic
* Pro
* Enterprise

Tenant statuses:

* Trial
* Active
* Suspended

Billing model:

* Manual payment only.
* No Stripe.
* No online payment gateway.
* Super Admin records payments manually.
* Super Admin tracks outstanding amounts manually.
* Each tenant has monthly price, yearly price, renewal date, total paid, total outstanding, last payment date, and payment notes.

Required screens:

1. Super Admin Login Screen
   Create an Arabic-first login page for Poultry Hero.
   Include:

* Logo placeholder.
* Product name.
* Arabic headline: “لوحة تحكم Poultry Hero”
* Email/phone field.
* Password field.
* Login button.
* Language switch: عربي / English.
* Forgot password link.
* Clean split layout on desktop.
* Simple full-screen mobile layout.

2. Super Admin Main Dashboard
   Create a SaaS overview dashboard.

Dashboard KPIs:

* إجمالي الشركات / Total Companies
* الشركات النشطة / Active Companies
* الشركات التجريبية / Trial Companies
* الشركات الموقوفة / Suspended Companies
* الإيراد الشهري المتوقع / Expected Monthly Revenue
* المدفوع هذا الشهر / Collected This Month
* المبالغ المستحقة / Outstanding Payments
* تجديدات قريبة / Upcoming Renewals
* مدفوعات متأخرة / Overdue Payments
* مستخدمين نشطين / Active Users

Dashboard sections:

* KPI cards at top.
* Revenue summary chart.
* Tenant status distribution chart.
* Upcoming renewals list.
* Outstanding payments list.
* Recent tenant activity feed.
* Quick actions:

  * إضافة شركة جديدة
  * تسجيل دفعة
  * إيقاف شركة
  * عرض الشركات المتأخرة

Make the dashboard simple and visual. Use status badges with colors:

* Active = green
* Trial = amber
* Suspended = red
* Paid = green
* Outstanding = red
* Renewal soon = amber

3. Companies / Tenants List Screen
   Create a table/list page for all companies.

Columns:

* Company name
* Subdomain
* Owner/admin name
* Phone
* Plan
* Status
* Monthly price
* Yearly price
* Renewal date
* Outstanding amount
* Last payment
* Actions

Filters:

* Search by company name.
* Filter by plan.
* Filter by status.
* Filter by renewal date.
* Filter by outstanding payments.

Actions:

* View details
* Edit company
* Record payment
* Suspend
* Reactivate
* Open tenant dashboard

Include mobile card layout instead of table on small screens.

4. Create New Company Wizard
   Design a step-by-step wizard. It must be very clear and guided.

Steps:
Step 1: Company Information
Fields:

* Company name Arabic
* Company name English
* Trade license number
* VAT/TRN number optional
* Country = UAE
* Emirate
* Business address
* Contact phone
* Contact email

Step 2: Tenant Access
Fields:

* Subdomain
* Preview URL: companyname.poultryhero.com
* Validation message for subdomain format
* Show error state for duplicate subdomain
* Show helper text: “استخدم حروف إنجليزية صغيرة بدون مسافات”

Step 3: Subscription Plan
Fields:

* Plan: Basic / Pro / Enterprise
* Status: Trial / Active / Suspended
* Monthly price AED
* Yearly price AED
* Renewal date
* Trial end date if status is Trial
* Notes

Step 4: Create Tenant Admin User
Fields:

* Admin full name
* Admin phone
* Admin email
* Temporary password
* Confirm temporary password
* Force password change on first login toggle

Step 5: Enabled Modules
Show module toggles:

* Dashboard
* Sales
* Purchases
* Inventory
* Customers
* Suppliers
* Accounts
* Payments & Receipts
* Expenses
* Tax
* Reports
* Settings
* User Management

Step 6: Review & Create
Show all entered information in a clean review page.
Primary button: “إنشاء الشركة”
Secondary button: “رجوع”
Show success state after creation.

5. Company Details Screen
   Create a detailed tenant profile page.

Tabs:

* Overview
* Users
* Subscription
* Payments
* Modules
* Activity Log
* Settings

Overview cards:

* Company name
* Subdomain
* Current status
* Current plan
* Renewal date
* Outstanding balance
* Total paid
* Created date

Actions:

* Edit company
* Suspend company
* Reactivate company
* Record payment
* Open tenant dashboard

6. Manual Payments Screen
   Create a payment management screen for SaaS subscription payments.

Table columns:

* Payment date
* Company
* Amount paid
* Payment method
* Billing period
* Reference number
* Recorded by
* Notes
* Receipt status

Payment methods:

* Cash
* Bank transfer
* Cheque
* Other

Payment form fields:

* Company
* Amount paid AED
* Payment date
* Payment method
* Billing period from
* Billing period to
* Reference number optional
* Notes
* Attach receipt placeholder
* Update outstanding balance automatically in UI preview

Outstanding payment logic to represent visually:

* Outstanding = subscription amount due - total payments recorded for the billing period
* If outstanding is 0, show Paid.
* If outstanding is greater than 0 and renewal date passed, show Overdue.
* If outstanding is greater than 0 and renewal date upcoming, show Pending.

7. Outstanding Payments Screen
   Create a focused page for unpaid or partially paid tenants.

Cards and table:

* Total outstanding AED
* Overdue companies count
* Due in next 7 days
* Suspended due to payment

Table columns:

* Company
* Plan
* Renewal date
* Expected amount
* Paid amount
* Outstanding amount
* Days overdue
* Status
* Actions

Actions:

* Record payment
* Send reminder placeholder
* Suspend tenant
* Add note

8. Plans & Pricing Settings Screen
   Create a settings page for SaaS plans.

Plans:

* Basic
* Pro
* Enterprise

Each plan card should include:

* Plan name
* Monthly price
* Yearly price
* Number of users allowed
* Modules enabled
* Description
* Active/inactive toggle

Do not overcomplicate. Keep it editable and simple.

9. Audit Log Screen
   Create an audit log page for SaaS-level actions.

Track actions:

* Tenant created
* Tenant updated
* Tenant suspended
* Tenant reactivated
* Payment recorded
* Plan changed
* Admin user created
* Modules changed

Table columns:

* Date/time
* User
* Action
* Company
* Details
* IP address placeholder

Filters:

* Date
* User
* Company
* Action type

10. Responsive Mobile Version
    For all important screens, create mobile-responsive layouts.

Mobile behavior:

* Bottom navigation or collapsible menu.
* Cards instead of dense tables.
* Large tap targets.
* Sticky primary action button.
* Arabic RTL mobile layout.
* Quick actions visible.
* Dashboard KPIs scroll in cards.

Navigation structure:
Sidebar on desktop:

* الرئيسية
* الشركات
* المدفوعات
* المبالغ المستحقة
* الخطط والأسعار
* سجل العمليات
* الإعدادات

Mobile navigation:

* الرئيسية
* الشركات
* المدفوعات
* المزيد

UX rules:

* Arabic-first labels.
* English labels can appear as secondary small text or switchable language mode.
* Use simple status badges.
* Use clear empty states.
* Use loading skeletons.
* Use error states.
* Use confirmation dialogs for dangerous actions like suspend company.
* Use success toast after creating company or recording payment.
* Use simple language: avoid words like “tenant provisioning” in the UI. Use “إضافة شركة” instead.

Important empty states:

* No companies yet: show a friendly card with “ابدأ بإضافة أول شركة”
* No payments yet: show “لم يتم تسجيل أي دفعات بعد”
* No outstanding payments: show green success state “لا توجد مبالغ مستحقة”
* No audit logs: show “لا توجد عمليات مسجلة حتى الآن”

Important edge cases to show:

* Duplicate subdomain error.
* Missing required company name.
* Invalid phone number.
* Invalid email.
* Renewal date passed.
* Trial ending soon.
* Suspended company.
* Company with partial payment.
* Company with no admin user.
* Company with disabled modules.

Generate the UI as a polished, production-quality SaaS dashboard design. Make sure the screens are connected logically and the user flow is clear from login to dashboard to creating a company to recording a manual payment.
