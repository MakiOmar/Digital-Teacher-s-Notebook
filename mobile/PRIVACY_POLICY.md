# Privacy Policy — دفتر المعلم الرقمي  
# سياسة الخصوصية — Digital Teacher Notebook

**App:** دفتر المعلم الرقمي (Digital Teacher Notebook)  
**Package:** `com.itqandev.digitalteachernotebook`  
**Developer:** ITQAN Dev  
**Last updated:** 14 August 2026  

> **Host this page on HTTPS** and paste that URL into Google Play Console → App content → Privacy policy.  
> Replace `SUPPORT_EMAIL_HERE` and `SUPPORT_WHATSAPP_HERE` before publishing.

---

## English (publish this section on your website)

### 1. Who we are

This privacy policy applies to the mobile application **Digital Teacher Notebook** (“the App”), published by **ITQAN Dev** (“we”, “us”).

Contact for privacy requests: **SUPPORT_EMAIL_HERE**  
(Optional WhatsApp support: **SUPPORT_WHATSAPP_HERE**)

### 2. What the App does

The App helps private tutors manage academic years, groups, students, attendance, schedules, and payments. Core teaching data is stored **on the user’s device** (local SQLite database). The App is designed to work primarily offline.

### 3. Data we process

#### 3.1 Data stored only on your device (not uploaded to our servers)

You may enter or generate:

- Tutor profile (name, optional profile photo chosen from camera/gallery)
- Academic years, groups, schedules, sessions
- Student names and optional phone numbers (student / parent)
- Attendance records and payments / dues
- App settings (language, currency display, page size, reminders)
- Backup files you export or import

This information stays on the device unless **you** export a backup or share a file (for example via WhatsApp, Drive, or email). We do **not** operate a cloud account that syncs your students or payments.

#### 3.2 Data sent to the license server (required to unlock the App)

To activate or validate a license / trial, the App contacts:

**`https://ulsp.gamesspoteg.com`** (ULSP license API)

Typical data sent:

- License key (or trial request)
- Device identifier generated for licensing (`device_id`)
- Device name / platform (Android/iOS) and app version
- Activation / validation status metadata

Purpose: license entitlement, anti-abuse (activation limits), trial management.

License credentials on the device are stored in the OS secure storage (Secure Store), not inside the teaching-data backup file.

Offline use: after a successful validation, the App may remain unlocked for a limited grace period (currently up to **7 days**) without contacting the server.

#### 3.3 Optional permissions and why we ask

| Permission | When | Purpose |
|------------|------|---------|
| Internet | License activate/validate | Unlock the App |
| Contacts | Only if you tap “Contacts” when adding a student | Pick a phone number faster (you choose which contact) |
| Camera / photos | Only if you set a tutor profile photo | Display your profile image on-device |
| Notifications | If you enable reminders | Session / reminder alerts |
| Biometric / device lock | If you enable App Lock | Unlock the App with fingerprint/Face/PIN (processed by the device OS; we do not receive biometric templates) |

You can deny optional permissions; core offline features still work, except the related feature.

### 4. What we do **not** do

- No advertising SDKs / no ads in the App  
- No sale of personal data  
- No social login  
- No analytics SDK that tracks your students or payments to third-party ad networks  
- We do not upload your student lists, attendance, or payment amounts to ITQAN servers for marketing

### 5. Sharing

- **Teaching data:** not shared by us. Only you can share backups or screenshots.  
- **License data:** processed by the ULSP service at `ulsp.gamesspoteg.com` solely for licensing.  
- **Legal:** we may disclose information if required by applicable law.

### 6. Retention

- On-device teaching data: kept until you delete it, clear app data, uninstall, or overwrite via backup restore.  
- Backup files: controlled by you (device storage / wherever you saved them).  
- License records: retained on the license server according to the ULSP / product licensing rules (activations, expiry, support window).

### 7. Security

We use on-device storage, optional App Lock, and secure storage for license secrets. No method of transmission or storage is 100% secure; protect your device and backups.

### 8. Children

The App is intended for **adults** (teachers / tutors). It is not directed at children. Student records you enter are under your responsibility as the tutor.

