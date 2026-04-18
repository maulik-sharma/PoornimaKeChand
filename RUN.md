# 🚀 Running the AI Tutor Platform

Follow these steps to set up and run the AI Tutor platform on your local machine.

---

## 📋 Prerequisites

Ensure you have the following installed:
- **Node.js 18+**
- **npm** or **yarn**
- **PostgreSQL Database** (e.g., [Supabase](https://supabase.com))
- **Redis Instance** (e.g., [Upstash](https://upstash.com))

---

## 🛠️ Step 1: Installation

Clone the repository and install dependencies:

```bash
cd ai-tutor
npm install
```

---

## 🔑 Step 2: Environment Variables

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
```

Edit the `.env` file and provide values for:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `UPSTASH_REDIS_REST_URL` & `TOKEN`: For caching.
- `ANTHROPIC_API_KEY`: For Claude 3.5 Sonnet.
- `GOOGLE_GENERATIVE_AI_API_KEY`: For Gemini 1.5 Flash (fallback).

---

## 🗄️ Step 3: Database Setup

Initialize the database schema and seed sample data:

```bash
# Generate the Prisma client
npm run db:generate

# Push the schema to your database (creates tables)
npm run db:push

# Seed the database with sample students and teachers
npm run db:seed
```

---

## 🏃 Step 4: Run the Application

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to start the onboarding flow.

---

## 🧪 Step 5: Testing

To run the unit tests for the IRT engine and SR scheduler:

```bash
npm run test:unit
```

---

## 📝 Common Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server |
| `npm run build` | Creates a production build |
| `npm run lint` | Checks for linting errors |
| `npm run test:coverage` | Runs tests and generates a coverage report |
| `npx prisma studio`| Opens a GUI to view your database data |

---

> [!TIP]
> **Mobile Testing**: Since this is a PWA-ready app, you can use tools like `ngrok` to test the onboarding and learning flow on your mobile device for the best experience.
