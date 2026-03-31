# 🏨 StayEase — Premium Hotel Booking Platform

> A luxury hotel booking experience with real-time search, room filtering, and seamless checkout.

**Live Demo:** [stayease-booking.vercel.app](https://stayease-booking.vercel.app)
**Backend API:** [hotel-api.onrender.com](https://hotel-api.onrender.com)

---

## ✨ Features

- 🔍 Real-time room search with city, date, guest, and price filters
- 🏨 Featured hotels landing page with animated hero section
- 📸 Room detail pages with image gallery and amenity grid
- 🧾 Live price breakdown (room rate + 12% tax + 5% service fee)
- 💳 Checkout flow connected to PayFlow payment gateway
- ✅ Booking confirmation with reference number
- 📱 Fully responsive design

## 🛠️ Tech Stack

| Layer       | Technology                    |
|-------------|-------------------------------|
| Framework   | Angular 17 (Standalone Components) |
| Styling     | SCSS + CSS Custom Properties (Dark Luxury Theme) |
| HTTP        | Angular HttpClient            |
| State       | Angular Signals               |
| Routing     | Angular Router (lazy loading) |
| Fonts       | Playfair Display + Inter       |
| Deployment  | Vercel                        |

## 🚀 Quick Start

```bash
npm install
npm start
# → http://localhost:4200
```

## 🔗 Part of a 3-Project Portfolio

This app connects to:
- **[PayFlow](../2-payflow-payment-app)** — handles payment after checkout
- **[InsightBoard](../3-insightboard-admin)** — admin analytics dashboard
- **[HotelAPI](../4-hotelapi-backend)** — shared FastAPI backend

## 📂 Project Structure

```
src/app/
├── core/
│   ├── models/         # TypeScript interfaces (Room, Booking)
│   └── services/       # RoomService, BookingService
├── shared/
│   └── components/     # Navbar, Footer, RoomCard
└── features/
    ├── landing/        # Hero, search, featured rooms
    ├── search-results/ # Filtered room listing
    ├── room-detail/    # Gallery, amenities, booking panel
    ├── checkout/       # Guest form + order summary
    └── booking-confirmation/
```

---

*Built by Athitthiyan — Portfolio 2026*
