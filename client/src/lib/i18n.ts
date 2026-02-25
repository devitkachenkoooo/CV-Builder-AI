import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    en: {
        translation: {
            "nav": {
                "templates": "Templates",
                "my_resumes": "My Resumes",
                "logout": "Log out"
            },
            "landing": {
                "badge": "AI-Powered CV Builder",
                "title_part1": "Your next job starts with a ",
                "title_accent": "perfect CV.",
                "description": "Stop struggling with formatting. Just upload your .docx file and let our AI instantly generate a beautifully structured, professional PDF resume.",
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
                "refresh": "Refresh page",
                "back_to_gallery": "Back to Gallery"
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
                "processing": "Processing..."
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
                "logout": "Вийти"
            },
            "landing": {
                "badge": "Конструктор резюме на базі ШІ",
                "title_part1": "Ваша наступна робота починається з ",
                "title_accent": "ідеального резюме.",
                "description": "Забудьте про проблеми з форматуванням. Просто завантажте ваш .docx файл, і наш ШІ миттєво створить красиво структуроване професійне PDF-резюме.",
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
                "refresh": "Спробуйте оновити сторінку.",
                "back_to_gallery": "Назад до шаблонів"
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
                "delete_title": "Видалити CV?",
                "delete_desc": "Ви впевнені, що хочете видалити це CV? Цю дію неможливо скасувати.",
                "delete_btn": "Видалити",
                "ai_working": "ШІ працює...",
                "preparing_format": "Підготовка магічного форматування...",
                "gen_error": "Помилка генерації",
                "gen_error_desc": "Щось пішло не так під час обробки.",
                "ready": "Готово до перегляду",
                "click_to_view": "Натисніть для перегляду CV",
                "processing": "Обробка..."
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
