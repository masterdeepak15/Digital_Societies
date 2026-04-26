# 🏢 Society Management Application - System Design

## 📌 Overview
A role-based digital platform to manage residential societies including:
- Maintenance billing
- Visitor management
- Complaint tracking
- Communication system
- Accounting and analytics
- Private Social Network for Society (Society Feed)

---

# 🧠 Core Concept

## Role-Based Access Control (RBAC)

Single application with multiple user roles:
- Admin (Management Committee)
- Resident (Owner/Tenant)
- Security Guard
- Staff (Optional)
- Accountant (Optional)

Each role has specific permissions and UI.

---

# 👥 User Roles & Permissions

## 🏢 Admin (Management समिति)

### Capabilities:
- Create & manage maintenance bills
- View all payments
- Approve/reject expenses
- Post notices
- Manage complaints
- Add/remove residents
- Access reports & analytics
- Manage staff & vendors
- Post to Emergency Wall (broadcast, read-only for residents)
- Moderate Society Feed (remove posts, mute members, lock comments)
- Pin/feature posts and events

---

## 👤 Resident (User)

### Capabilities:
- Pay maintenance bills
- Raise complaints
- Approve/reject visitors
- View notices
- Book facilities
- View payment history
- Post to Society Feed (text + photos, categories: General / Lost & Found / Help Wanted / For Sale / Recommendation / Warning)
- React and comment on posts
- Create and join community groups (wing, floor, interest-based)
- Post marketplace listings (buy/sell/give-away within society)
- Create and vote in quick polls
- Post and RSVP to events
- Opt-in to Resident Directory

---

## 🚪 Security Guard

### Capabilities:
- Add visitor entries
- Notify residents for approval
- Track entry/exit logs
- Manage deliveries
- Trigger emergency alerts

---

## 🛠️ Staff (Optional)

### Capabilities:
- View assigned tasks
- Update job status

---

## 🧾 Accountant (Optional)

### Capabilities:
- Manage financial records
- Generate reports
- Limited admin access

---

# 🔐 Permission Matrix

| Feature                  | Admin | Resident | Family | Guard | Staff |
|--------------------------|-------|----------|--------|-------|-------|
| Create bill              | ✅    | ❌       | ❌     | ❌    | ❌    |
| Pay bill                 | ❌    | ✅       | ✅     | ❌    | ❌    |
| Add visitor              | ❌    | ❌       | ❌     | ✅    | ❌    |
| Approve visitor          | ❌    | ✅       | ✅     | ❌    | ❌    |
| View all data            | ✅    | ❌       | ❌     | ❌    | ❌    |
| Post to feed             | ✅    | ✅       | ✅     | ❌    | ❌    |
| Post Emergency Wall      | ✅    | ❌       | ❌     | ❌    | ❌    |
| Moderate feed            | ✅    | ❌       | ❌     | ❌    | ❌    |
| Create marketplace listing | ✅  | ✅       | ❌     | ❌    | ❌    |
| Post / vote in poll      | ✅    | ✅       | ✅     | ❌    | ❌    |
| View resident directory  | ✅    | ✅       | ✅     | ❌    | ❌    |

---

# ⚙️ Core Features

## 💰 Maintenance Management
- Monthly bill generation
- Online payments (UPI, Cards)
- Late fees & reminders
- Payment history

---

## 🚪 Visitor Management
- Gate entry system
- Resident approval system
- Delivery tracking
- Visitor logs

---

## 🧾 Complaint System
- Ticket creation with images
- Status tracking
- Admin assignment

---

## 📢 Communication
- Notices & announcements
- Emergency alerts

---

## 👥 Member Management
- Owner/tenant records
- Family members
- Rental tracking

---

# 🚀 Advanced Features

## 📊 Accounting System
- Expense tracking
- Vendor payments
- Financial reports
- Audit-ready logs

---

## 🛠️ Staff & Vendor Management
- Staff attendance
- Vendor tracking

---

## 🏊 Facility Booking
- Clubhouse, gym, parking
- Paid booking support

---

## 🗳️ Voting System
- Polls & AGM voting

---

## 📅 Events
- Event creation
- RSVP tracking

---

## 🚗 Parking Management
- Slot allocation
- Vehicle records

---

## 🗣️ Private Social Network (Society Feed)
- **Feed / Posts** — text + photos; categories: General, Lost & Found, Help Wanted, For Sale, Recommendation, Warning, Event, Poll, Emergency
- **Reactions & Comments** — Helpful / Thanks / 👍; threaded comments (one level); admin can lock any thread
- **Groups / Circles** — auto-groups by wing/floor; resident-created interest groups (Pet Owners, EV Owners, Carpool…)
- **Community Marketplace** — Buy / Sell / Give-Away listings within the society; no external links without admin approval
- **Quick Polls** — informal resident polls; separate from formal AGM voting
- **Events** — post events with date/venue/RSVP; admin can feature-pin
- **Resident Directory** — opt-in per field (name, flat, phone, email); admin can force-hide any entry
- **Help Requests** — short-lived posts (24h auto-expire); "Collect my parcel?" / "Carpool to Whitefield?"
- **Emergency Wall** — admin-only broadcast; read-only; loud push notification; pinned at top of all feeds
- **Moderation** — admin removes posts, mutes members (7d / 30d / permanent), locks feed to read-only, exports report
- **Privacy** — society-boundary only; flat-verified identity on every post; no public indexing; DPDP-compliant data export + delete

