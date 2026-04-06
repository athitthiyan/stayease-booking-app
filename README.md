# Stayvora Booking

Stayvora Booking is the guest-facing hotel discovery and checkout experience for live availability, booking recovery, and payment handoff.

**Live App:** [stayvora.co.in](https://stayvora.co.in)
**Backend API:** [hotel-api-production-447d.up.railway.app](https://hotel-api-production-447d.up.railway.app)

## Features

- Real-time room search with city, date, guest, and price filters
- Room detail pages with gallery, amenities, and live availability checks
- Checkout flow with hold creation and resumable booking recovery
- Booking history, wishlist, auth, and confirmation flows
- Invoice and voucher access after successful booking
- Responsive premium guest experience

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Angular 17 (standalone components) |
| Styling | SCSS + CSS custom properties |
| HTTP | Angular HttpClient |
| State | Angular Signals |
| Routing | Angular Router |
| Deployment | Vercel |

## Quick Start

```bash
npm install
npm start
# http://localhost:4200
```

## Connected Apps

- [PayFlow](../2-payflow-payment-app) for payments
- [InsightBoard](../3-insightboard-admin) for operations
- [HotelAPI](../4-hotelapi-backend) for shared backend workflows
- [Partner Portal](../6-partner-portal) for hotel partner operations

## Project Structure

```text
src/app/
|-- core/
|   |-- models/
|   `-- services/
|-- shared/
|   `-- components/
`-- features/
    |-- landing/
    |-- search-results/
    |-- room-detail/
    |-- checkout/
    `-- booking-confirmation/
```

Built for Stayvora booking.
