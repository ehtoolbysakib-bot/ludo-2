# 🚀 Render.com-এ Ludo King ডিপ্লয়মেন্ট গাইড

এই ডকুমেন্টেশনটি আপনাকে **Render.com**-এ সম্পূর্ণ Ludo King প্রোজেক্ট (Frontend + API Server + WebSocket) ডিপ্লয় করতে সাহায্য করবে।

---

## 📋 প্রোজেক্ট আর্কিটেকচার

```
ludo-king/
├── artifacts/
│   ├── api-server/        ← Express API + WebSocket সার্ভার (port 10000)
│   └── ludo-game/         ← React + Vite ফ্রন্টএন্ড
├── lib/
│   ├── api-client-react/  ← API ক্লায়েন্ট
│   ├── api-spec/          ← OpenAPI স্পেসিফিকেশন
│   ├── api-zod/           ← Zod ভ্যালিডেশন স্কিমা
│   └── db/                ← Drizzle ORM + SQLite ডাটাবেস
├── data/                  ← SQLite ডাটাবেস ফাইল লোকেশন
├── render.yaml            ← Render ব্লুপ্রিন্ট (অটোমেটিক কনফিগ)
└── render.md              ← এই ফাইল
```

Render-এ পুরো প্রোজেক্ট **একটি Web Service** হিসেবে চলে — বিল্ডের সময় ফ্রন্টএন্ড বিল্ড হয়, এবং API সার্ভার প্রোডাকশনে সেই বিল্ড ফাইলগুলো সার্ভ করে। WebSocket একই সার্ভারে `/ws` পাথে চলে।

---

## 🎯 ধাপ ১: Render.com-এ অ্যাকাউন্ট তৈরি

1. https://render.com এ যান
2. **Sign Up** বাটনে ক্লিক করুন (GitHub দিয়ে সাইনআপ করলে সুবিধা)
3. GitHub, GitLab, বা Bitbucket রিপোজিটরি সংযুক্ত করুন

---

## 🎯 ধাপ ২: Blueprint ডিপ্লয় (সহজ পদ্ধতি)

Render Blueprint (`render.yaml`) ফাইলটি সব কনফিগারেশন আগেই ডিফাইন করে রাখে।

1. Render Dashboard-এ **New +** → **Blueprint** সিলেক্ট করুন
2. আপনার GitHub রিপোজিটরি সিলেক্ট করুন
3. Render অটোমেটিকভাবে `render.yaml` পড়ে সার্ভিস তৈরি করবে
4. **Apply** বাটনে ক্লিক করুন

Blueprints → https://dashboard.render.com/blueprints

---

## 🎯 ধাপ ৩: ম্যানুয়াল ডিপ্লয় (বিকল্প পদ্ধতি)

Blueprint কাজ না করলে নিচের steps অনুসরণ করুন:

### Web Service তৈরি

1. Render Dashboard → **New +** → **Web Service**
2. আপনার Git রিপোজিটরি সিলেক্ট করুন
3. নিচের সেটিংস দিন:

| সেটিং | ভ্যালু |
|--------|--------|
| **Name** | `ludo-king` |
| **Region** | Singapore (বা আপনার নিকটবর্তী) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Root Directory** | *(খালি রাখুন — পুরো রিপোজিটরি)* |
| **Build Command** | `pnpm install --frozen-lockfile; pnpm run build` |
| **Start Command** | `node --enable-source-maps ./artifacts/api-server/dist/index.mjs` |
| **Plan** | Free (বা Starter+ যদি persistent disk চান) |

### Environment Variables সেট করুন

**Advanced** → **Environment Variables**-এ নিচের ভ্যারিয়েবলগুলো যোগ করুন:

| Key | Value | Required |
|-----|-------|----------|
| `NODE_ENV` | `production` | ✅ |
| `SESSION_SECRET` | (একটি র‍্যান্ডম স্ট্রিং — "Generate" বাটন ব্যবহার করুন) | ✅ |
| `PORT` | `10000` | ✅ |
| `SQLITE_DB_PATH` | `/var/data/ludo.db` | ✅ |
| `PNPM_VERSION` | `10` | ✅ |
| `NODE_VERSION` | `22` | ✅ |
| `BASE_PATH` | `/` | ✅ |

---

## 🎯 ধাপ ৪: Persistent Disk (SQLite-র জন্য)

