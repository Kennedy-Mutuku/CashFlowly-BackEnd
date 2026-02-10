# CashFlowly - Personal Finance Management System (Backend)

CashFlowly is a robust Personal Finance Management System designed to help users track their financial health. This repository contains the backend API built with Node.js, Express, and MongoDB.

## Features

- **JWT Authentication**: Secure user registration and login.
- **Income & Expense Tracking**: Restricted to authenticated users.
- **Budgeting**: Set and monitor monthly spending limits.
- **Savings Goals**: Track progress toward financial targets.
- **Analytics**: Aggregated monthly reports for data visualization.

## Tech Stack

- **Node.js**: Runtime environment.
- **Express.js**: Web framework.
- **MongoDB**: Database.
- **Mongoose**: ODM.
- **jsonwebtoken**: For authentication.
- **bcryptjs**: For password security.

## Setup Instructions

1. Clone the repository.
2. Navigate to the `backend` folder.
3. Install dependencies: `npm install`.
4. Create a `.env` file with the following:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```
5. Run the server: `npm run dev`.

## API Endpoints

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - User login
- `GET /api/income` - Get all income records
- `POST /api/income` - Add a new income
- `GET /api/expenses` - Get all expense records
- `POST /api/expenses` - Add a new expense
- `GET /api/budget` - Get monthly budget
- `POST /api/budget` - Set monthly budget
- `GET /api/savings` - Get savings goals
- `GET /api/reports/monthly` - Get aggregated analytics