### 9. Your choices

- Edit or delete students and records inside the App  
- Export or delete backups you created  
- Revoke Contacts / Camera / Notification permissions in system settings  
- Deactivate the license from the App’s license screen (where available)  
- Uninstall the App to remove local data (backups you exported remain where you saved them)

### 10. International processing

License validation may be processed on servers operated for ULSP (see domain above). By activating a license you understand that limited license metadata leaves your device.

### 11. Changes

We may update this policy. The “Last updated” date will change. Continued use after an update means you accept the revised policy where permitted by law.

### 12. Contact

Privacy / support: **SUPPORT_EMAIL_HERE**

---

## العربية (انشر هذا القسم في صفحة الويب)

### 1. من نحن

تنطبق سياسة الخصوصية هذه على تطبيق **دفتر المعلم الرقمي** (“التطبيق”) الصادر عن **ITQAN Dev** (“نحن”).

للتواصل بخصوص الخصوصية: **SUPPORT_EMAIL_HERE**  
(واتساب اختياري: **SUPPORT_WHATSAPP_HERE**)

### 2. ماذا يفعل التطبيق؟

يساعد التطبيق مدرّسي الحصص الخصوصية على إدارة السنوات الدراسية والمجموعات والطلاب والحضور والجداول والمدفوعات. تُحفظ بيانات التدريس الأساسية **على جهاز المستخدم** (قاعدة بيانات محلية). التطبيق مصمم للعمل غالباً دون اتصال.

### 3. البيانات التي نعالجها

#### 3.1 بيانات تبقى على جهازك فقط (لا تُرفع إلى خوادمنا)

قد تُدخل أو تُنشئ:

- الملف الشخصي للمدرس (الاسم، وصورة اختيارية)
- السنوات والمجموعات والجداول والحصص
- أسماء الطلاب وأرقام الهواتف الاختيارية (طالب / ولي أمر)
- سجلات الحضور والمدفوعات والمستحقات
- إعدادات التطبيق (اللغة، العملة، حجم الصفحات، التذكيرات)
- ملفات النسخ الاحتياطي التي تصدّرها أو تستوردها

تبقى هذه المعلومات على الجهاز ما لم **تقم أنت** بتصدير نسخة احتياطية أو مشاركة ملف. لا نوفر حساب سحابي لمزامنة طلابك أو مدفوعاتك.

#### 3.2 بيانات تُرسل إلى خادم الترخيص (لاستخدام التطبيق)

لتفعيل أو التحقق من الترخيص / التجربة، يتصل التطبيق بـ:

**`https://ulsp.gamesspoteg.com`**

وقد يُرسل عادةً:

- مفتاح الترخيص (أو طلب تجربة)
- معرّف جهاز لأغراض الترخيص
- اسم الجهاز / المنصة وإصدار التطبيق
- بيانات حالة التفعيل / التحقق

الغرض: التحقق من أحقيّة الاستخدام، ومنع إساءة الاستخدام، وإدارة الفترة التجريبية.

تُحفظ بيانات الترخيص على الجهاز في التخزين الآمن للنظام، وليس داخل ملف نسخة بيانات التدريس.

عند انقطاع الإنترنت بعد تحقق ناجح، قد يبقى التطبيق مفتوحاً لفترة سماح محدودة (حالياً حتى **7 أيام**).

#### 3.3 الأذونات الاختيارية

| الإذن | متى | الغرض |
|-------|-----|--------|
| الإنترنت | تفعيل/التحقق من الترخيص | فتح التطبيق |
| جهات الاتصال | عند اختيار رقم من جهات الاتصال | إدخال أسرع لأرقام الطلاب |
| الكاميرا / الصور | عند اختيار صورة الملف الشخصي | عرض صورتك محلياً |
| الإشعارات | عند تفعيل التذكيرات | تنبيهات الحصص |
| القياسات الحيوية / قفل الجهاز | عند تفعيل قفل التطبيق | فتح التطبيق ببصمة/وجه/رمز (يعالجها نظام الجهاز؛ لا نستلم قوالب البصمة) |

