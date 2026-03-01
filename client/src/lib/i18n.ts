import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    en: {
        translation: {
            "nav": {
                "templates": "Templates",
                "my_resumes": "My Resumes",
                "logout": "Log out",
                "plan_pro": "Pro Plan",
                "profile_alt": "Profile",
                "toggle_menu": "Toggle menu"
            },
            "landing": {
                "badge": "AI-Powered CV Builder",
                "title_part1": "Your next job starts with a ",
                "title_accent": "perfect CV.",
                "description": "Stop struggling with formatting. Just upload your .docx file and let our AI instantly generate a beautifully structured, professional PDF resume.",
                "template_alt": "CV Template",
                "ai_formatting": "AI Formatting...",
                "features": {
                    "templates": "10+ Premium ATS-friendly templates",
                    "extraction": "Intelligent content extraction and formatting",
                    "generation": "Instant high-quality PDF generation"
                },
                "get_started": "Get Started for Free",
                "secure_login": "Secure login with Replit Auth",
                "how_it_works": {
                    "title": "How it works",
                    "step1_title": "Upload your .docx",
                    "step1_desc": "Select a ready-made file from your device.",
                    "step2_title": "Beautify Magic",
                    "step2_desc": "AI analyzes the content and instantly applies professional design.",
                    "step3_title": "PDF in seconds",
                    "step3_desc": "Get a finished high-quality resume."
                }
            },
            "common": {
                "loading": "Loading...",
                "authenticating": "Authenticating...",
                "cancel": "Cancel",
                "delete": "Delete",
                "deleting": "Deleting...",
                "language": "Language",
                "back": "Back",
                "close": "Close",
                "send": "Send",
                "sending": "Sending...",
                "refresh": "Refresh page",
                "back_to_gallery": "Back to Gallery",
                "template": "Template"
            },
            "errors": {
                "validation_failed": "Validation failed",
                "generate_start_failed": "Failed to start CV generation",
                "fetch_job_status_failed": "Failed to fetch job status",
                "resume_not_found": "Resume not found",
                "delete_resume_failed": "Failed to delete resume"
            },
            "file_validation": {
                "size_max": "File size must be less than 5MB",
                "docx_only": "Only .docx files are allowed",
                "invalid_format": "Invalid file format",
                "docx_extension": "File must have .docx extension",
                "failed": "File validation failed",
                "units": {
                    "bytes": "Bytes",
                    "kb": "KB",
                    "mb": "MB",
                    "gb": "GB"
                }
            },
            "not_found": {
                "title": "404 Page Not Found",
                "description": "Did you forget to add the page to the router?"
            },
            "delete_dialog": {
                "title": "Delete {{itemName}}?",
                "description": "This action cannot be undone. This will permanently delete your {{itemName}} and remove all associated data from our servers."
            },
            "modal": {
                "selected_template": "Selected Template",
                "import_content": "Import Content",
                "description": "Upload your CV in .docx format. Our AI will automatically extract and format it beautifully into your chosen template.",
                "description_mobile": "Upload your .docx file. AI will format it beautifully.",
                "upload_label": "Upload CV Document",
                "upload_hint": "Upload your CV in .docx format. Maximum file size: 5MB.",
                "upload_hint_mobile": ".docx format, max 5MB",
                "ai_processing": "File will be processed and formatted by our AI.",
                "ai_processing_mobile": "AI will process your file",
                "btn_processing": "Processing File...",
                "btn_magic": "Starting Magic...",
                "btn_generate": "Generate Beautiful CV",
                "btn_generate_mobile": "Generate CV",
                "error_file_required": "File Required",
                "error_file_desc": "Please select a .docx file to upload.",
                "error_no_template": "No template selected",
                "error_no_template_desc": "Please select a template to generate your CV."
            },
            "cv_view": {
                "title": "CV Viewer",
                "professional_cv": "Professional CV",
                "loading": "Loading your CV...",
                "back_to_my_cvs": "Back to my CVs",
                "edit_with_ai": "Edit with AI",
                "generating": "Generating...",
                "download_pdf": "Download PDF",
                "a4_format": "A4 Format (210 x 297 mm)",
                "processing_title": "AI is updating your CV",
                "please_wait": "Please wait...",
                "failed_title": "CV update failed",
                "failed_desc": "Could not finish AI update. Try again with a different prompt.",
                "iframe_title": "Generated CV HTML",
                "unavailable_title": "CV is unavailable",
                "unavailable_desc": "Generated CV HTML is not available right now.",
                "status": {
                    "processing": "Processing",
                    "failed": "Failed",
                    "completed": "Completed"
                },
                "cards": {
                    "format_title": "Format",
                    "format_desc": "Standard A4, print-ready layout.",
                    "status_title": "Status",
                    "updated_title": "Updated"
                },
                "progress": {
                    "ai_editing": "AI is editing your CV..."
                },
                "errors": {
                    "not_found": "CV not found",
                    "load_failed": "Failed to load CV",
                    "ai_edit_start_failed": "Failed to start AI edit",
                    "rate_limit_exceeded": "Rate limit exceeded",
                    "ai_edit_rejected": "AI edit rejected"
                },
                "toasts": {
                    "ai_edit_failed_fallback": "AI edit failed. Please try again.",
                    "ai_edit_failed_title": "AI edit failed",
                    "ai_edit_failed_desc": "Could not send request. Please try again.",
                    "ai_edit_failed_title_alt": "AI editing failed",
                    "download_failed_title": "Download failed",
                    "download_failed_desc": "CV file is not ready yet.",
                    "pdf_generated_title": "PDF generated",
                    "pdf_generated_desc": "Your CV has been downloaded successfully.",
                    "pdf_generation_failed_title": "PDF generation failed",
                    "pdf_generation_failed_desc": "Could not generate PDF. Please try again.",
                    "prompt_too_short_title": "Prompt is too short",
                    "prompt_too_short_desc": "Please enter at least {{min}} characters.",
                    "prompt_too_long_title": "Prompt is too long",
                    "prompt_too_long_desc": "Please keep it under {{max}} characters.",
                    "ai_edit_started_title": "AI edit started",
                    "ai_edit_started_desc": "Your CV is being updated. Please wait..."
                },
                "ai_panel": {
                    "title": "Edit CV with AI",
                    "description": "Keep this panel open while scrolling the document and describe what should be changed.",
                    "close_aria": "Close AI edit panel",
                    "placeholder": "Example: Rewrite the summary into 2 concise sentences and highlight React + TypeScript achievements.",
                    "hint": "The request should be specific and factual to get visible changes."
                }
            },
            "toast": {
                "gen_started_title": "Generation Started! 🎉",
                "gen_started_desc": "Your CV is being generated. You'll be redirected to your resumes.",
                "gen_failed_title": "Generation Failed",
                "gen_failed_fallback": "Failed to generate CV. Please try again.",
                "cv_deleted_title": "CV Deleted",
                "cv_deleted_desc": "CV successfully removed from your list",
                "delete_failed_title": "Delete Failed",
                "delete_failed_desc": "Failed to delete CV. Please try again"
            },
            "cv_card": {
                "delete_title": "Delete CV?",
                "delete_desc": "Are you sure you want to delete this CV? This action cannot be undone.",
                "delete_btn": "Delete CV",
                "ai_working": "AI is working...",
                "preparing_format": "Preparing magical formatting...",
                "gen_error": "Generation Error",
                "gen_error_desc": "Something went wrong during processing.",
                "ready": "Ready to view",
                "click_to_view": "Click to view CV",
                "processing": "Processing...",
                "iframe_title": "Generated CV HTML Preview"
            },
            "gallery": {
                "title": "Choose a Template",
                "description": "Select a professional design to get started. Our AI will automatically adapt your content perfectly to the layout.",
                "loading": "Loading templates...",
                "error": "Failed to load templates.",
                "use_template": "Use Template"
            },
            "my_resumes": {
                "title": "My Resumes",
                "description": "Manage and download your generated CVs",
                "loading": "Loading your resumes...",
                "error": "Failed to load resumes",
                "error_desc": "Please ensure you are logged in and try again.",
                "empty_title": "No resumes yet",
                "empty_desc": "You haven't generated any CVs yet. Head over to the gallery to pick a template and create your first one!",
                "browse_templates": "Browse Templates"
            }
        }
    },
    ua: {
        translation: {
            "nav": {
                "templates": "Шаблони",
                "my_resumes": "Мої резюме",
                "logout": "Вийти",
                "plan_pro": "Pro Plan",
                "profile_alt": "Профіль",
                "toggle_menu": "Відкрити меню"
            },
            "landing": {
                "badge": "Конструктор резюме на базі ШІ",
                "title_part1": "Ваша наступна робота починається з ",
                "title_accent": "ідеального резюме.",
                "description": "Забудьте про проблеми з форматуванням. Просто завантажте ваш .docx файл, і наш ШІ миттєво створить красиво структуроване професійне PDF-резюме.",
                "template_alt": "Шаблон резюме",
                "ai_formatting": "Форматування ШІ...",
                "features": {
                    "templates": "10+ преміальних шаблонів, дружніх до ATS",
                    "extraction": "Інтелектуальне вилучення та форматування вмісту",
                    "generation": "Миттєва генерація високоякісного PDF"
                },
                "get_started": "Почати безкоштовно",
                "secure_login": "Безпечний вхід через Replit Auth",
                "how_it_works": {
                    "title": "Як це працює",
                    "step1_title": "Завантажте ваш .docx",
                    "step1_desc": "Оберіть готовий файл зі свого пристрою.",
                    "step2_title": "Магія Beautify",
                    "step2_desc": "ШІ аналізує зміст та миттєво застосовує професійний дизайн.",
                    "step3_title": "PDF за секунди",
                    "step3_desc": "Отримайте готове резюме високої якості."
                }
            },
            "common": {
                "loading": "Завантаження...",
                "authenticating": "Автентифікація...",
                "cancel": "Скасувати",
                "delete": "Видалити",
                "deleting": "Видалення...",
                "language": "Мова",
                "back": "Назад",
                "close": "Закрити",
                "send": "Надіслати",
                "sending": "Надсилаємо...",
                "refresh": "Спробуйте оновити сторінку.",
                "back_to_gallery": "Назад до шаблонів",
                "template": "Шаблон"
            },
            "errors": {
                "validation_failed": "Помилка валідації",
                "generate_start_failed": "Не вдалося запустити генерацію резюме",
                "fetch_job_status_failed": "Не вдалося отримати статус генерації",
                "resume_not_found": "Резюме не знайдено",
                "delete_resume_failed": "Не вдалося видалити резюме"
            },
            "file_validation": {
                "size_max": "Розмір файлу має бути меншим за 5 МБ",
                "docx_only": "Дозволені лише файли .docx",
                "invalid_format": "Некоректний формат файлу",
                "docx_extension": "Файл має мати розширення .docx",
                "failed": "Не вдалося перевірити файл",
                "units": {
                    "bytes": "Б",
                    "kb": "КБ",
                    "mb": "МБ",
                    "gb": "ГБ"
                }
            },
            "not_found": {
                "title": "404 Сторінку не знайдено",
                "description": "Ви не додали сторінку в роутер?"
            },
            "delete_dialog": {
                "title": "Видалити {{itemName}}?",
                "description": "Цю дію неможливо скасувати. Це назавжди видалить ваш {{itemName}} та всі пов'язані дані з наших серверів."
            },
            "cv_view": {
                "title": "Перегляд резюме",
                "professional_cv": "Професійне резюме",
                "loading": "Завантажуємо ваше резюме...",
                "back_to_my_cvs": "Назад до моїх резюме",
                "edit_with_ai": "Редагувати з ШІ",
                "generating": "Генеруємо...",
                "download_pdf": "Завантажити PDF",
                "a4_format": "Формат A4 (210 x 297 мм)",
                "processing_title": "ШІ оновлює ваше резюме",
                "please_wait": "Будь ласка, зачекайте...",
                "failed_title": "Не вдалося оновити резюме",
                "failed_desc": "Не вдалося завершити оновлення ШІ. Спробуйте інший запит.",
                "iframe_title": "Згенерований HTML резюме",
                "unavailable_title": "Резюме недоступне",
                "unavailable_desc": "Згенерований HTML резюме наразі недоступний.",
                "status": {
                    "processing": "Обробка",
                    "failed": "Помилка",
                    "completed": "Готово"
                },
                "cards": {
                    "format_title": "Формат",
                    "format_desc": "Стандарт A4, готовий до друку макет.",
                    "status_title": "Статус",
                    "updated_title": "Оновлено"
                },
                "progress": {
                    "ai_editing": "ШІ редагує ваше резюме..."
                },
                "errors": {
                    "not_found": "Резюме не знайдено",
                    "load_failed": "Не вдалося завантажити резюме",
                    "ai_edit_start_failed": "Не вдалося запустити редагування ШІ",
                    "rate_limit_exceeded": "Перевищено ліміт запитів",
                    "ai_edit_rejected": "Редагування ШІ відхилено"
                },
                "toasts": {
                    "ai_edit_failed_fallback": "Не вдалося відредагувати. Спробуйте ще раз.",
                    "ai_edit_failed_title": "Помилка редагування ШІ",
                    "ai_edit_failed_desc": "Не вдалося надіслати запит. Спробуйте ще раз.",
                    "download_failed_title": "Помилка завантаження",
                    "download_failed_desc": "Файл резюме ще не готовий.",
                    "pdf_generated_title": "PDF згенеровано",
                    "pdf_generated_desc": "Ваше резюме успішно завантажено.",
                    "pdf_generation_failed_title": "Не вдалося згенерувати PDF",
                    "pdf_generation_failed_desc": "Не вдалося згенерувати PDF. Спробуйте ще раз.",
                    "prompt_too_short_title": "Запит надто короткий",
                    "prompt_too_short_desc": "Введіть щонайменше {{min}} символів.",
                    "prompt_too_long_title": "Запит надто довгий",
                    "prompt_too_long_desc": "Скоротіть до {{max}} символів або менше.",
                    "ai_edit_started_title": "Редагування ШІ запущено",
                    "ai_edit_started_desc": "Резюме оновлюється. Будь ласка, зачекайте..."
                },
                "ai_panel": {
                    "title": "Редагувати резюме з ШІ",
                    "description": "Тримайте панель відкритою, прокручуйте документ і опишіть, що потрібно змінити.",
                    "close_aria": "Закрити панель редагування ШІ",
                    "placeholder": "Приклад: Перепиши summary у 2 короткі речення та підкресли досягнення в React + TypeScript.",
                    "hint": "Запит має бути конкретним і фактичним, щоб зміни були помітні."
                }
            },
            "modal": {
                "selected_template": "Обраний шаблон",
                "import_content": "Імпорт вмісту",
                "description": "Завантажте ваше резюме у форматі .docx. Наш ШІ автоматично витягне та красиво оформить його у вибраний вами шаблон.",
                "description_mobile": "Завантажте ваш .docx файл. ШІ оформить його красиво.",
                "upload_label": "Завантажити документ резюме",
                "upload_hint": "Завантажте резюме у форматі .docx. Максимальний розмір файлу: 5 МБ.",
                "upload_hint_mobile": "формат .docx, макс. 5 МБ",
                "ai_processing": "Файл буде оброблений та відформатований нашим ШІ.",
                "ai_processing_mobile": "ШІ обробить ваш файл",
                "btn_processing": "Обробка файлу...",
                "btn_magic": "Починаємо магію...",
                "btn_generate": "Згенерувати красиве резюме",
                "btn_generate_mobile": "Згенерувати резюме",
                "error_file_required": "Потрібен файл",
                "error_file_desc": "Будь ласка, виберіть файл .docx для завантаження.",
                "error_no_template": "Шаблон не вибрано",
                "error_no_template_desc": "Будь ласка, виберіть шаблон для створення вашого резюме."
            },
            "toast": {
                "gen_started_title": "Генерацію розпочато! 🎉",
                "gen_started_desc": "Ваше резюме створюється. Вас буде перенаправлено до списку резюме.",
                "gen_failed_title": "Помилка генерації",
                "gen_failed_fallback": "Не вдалося згенерувати резюме. Будь ласка, спробуйте ще раз.",
                "cv_deleted_title": "CV видалено",
                "cv_deleted_desc": "CV успішно видалено з вашого списку",
                "delete_failed_title": "Помилка видалення",
                "delete_failed_desc": "Не вдалося видалити CV. Спробуйте ще раз"
            },
            "cv_card": {
                "delete_title": "Видалити резюме?",
                "delete_desc": "Ви впевнені, що хочете видалити це резюме? Цю дію неможливо скасувати.",
                "delete_btn": "Видалити резюме",
                "ai_working": "ШІ працює...",
                "preparing_format": "Підготовка магічного форматування...",
                "gen_error": "Помилка генерації",
                "gen_error_desc": "Щось пішло не так під час обробки.",
                "ready": "Готово до перегляду",
                "click_to_view": "Натисніть, щоб переглянути",
                "processing": "Обробка...",
                "iframe_title": "Попередній перегляд HTML резюме"
            },
            "gallery": {
                "title": "Оберіть шаблон",
                "description": "Оберіть професійний дизайн, щоб почати. Наш ШІ автоматично адаптує ваш вміст до макету.",
                "loading": "Завантаження шаблонів...",
                "error": "Не вдалося завантажити шаблони.",
                "use_template": "Вибрати шаблон"
            },
            "my_resumes": {
                "title": "Мої резюме",
                "description": "Керуйте та завантажуйте ваші згенеровані резюме",
                "loading": "Завантаження ваших резюме...",
                "error": "Не вдалося завантажити резюме",
                "error_desc": "Будь ласка, переконайтеся, що ви увійшли, і спробуйте ще раз.",
                "empty_title": "Резюме ще немає",
                "empty_desc": "Ви ще не створили жодного резюме. Перейдіть до галереї, щоб обрати шаблон і створити своє перше резюме!",
                "browse_templates": "Переглянути шаблони"
            }
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage']
        }
    });

export default i18n;
