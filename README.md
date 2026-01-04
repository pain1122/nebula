# 🩺 Checkupino  
### Full-Stack Medical Checkup & Online Consultation Platform  
Built with **Laravel 11**

---

## 🎯 What is Checkupino?
**Checkupino** is a comprehensive online medical platform designed to simplify health checkups and doctor consultations.

It enables patients to:
- Explore structured medical checkups
- Book online consultations with doctors
- Upload lab results and medical documents
- Receive professional reports, prescriptions, and follow-ups
- Communicate with doctors via chat (and future video calls)

At the same time, it empowers doctors and admins with dedicated panels to manage medical workflows efficiently.

---

## 👥 User Roles
| Role | Capabilities |
|----|----|
| **Visitor** | Browse checkups, read medical blog posts |
| **Patient** | Book checkups, upload results, chat with doctors |
| **Doctor** | Manage patients, write reports & prescriptions, publish articles |
| **Admin** | Full system control (users, content, SEO, analytics) |

---

## 🏗️ Core Architecture

### 1️⃣ Frontend (Patient Website)
- Home, About, Checkup Categories, Blog, Contact
- Booking flow:
  > Select checkup → Choose doctor → Pick date/time → Payment → Confirmation
- Patient dashboard:
  - Appointments
  - Uploaded results
  - Reports & prescriptions
  - Doctor chat
  - Saved articles

### 2️⃣ Admin CMS (Custom-Built)
_No third-party admin panels like Nova or Voyager_

- Manage doctors, users, and checkups
- Control categories, banners, pages, FAQs
- Blog & SEO management
- Analytics dashboard (appointments, revenue, activity logs)

### 3️⃣ Doctor Panel
- Patient list & schedule
- Upload reports and prescriptions
- Write blog posts
- Respond to patient chats
- Performance analytics

---

## 🧩 Main Database Models
- User (patients, doctors, admins – role-based)
- DoctorProfile
- UserProfile
- CheckupCategory
- Checkup
- Reservation
- Report
- Prescription
- Chat & ChatMessage
- Payment
- Blog (Post, Category, Tag, Comment)
- CMS (Page, Banner, FAQ, SEO Meta)

---

## 🧮 Database Structure Overview
The database is modular and scalable, covering:
- Medical Flow: checkups → reservations → reports → prescriptions  
- Communication: chats & messages  
- Payments: payments & refunds  
- Content Management: pages, banners, blog, SEO  
- System: logs, notifications, queues  

---

## 🧠 Blog System Highlights
- Doctors and admins as authors
- SEO-ready (meta title, description, slug)
- Categories & tags
- Threaded comments with moderation
- Scheduled publishing
- Featured and related posts

---

## 🧰 Tech Stack
| Layer | Technology |
|----|----|
| Backend | Laravel 11 |
| Frontend | Blade + TailwindCSS (or Inertia + Vue 3) |
| Auth | Laravel Breeze / Jetstream |
| Roles & Permissions | Spatie Laravel Permission |
| File Uploads | Spatie Media Library |
| Payments | Laravel Cashier (Stripe) |
| Cache & Queue | Redis |
| Chat | Laravel WebSockets / Pusher |
| Editor | Tiptap / CKEditor |
| Testing | PestPHP |

---

## 🚀 Installation (Local)
```bash
composer create-project laravel/laravel checkupino
cd checkupino

php artisan breeze:install blade
composer require spatie/laravel-permission
php artisan migrate
```

---

## 📈 Future-Ready by Design
- Subscription plans
- AI-assisted medical insights
- Advanced analytics dashboard
- Video consultations
- Mobile app API integration

---

### ❤️ Built with care for modern digital healthcare