يمكنك رفض الأذونات الاختيارية؛ تبقى الميزات الأساسية دون اتصال متاحة باستثناء الميزة المرتبطة بالإذن.

### 4. ما لا نفعله

- لا إعلانات داخل التطبيق  
- لا بيع للبيانات الشخصية  
- لا تسجيل دخول عبر شبكات اجتماعية  
- لا نرفع قوائم الطلاب أو الحضور أو مبالغ المدفوعات إلى خوادم ITQAN لأغراض تسويقية  

### 5. المشاركة

- **بيانات التدريس:** لا نشاركها. أنت فقط من يمكنه مشاركة النسخ الاحتياطية.  
- **بيانات الترخيص:** تُعالج عبر خدمة ULSP على النطاق المذكور أعلاه لأغراض الترخيص فقط.  
- **القانون:** قد نُفصح عند إلزام القانون المعمول به.

### 6. الاحتفاظ بالبيانات

- بيانات الجهاز: حتى تحذفها أو تمسح بيانات التطبيق أو تزيل التثبيت أو تستبدلها بنسخة احتياطية.  
- ملفات النسخ الاحتياطي: تحت سيطرتك.  
- سجلات الترخيص: وفق قواعد نظام ULSP (التفعيلات، الانتهاء، الدعم).

### 7. الأمان

نستخدم التخزين المحلي، وقفل التطبيق الاختياري، والتخزين الآمن لأسرار الترخيص. لا توجد وسيلة نقل أو تخزين آمنة 100٪؛ احمِ جهازك ونسخك الاحتياطية.

### 8. الأطفال

التطبيق موجّه **للبالغين** (المدرسين). مسؤولية بيانات الطلاب التي تُدخلها تقع عليك كمدرّس.

### 9. خياراتك

تعديل أو حذف السجلات داخل التطبيق، تصدير/حذف النسخ الاحتياطية، إلغاء الأذونات من إعدادات النظام، إلغاء تفعيل الترخيص من شاشة الترخيص إن وُجدت، أو إلغاء تثبيت التطبيق.

### 10. التعديلات

قد نحدّث هذه السياسة. تاريخ “آخر تحديث” يتغيّر عندها.

### 11. التواصل

**SUPPORT_EMAIL_HERE**

---

## Google Play Console — quick fill guide

### A) Privacy policy URL

1. Copy this policy to your site (GitHub Pages, your domain, Notion public page, etc.) over **HTTPS**.  
2. Play Console → **App content** → **Privacy policy** → paste the URL.  
3. Replace `SUPPORT_EMAIL_HERE` before going live.

### B) Data safety form (suggested answers)

| Question area | Suggested answer |
|---------------|------------------|
| Does the app collect / share user data? | **Yes** — limited license/device data collected for licensing; teaching data is on-device |
| Collected: Device or other IDs | **Yes** — device id for license; **not** shared with advertisers |
| Collected: Personal info (name, phone) | **Yes, optional / user-entered** — stored **on device**; purpose: App functionality; not shared by developer |
| Photos | **Yes, optional** — profile photo on device |
| Approximate location / precise location | **No** |
| Web browsing / search history | **No** |
| Shared with third parties? | License data processed by ULSP (`ulsp.gamesspoteg.com`) for **App functionality / Account management / Fraud prevention**. Teaching data **not** shared by us |
| Data encrypted in transit? | **Yes** (HTTPS to license API) |
| Users can request deletion? | **Yes** — delete in-app / uninstall; for license records contact support |
| Committed to Play Families Policy? | **No** (not a kids app) |
| Ads | **No** |

### C) App access (reviewers)

In **App access**, explain that a license key is required and provide a temporary review key + steps (activate on first screen).

---

## Developer checklist before hosting

- [ ] Replace `SUPPORT_EMAIL_HERE`  
- [ ] Replace `SUPPORT_WHATSAPP_HERE` (or remove the WhatsApp line)  
- [ ] Confirm ULSP domain is still `https://ulsp.gamesspoteg.com`  
- [ ] Publish HTTPS URL  
- [ ] Paste URL in Play Console Privacy policy  
- [ ] Align Data safety answers with this document  