**Free Plan:** Render-এর ফ্রি প্ল্যানে persistent disk নেই। SQLite ডাটা প্রতিবার সার্ভিস রিস্টার্ট বা ডিপ্লয়ের সময় **রিসেট** হয়ে যাবে। শুধু টেস্টিং বা ডেমোর জন্য ব্যবহার করুন।

**Starter Plan (থেকে $7/মাস):** Render-এ persistent disk যোগ করতে পারেন:

1. Render Dashboard → আপনার Web Service → **Settings** → **Disks**
2. **Add Disk** বাটনে ক্লিক করুন
3. নিচের তথ্য দিন:
   - **Name**: `data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (যথেষ্ট)
4. **Save** বাটনে ক্লিক করুন

Disk mount করার পর `SQLITE_DB_PATH` এনভায়রনমেন্ট ভ্যারিয়েবল `/var/data/ludo.db` সেট করা আছে কিনা নিশ্চিত করুন।

---

## 🎯 ধাপ ৫: ডিপ্লয় সম্পন্ন

- ডিপ্লয় শুরু হলে Render Dashboard-এ লোগ দেখা যাবে
- প্রথম ডিপ্লয়ে ২-৫ মিনিট সময় লাগতে পারে
- ডিপ্লয়成功后 আপনার অ্যাপ URL পাবেন: `https://ludo-king.onrender.com`
- প্রতিটি Git push-এ অটোমেটিক ডিপ্লয় হবে

---

## 🔧 প্রজেক্ট লোকালি চালানো

```bash
# ডিপেন্ডেন্সি ইন্সটল
pnpm install

# ডাটাবেস পুশ
pnpm --filter @workspace/db run push

# API সার্ভার চালু (টার্মিনাল ১)
pnpm --filter @workspace/api-server run dev

# ফ্রন্টএন্ড চালু (টার্মিনাল ২)
pnpm --filter @workspace/ludo-game run dev
```

---

## ⚙️ Environment Variables রেফারেন্স

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | সার্ভার পোর্ট (Render নিজে সেট করে) | ❌ (default: `10000`) |
| `NODE_ENV` | `production` বা `development` | ❌ |
| `SESSION_SECRET` | সেশন এনক্রিপশন সিক্রেট | ✅ |
| `SQLITE_DB_PATH` | SQLite ডাটাবেস ফাইল লোকেশন | ❌ (default: `./data/ludo.db`) |
| `BASE_PATH` | Vite base path | ❌ (default: `/`) |
| `PNPM_VERSION` | pnpm ভার্সন | ❌ (default: latest) |
| `NODE_VERSION` | Node.js ভার্সন | ❌ (default: Render's default) |

---

## 🧪 হেলথ চেক

ডিপ্লয় সফল হলে হেলথ চেক এন্ডপয়েন্ট:
```
GET /api/healthz
```

আপনার Render URL-এ গিয়ে চেক করুন:
```
https://ludo-king.onrender.com/api/healthz
```

---

## ⚠️ জরুরী নোটিশ

1. **SQLite Persistent Disk:** Render-এর ফ্রি প্ল্যানে ডাটা সংরক্ষিত থাকে না। প্রোডাকশনের জন্য **Starter+ প্ল্যান** বা বাহ্যিক ডাটাবেস (যেমন Turso/Supabase) ব্যবহার করুন।
2. **Free Tier Spin-down:** Render Free Tier ১৫ মিনিট inactivity-র পর সার্ভিস বন্ধ করে দেয়। প্রথম রিকোয়েস্টে ৩০-৬০ সেকেন্ড সময় লাগতে পারে (cold start)।
3. **WebSocket:** ফ্রি টায়ারে WebSocket সংযোগ কিছুক্ষণ পর বন্ধ হয়ে যেতে পারে। রিকানেক্ট লজিক ফ্রন্টএন্ডে ইতিমধ্যেই অন্তর্ভুক্ত আছে।
4. **Secret Key:** `SESSION_SECRET` সবসময় জেনারেট করা মান ব্যবহার করুন, ডিফল্ট রাখবেন না।

---

## 📞 সহায়তা

- Render ডকুমেন্টেশন: https://render.com/docs
- Render Blueprint: https://render.com/docs/blueprint-spec
- Render Monorepo Support: https://render.com/docs/monorepo-support
- Render Disk: https://render.com/docs/disks