---

# 💡 Unique Features (Differentiators)

## 🔥 Society Wallet
- Prepaid wallet system
- Auto-deduct payments

---

## 🤖 AI Complaint Routing
- Auto-detect complaint type
- Assign to relevant staff

---

## 🛒 Local Services Marketplace
- Verified service providers
- Commission-based model

---

## 📊 Smart Analytics Dashboard
- Defaulters list
- Expense trends
- Collection insights

---

## 🚨 Emergency System
- Panic button
- Alert guards + residents

---

# 🧱 Technical Architecture

## 📱 Frontend
- Mobile App React Native

## 🖥️ Backend
- .net core 8

## 🗄️ Database
- Sqlitedb 

## 💳 Payments
- Razorpay / UPI integration

---

# 🧾 Database Design (Basic)

## Users Table
- id
- name
- phone
- role (admin/resident/guard)
- society_id

## Roles Table
- role_name
- permissions (JSON)

## Societies Table
- id
- name
- address

## Bills Table
- id
- user_id
- amount
- due_date
- status

## Visitors Table
- id
- name
- phone
- flat_id
- entry_time
- exit_time

## Social Posts Table (social schema)
- id
- society_id
- author_user_id
- author_flat_id
- category (general / lost_found / help_wanted / for_sale / recommendation / warning / event / poll / emergency)
- body (max 1000 chars)
- image_urls (JSONB)
- group_id (nullable)
- is_pinned
- is_locked
- expires_at (nullable — for help_wanted)
- is_deleted
- created_at / updated_at

## Social Post Reactions Table
- post_id
- user_id
- reaction (helpful / thanks / thumbsup)
- UNIQUE (post_id, user_id)

## Social Comments Table
- id
- post_id
- parent_id (nullable — one level deep)
- author_user_id
- author_flat_id
- body (max 500 chars)
- is_deleted
- created_at

## Social Groups Table
- id
- society_id
- name
- type (auto_wing / auto_floor / manual)
- created_by_user_id

## Social Group Members Table
- group_id
- user_id
- joined_at

## Social Polls Table
- id
- post_id
- question
- options (JSONB: [{id, text}])
- ends_at
- allow_multiple

## Social Poll Votes Table
- poll_id
- user_id
- option_ids (JSONB)

## Social Marketplace Listings Table
- id
- post_id (listing IS a post)
- price_paise (nullable = free)
- condition (new / like_new / good / fair)
- is_sold
- sold_to_user_id

## Social Reports Table
- id
- post_id
- reported_by
- reason
- status (pending / reviewed / dismissed / actioned)

## Resident Directory Table
- user_id (PK)
- society_id
- display_name
- show_phone
- show_email
- bio (max 150 chars)

---

# 📱 UI Guidelines

## Admin UI
- Dashboard with charts
- Reports & tables
- Full control panel

## Resident UI
- Clean & simple
- Payments & notifications focused
- Social feed tab (FeedScreen, CreatePostScreen, PostDetailScreen)
- Marketplace grid with condition + price chips
- Directory search by name or flat

## Guard UI
- Large buttons
- Minimal text
- Fast actions

---

# 🔑 Authentication

- OTP-based login (mobile)
- Role-based redirection after login

---

# 🔄 Multi-Role Support

- One user can have multiple roles
- Role switching inside app

---

# 📶 Offline Support

- Especially for guard app
- Sync when internet is available

---

# 📜 Activity Logs

Track all actions:
- Bill creation
- Payments
- Visitor approvals
- Complaint updates

---

# ⚠️ Common Mistakes to Avoid

- ❌ Separate apps for each role
- ❌ Overcomplicated UI
- ❌ No permission control
- ❌ No audit logs

---

# 🚀 Development Phases

## Phase 1 (MVP)
- Maintenance billing
- Visitor management
- Complaint system
- Notices + real-time push (SignalR)

## Phase 2
- Accounting
- Notifications (SMS + push)
- Member management (owner / tenant / family)
- **Private Social Network** — Society Feed, Groups, Community Marketplace, Polls, Events, Resident Directory, Emergency Wall, Admin Moderation

## Phase 3
- Parking + geomap (visitor navigation, EV booking)
- Marketplace (local verified service providers + commissions)
- AI features (MCP tools: complaint routing, bill Q&A, anomaly detection)
- Advanced analytics

## Phase 4
- Audio / Video calling (LiveKit / Jitsi)
- Society Wallet
- Indoor beacon navigation (Pro tier)
- White-label + Enterprise SSO

---

# 💰 Monetization Strategy

- Subscription per flat (₹10–₹50/month)
- Vendor commissions
- Payment gateway charges
- Premium features

---

# 🎯 Goal

Build a scalable system that acts as:
👉 “Digital Operating System for Housing Societies”

---

