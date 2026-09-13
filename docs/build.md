# Build & Deploy — ساخت و انتشار

## پیش‌نیازها

- Node.js ≥ 20 یا [Bun](https://bun.sh) ≥ 1.1
- (اختیاری برای بازتولید تصاویر) CLI ابزار تصویرساز

## اجرای محلی (Development)

```bash
bun install          # نصب وابستگی‌ها
bun run dev          # http://localhost:3000
bun run lint         # ESLint
bunx tsc --noEmit    # بررسی تایپ‌ها
```

## Build نسخه Production

```bash
bun run build        # Next.js standalone build
bun run start        # اجرای سرور production روی پورت ۳۰۰۰
```

خروجی نهایی در `.next/standalone` + `public/` قرار می‌گیرد و روی هر هاست Node سازگار است.

## انتشار استاتیک (اختیاری)

چون بازی کاملاً سمت کلاینت است، می‌توانید `next build` را روی Vercel/Netlify دیپلوی کنید یا با یک اداپتور استاتیک خروجی بگیرید.

## خروجی موبایل بومی (Capacitor)

```bash
bun add -d @capacitor/cli
bunx cap init "Safar-e Vazhe" com.example.vazhesafar --web-dir=public
bun run build
bunx cap add android   # یا ios
bunx cap open android
```

## تست‌ها

```bash
bun scripts/validate_words.ts   # سلامت داده ۱۰۰ مرحله (واژه‌ها + چیدمان)
```

تست دستی مرورگر (چک‌لیست):

- [ ] اسپلش → منو → فصل‌ها → مراحل → گیم‌پلی
- [ ] کشیدن حروف روی چرخ (تاچ و موس) و ساخت واژه درست/غلط/پنهان
- [ ] تکمیل مرحله: ستاره، سکه، «مرحله بعد»
- [ ] پایان فصل: سینما + صندوقچه + گشایش فصل بعد
- [ ] Pause / Restart / خروج
- [ ] تنظیمات: موسیقی/صدا/لرزش + بازنشانی
- [ ] پیشرفت و جوایز (هدیه روزانه، صندوقچه‌ها)
- [ ] ری‌لود صفحه → ادامه سفر از آخرین مرحله (ذخیره‌سازی)
- [ ] نمای موبایل (≤480px) و دسکتاپ
- [ ] بدون خطای Console
