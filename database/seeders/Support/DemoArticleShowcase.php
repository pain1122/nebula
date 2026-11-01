<?php

namespace Database\Seeders\Support;

/** Bilingual, non-clinical long-form fixture. Image inputs are verified editorial resources. */
final class DemoArticleShowcase
{
    public const SLUG = 'demo-seed-complete-visit-guide';

    public static function translations(array $images = []): array
    {
        $en = <<<'HTML'
<p><strong>A little preparation makes a digital appointment easier to follow.</strong> This practical guide walks through the journey from opening your account to finding your appointment history afterwards. It is written as a complete demonstration article, with examples of headings, emphasis, lists, quotations, links and illustrated explanations. It uses synthetic examples rather than personal records, and it does not offer a diagnosis or a treatment recommendation.</p>
<p>You do not need to complete everything at once. Read the overview, choose the steps that matter to your visit, and return to the guide when you need a reminder. The aim is to make the panel feel familiar: knowing where information lives is often more useful than memorising every button.</p>
<h2>1. Start with a clear picture of your visit</h2>
<p>Before booking, think about the purpose of the appointment and the information you already have. A short note in your own words can help you distinguish the question you want to ask from the practical arrangements around it. Keep those notes private and bring them through the appropriate care workflow rather than placing them in a public article, a search query or a shared screenshot.</p>
<p><em>The booking screen helps organise an appointment; it does not replace a conversation with your clinician.</em> An available time, a service description and a payment state each answer a different question. Take a moment to read each of them instead of assuming that one successful step means every later step is complete.</p>
{{wide}}
<h3>Choose the right service and location</h3>
<p>Read the service description, compare the available professionals and check the location attached to the selected time. A doctor may offer different services at different workplaces. The location and service shown for one appointment should not be inferred from another appointment or from an old browser tab.</p>
<ul><li><strong>Service:</strong> check that the appointment describes the service you intended to select.</li><li><strong>Professional:</strong> read the actual profile information instead of relying on a similar name.</li><li><strong>Location:</strong> confirm the displayed clinic or hospital for that particular appointment.</li><li><strong>Time:</strong> check the date and time immediately before confirming.</li></ul>
<h4>A small detail worth checking</h4>
<p>Dates can look familiar even when they belong to an earlier visit. <u>Use the date displayed on the current appointment</u>, not a date copied from a previous example or a message about another booking. If the screen changes after a refresh, read the current information before continuing.</p>
<h2>2. Follow the booking steps in order</h2>
<p>The clearest way to use a booking wizard is to finish one decision before moving to the next. You can still go back to compare options, but a changed service or location may require a different available time. Keep the summary in view and treat the final confirmation as a chance to review the complete combination.</p>
<ol><li>Choose the service you want to explore.</li><li>Read the available doctor information and select the appropriate option.</li><li>Choose the workplace associated with that service.</li><li>Select a currently available date and time.</li><li>Review the summary, including any displayed price, before confirming.</li></ol>
<blockquote><p><strong>One useful habit:</strong> when a result is uncertain, read the current state before repeating an action. A second click should not be used as a substitute for understanding what happened after the first click.</p></blockquote>
<p>This habit is especially helpful if the connection becomes slow. Wait for the result, use the screen's refresh or recovery option when offered, and check your appointment list. Do not assume that closing a tab cancels an appointment or that reopening it creates a fresh transaction.</p>
<h2>3. Keep documents organised and private</h2>
{{side}}
<p>Documents belong in the private workflow connected to the relevant request. An article illustration and a personal attachment serve different purposes: the first helps explain a general idea, while the second may contain information about a particular person. Avoid copying personal files into a general content library or sharing an image merely because it looks similar to an example shown here.</p>
<p>Use a recognisable file name and check that you selected the intended document. Read the accepted type and size shown by the upload control. A file being selected, uploaded, checked and made available are separate events; the interface should show the current result rather than leaving you to guess from the presence of a file name.</p>
<h3>Before you select a file</h3>
<ul><li>Open the correct appointment and the request associated with it.</li><li>Read the requested document categories and any instructions.</li><li>Choose only the file that belongs to this request.<ul><li>Avoid unrelated pages or another person's details.</li><li>Check that the document is readable before submitting it.</li></ul></li><li>Wait for the displayed processing result before assuming the file is available.</li></ul>
<p>If a file remains unavailable, use the status and recovery options provided by the application. Renaming a file does not change its contents, and repeated uploads are not a reliable way to fix an unclear result. Keep the original document safely and ask for clarification through the appropriate support or care channel when needed.</p>
<h2>4. Read the article, not just its illustrations</h2>
<p>Pictures can draw attention to an important part of a process, but the explanation around them provides the context. In this demonstration, a wide illustration introduces an idea, a smaller side illustration sits beside an explanation, and an inline illustration shares a paragraph with text. Captions identify what the picture represents without pretending that a synthetic drawing is a real patient record.</p>
{{inline}}
<p>Good alternative text and captions are useful for different reasons. Alternative text helps describe an image when it cannot be seen; a caption is visible supporting text for everyone reading the article. Neither should contain personal information copied from a private document.</p>
{{captioned}}
<h3>Formatting should make meaning easier to find</h3>
<p><strong>Bold text</strong> highlights a key point. <em>Italic text</em> can distinguish a reminder from the surrounding explanation. <u>Underlined text</u> is demonstrated sparingly here so it is not confused with a navigation link. Headings divide a long article into sections, while ordered lists describe a sequence and unordered lists collect related checks.</p>
<p>A link should have a useful label. For example, the <a href="https://www.w3.org/WAI/" title="Web Accessibility Initiative">Web Accessibility Initiative</a> is linked by name instead of an unexplained address. Links in an article are references, not permission to upload documents to another website or evidence that the application has contacted that website.</p>
<h2>5. Return to your appointment history</h2>
<p>After a visit, return to the appointment that actually took place. Read the current status and open only the outcomes available through that appointment. A saved questionnaire, a private attachment and a published report are different kinds of information; each should be read in its own context rather than treated as an interchangeable file.</p>
<h4>When you revisit a page</h4>
<p>Refresh if the page asks you to, check the account you are using, and confirm that you are looking at the right appointment. If you share a device, sign out when finished. Another person's access should never be inferred from the fact that a page was previously open in the browser.</p>
<blockquote><p>Keep the next step simple: identify the correct record, read its current state, and use the action that belongs to that state.</p></blockquote>
<h2>A short checklist to keep</h2>
<ol><li>Confirm the service, professional, workplace and time.</li><li>Read the summary before confirming a booking.</li><li>Use private requests for personal documents.</li><li>Check the processing result instead of guessing.</li><li>Return to the correct appointment for its published outcome.</li><li>Sign out on a shared device.</li></ol>
<p>This guide is a demonstration of the reading experience and supported formatting. The recommendations beside it are general published reading suggestions. They are not personal medical advice, a diagnosis or an assessment of your health information.</p>
HTML;
        $fa = <<<'HTML'
<p><strong>کمی آمادگی، دنبال کردن یک نوبت آنلاین را آسان‌تر می‌کند.</strong> این راهنما مسیر استفاده از حساب، انتخاب نوبت، آماده کردن مدارک و پیدا کردن سابقهٔ مراجعه را قدم‌به‌قدم توضیح می‌دهد. متن به شکل یک مقالهٔ کامل نوشته شده تا نمونهٔ واقعی تیترها، تأکید، فهرست، نقل‌قول، پیوند و تصویر در کنار هم دیده شود. مثال‌ها ساختگی هستند و این نوشته تشخیص یا پیشنهاد درمانی ارائه نمی‌کند.</p>
<p>لازم نیست همهٔ کارها را یک‌باره انجام دهید. ابتدا تصویر کلی را بخوانید، بخش مربوط به نوبت خود را پیدا کنید و هر زمان لازم بود دوباره به راهنما برگردید. هدف این است که جای اطلاعات را در پنل بشناسید؛ حفظ کردن نام همهٔ دکمه‌ها معمولاً به اندازهٔ شناختن مسیر درست مفید نیست.</p>
<h2>۱. از هدف و جزئیات نوبت شروع کنید</h2>
<p>پیش از انتخاب نوبت، به هدف مراجعه و اطلاعاتی که در اختیار دارید فکر کنید. یک یادداشت کوتاه با بیان خودتان می‌تواند پرسشی را که می‌خواهید مطرح کنید از هماهنگی‌های اجرایی نوبت جدا کند. این یادداشت را خصوصی نگه دارید و از مسیر مناسب مراقبت استفاده کنید؛ متن عمومی مقاله، عبارت جستجو یا تصویر اشتراکی جای نگهداری اطلاعات شخصی نیست.</p>
<p><em>صفحهٔ رزرو به هماهنگی یک نوبت کمک می‌کند و جای گفت‌وگو با پزشک را نمی‌گیرد.</em> زمان آزاد، توضیح خدمت و وضعیت پرداخت هر کدام به پرسشی متفاوت پاسخ می‌دهند. موفق بودن یک مرحله به این معنی نیست که تمام مرحله‌های بعدی نیز انجام شده‌اند.</p>
{{wide}}
<h3>خدمت و محل مناسب را انتخاب کنید</h3>
<p>توضیح خدمت را بخوانید، اطلاعات متخصصان موجود را بررسی کنید و محل متصل به زمان انتخاب‌شده را ببینید. ممکن است یک پزشک در محل‌های مختلف خدمات متفاوتی ارائه کند. محل و خدمت یک نوبت را از روی نوبت دیگری یا یک صفحهٔ قدیمی حدس نزنید.</p>
<ul><li><strong>خدمت:</strong> بررسی کنید که توضیح نوبت با خدمت مورد نظر شما یکسان است.</li><li><strong>پزشک:</strong> به جای تکیه بر تشابه نام‌ها، اطلاعات واقعی پروفایل را بخوانید.</li><li><strong>محل:</strong> بیمارستان یا درمانگاه همان نوبت را تأیید کنید.</li><li><strong>زمان:</strong> تاریخ و ساعت را درست پیش از تأیید دوباره بررسی کنید.</li></ul>
<h4>جزئیات کوچک اما مهم</h4>
<p>ممکن است یک تاریخ آشنا به نظر برسد، اما مربوط به مراجعهٔ قبلی باشد. <u>ملاک را تاریخ نمایش‌داده‌شده در نوبت جاری قرار دهید</u>، نه تاریخی که از مثال قبلی یا پیام مربوط به نوبت دیگری به یاد دارید. اگر اطلاعات پس از تازه‌سازی تغییر کرد، پیش از ادامه وضعیت جدید را بخوانید.</p>
<h2>۲. مرحله‌های رزرو را به ترتیب دنبال کنید</h2>
<p>در یک فرم چندمرحله‌ای بهتر است هر تصمیم را پیش از تصمیم بعدی روشن کنید. می‌توانید برای مقایسه به مرحلهٔ قبل برگردید، اما تغییر خدمت یا محل ممکن است به انتخاب زمان تازه‌ای نیاز داشته باشد. خلاصهٔ نوبت را بررسی کنید و تأیید نهایی را فرصتی برای مرور مجموعهٔ کامل انتخاب‌ها بدانید.</p>
<ol><li>خدمت مورد نظر را انتخاب کنید.</li><li>اطلاعات پزشکان موجود را بخوانید و گزینهٔ مناسب را برگزینید.</li><li>محل ارائهٔ همان خدمت را مشخص کنید.</li><li>یکی از تاریخ‌ها و ساعت‌های آزاد فعلی را انتخاب کنید.</li><li>پیش از تأیید، خلاصهٔ نوبت و مبلغ نمایش‌داده‌شده را بررسی کنید.</li></ol>
<blockquote><p><strong>یک عادت مفید:</strong> اگر نتیجهٔ یک کار روشن نیست، پیش از تکرار آن وضعیت جاری را بخوانید. کلیک دوم نباید جای فهمیدن نتیجهٔ کلیک اول را بگیرد.</p></blockquote>
<p>این روش هنگام کند شدن اتصال هم مفید است. منتظر نتیجه بمانید، در صورت وجود از گزینهٔ تازه‌سازی یا بازیابی استفاده کنید و فهرست نوبت‌ها را ببینید. بستن یک زبانه لزوماً به معنی لغو نوبت نیست و باز کردن دوبارهٔ آن نیز به تنهایی تراکنش تازه‌ای ایجاد نمی‌کند.</p>
<h2>۳. مدارک را منظم و خصوصی نگه دارید</h2>
{{side}}
<p>مدرک شخصی باید در مسیر خصوصی و مرتبط با درخواست خودش قرار گیرد. تصویر یک مقاله با پیوست شخصی کاربرد متفاوتی دارد: تصویر به توضیح یک موضوع عمومی کمک می‌کند، اما پیوست ممکن است حاوی اطلاعات یک فرد مشخص باشد. فایل شخصی را وارد کتابخانهٔ عمومی محتوا نکنید و صرف شباهت ظاهری یک تصویر به نمونه، آن را مناسب اشتراک‌گذاری ندانید.</p>
<p>نام فایل را قابل تشخیص انتخاب کنید و بررسی کنید که همان مدرک مورد نظر را برداشته‌اید. نوع و اندازهٔ مجاز را از کنترل بارگذاری بخوانید. انتخاب شدن، بارگذاری شدن، بررسی شدن و در دسترس قرار گرفتن فایل، رویدادهای جداگانه هستند. وجود نام فایل به تنهایی نتیجهٔ نهایی بررسی را نشان نمی‌دهد.</p>
<h3>پیش از انتخاب فایل</h3>
<ul><li>نوبت درست و درخواست مرتبط با آن را باز کنید.</li><li>نوع مدرک و توضیحات درخواست را بخوانید.</li><li>فقط فایل متعلق به همان درخواست را انتخاب کنید.<ul><li>صفحه‌های نامرتبط یا اطلاعات فرد دیگر را اضافه نکنید.</li><li>خوانا بودن مدرک را پیش از ارسال بررسی کنید.</li></ul></li><li>پیش از فرض کردن آماده بودن فایل، منتظر نتیجهٔ پردازش بمانید.</li></ul>
<p>اگر فایل در دسترس قرار نگرفت، از وضعیت و گزینه‌های بازیابی خود برنامه کمک بگیرید. تغییر نام، محتوای فایل را تغییر نمی‌دهد و بارگذاری‌های پیاپی راه مطمئنی برای رفع یک نتیجهٔ نامشخص نیست. نسخهٔ اصلی را نگه دارید و در صورت نیاز از مسیر مناسب پشتیبانی یا مراقبت توضیح بخواهید.</p>
<h2>۴. متن را همراه تصویر بخوانید</h2>
<p>تصویر می‌تواند نگاه را به بخش مهمی از یک فرایند جلب کند، اما توضیح اطراف آن زمینه را روشن می‌کند. در این نمونه، تصویر عریض ایده را معرفی می‌کند، تصویر کناری کنار توضیح قرار می‌گیرد و تصویر درون‌خطی با متن یک بند همراه می‌شود. زیرنویس‌ها روشن می‌کنند که هر تصویر چه چیزی را نشان می‌دهد؛ تصویر ساختگی به عنوان پروندهٔ واقعی بیمار معرفی نمی‌شود.</p>
{{inline}}
<p>متن جایگزین و زیرنویس وظیفه‌های متفاوتی دارند. متن جایگزین زمانی به توصیف تصویر کمک می‌کند که خود تصویر دیده نمی‌شود؛ زیرنویس، توضیحی قابل مشاهده برای همهٔ خوانندگان است. هیچ‌کدام نباید اطلاعات شخصی را از یک مدرک خصوصی بازگو کند.</p>
{{captioned}}
<h3>قالب‌بندی باید پیدا کردن مفهوم را آسان کند</h3>
<p><strong>نوشتهٔ پررنگ</strong> نکتهٔ کلیدی را برجسته می‌کند. <em>نوشتهٔ کج</em> می‌تواند یک یادآوری را از توضیح اطراف جدا کند. <u>نوشتهٔ زیرخط‌دار</u> در این نمونه کم استفاده شده تا با پیوند اشتباه نشود. تیترها مقالهٔ بلند را بخش‌بندی می‌کنند؛ فهرست شماره‌دار ترتیب کار و فهرست ساده نکته‌های مرتبط را نشان می‌دهد.</p>
<p>برچسب پیوند باید معنی‌دار باشد. برای نمونه، <a href="https://www.w3.org/WAI/" title="Web Accessibility Initiative">ابتکار دسترس‌پذیری وب</a> با نام مشخص معرفی شده است. وجود پیوند در یک مقاله به معنی اجازهٔ فرستادن مدارک به سایتی دیگر یا تماس خودکار برنامه با آن سایت نیست.</p>
<h2>۵. به سابقهٔ همان نوبت برگردید</h2>
<p>پس از مراجعه، نوبتی را باز کنید که واقعاً انجام شده است. وضعیت جاری را بخوانید و فقط نتیجه‌هایی را مشاهده کنید که از مسیر همان نوبت در دسترس هستند. پرسش‌نامهٔ ذخیره‌شده، پیوست خصوصی و گزارش منتشرشده انواع متفاوتی از اطلاعات‌اند و باید در زمینهٔ مربوط به خود خوانده شوند.</p>
<h4>هنگام بازگشت به یک صفحه</h4>
<p>اگر صفحه درخواست می‌کند، آن را تازه کنید؛ حسابی را که با آن وارد شده‌اید بررسی کنید و مطمئن شوید نوبت درست را می‌بینید. روی دستگاه مشترک پس از پایان کار خارج شوید. باز بودن قبلی یک صفحه در مرورگر، به معنی مجاز بودن دسترسی فرد بعدی نیست.</p>
<blockquote><p>قدم بعدی را ساده نگه دارید: سابقهٔ درست را پیدا کنید، وضعیت فعلی آن را بخوانید و از عملی استفاده کنید که به همان وضعیت مربوط است.</p></blockquote>
<h2>یک فهرست کوتاه برای مرور</h2>
<ol><li>خدمت، پزشک، محل و زمان را بررسی کنید.</li><li>خلاصه را پیش از تأیید رزرو بخوانید.</li><li>مدارک شخصی را از مسیر درخواست خصوصی ارسال کنید.</li><li>به جای حدس زدن، نتیجهٔ پردازش را ببینید.</li><li>نتیجهٔ منتشرشده را از نوبت مرتبط باز کنید.</li><li>روی دستگاه مشترک از حساب خارج شوید.</li></ol>
<p>این راهنما نمونه‌ای از تجربهٔ خواندن و قالب‌بندی‌های پشتیبانی‌شده است. پیشنهادهای کنار آن، مطالب عمومی منتشرشده هستند؛ توصیهٔ پزشکی شخصی، تشخیص یا ارزیابی اطلاعات سلامت شما نیستند.</p>
HTML;
        $result = [];
        foreach (['en' => $en, 'fa' => $fa] as $language => $body) {
            $parts = ['wide' => '', 'side' => '', 'inline' => '', 'captioned' => ''];
            if (count($images) === 3) {
                $captions = $language === 'en'
                    ? ['A clear overview before choosing the next step.', 'Keep personal documents in their private workflow.', 'A small inline illustration beside its explanation.', 'An illustration with a visible caption and alternative text.']
                    : ['پیش از انتخاب قدم بعدی، تصویر کلی را ببینید.', 'مدارک شخصی را در مسیر خصوصی خود نگه دارید.', 'تصویر کوچک درون متن و کنار توضیح آن.', 'نمونهٔ تصویر با زیرنویس قابل مشاهده و متن جایگزین.'];
                $figure = static fn (int $index, string $caption, string $style = ''): string => '<figure class="image'.$style.'"><img src="'.$images[$index]['content_path'].'" alt="'.$caption.'"><figcaption>'.$caption.'</figcaption></figure>';
                $parts['wide'] = $figure(0, $captions[0]);
                $parts['side'] = $figure(1, $captions[1], ' image-style-side');
                $parts['inline'] = '<p><img src="'.$images[2]['content_path'].'" alt="'.$captions[2].'"> <em>'.$captions[2].'</em></p>';
                $parts['captioned'] = $figure(2, $captions[3]);
            }
            foreach ($parts as $name => $html) {
                $body = str_replace('{{'.$name.'}}', $html, $body);
            }
            $title = $language === 'en' ? 'Your first visit: a complete guide to Checkupino' : 'اولین مراجعهٔ شما: راهنمای کامل چکاپینو';
            $result[$language] = ['title' => $title, 'summary' => $language === 'en'
                ? 'A complete illustrated walkthrough of appointments, private documents and finding your published outcomes.'
                : 'راهنمای تصویری و کامل نوبت‌ها، مدارک خصوصی و پیدا کردن نتیجه‌های منتشرشده.',
                'body_html' => $body, 'seo' => ['title' => $title, 'description' => $language === 'en'
                    ? 'Explore a full-length synthetic guide with readable typography, images and practical panel examples.'
                    : 'راهنمای کامل و ساختگی با متن خوانا، تصویر و مثال‌های کاربردی پنل.']];
        }

        return $result;
    }
}
