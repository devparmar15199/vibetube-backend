# VibeTube - Backend

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)

This repository contains the backend source code for VibeTube, a modern video streaming platform.

## ✨ Features

- User Authentication (Registration, Login)
- Video Upload and Processing
- Video Streaming
- User Channels and Subscriptions
- Likes and Comments
- Search Functionality

## 🛠️ Tech Stack

- **Runtime:** [Node.js](https://nodejs.org/)
- **Framework:** [Express.js](https://expressjs.com/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database:** [MongoDB](https://www.mongodb.com/)
- **Authentication:** JWT (JSON Web Tokens)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/en/download/) (v18.x or later recommended)
- [npm](https://www.npmjs.com/get-npm) or [yarn](https://classic.yarnpkg.com/en/docs/install/)

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/devparmar15199/vibetube-backend.git
    cd vibetube-backend
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```
    or
    ```sh
    yarn install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the necessary environment variables. You can use the `.env.example` file as a template:
    ```sh
    cp .env.example .env
    ```
    Update the `.env` file with your configuration (e.g., database connection string, JWT secret).

    ```env
    # .env.example
    PORT=3000
    DATABASE_URL="your_database_connection_string"
    JWT_SECRET="your_jwt_secret"
    ```

### Running the Application

- **Development:**
  To run the server in development mode with auto-reloading:
  ```sh
  npm run dev
  ```

- **Production:**
  To build and run the server for production:
  ```sh
  npm run build
  npm start
  ```

## 📂 Project Structure

```
vibetube-backend/
├── src/
│   ├── controllers/    # Request handlers
│   ├── models/         # Database schemas/models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── middlewares/    # Express middlewares
│   ├── utils/          # Utility functions
│   └── app.ts          # Express app setup
├── .env.example        # Environment variable template
├── package.json
└── tsconfig.json
```

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---
Made with ❤️ by devparmar15199
