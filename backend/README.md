# Enterprise Restaurant POS - Backend Foundation

This is the offline-first Node.js/Express backend architecture intended for Electron integration.

## How to Run

1. Navigate to the `backend` directory.
2. Install dependencies: `npm install`
3. Run the server: `node src/server.js`

### Expected Output
\`\`\`
[Server] Running in development mode on port 5000
[Server] Health check: http://localhost:5000/api/v1/health
\`\`\`

You can query `GET http://localhost:5000/api/v1/health` to see the health metrics.

## Folder Responsibilities

### Core Source (`src/`)
- **`config/`**: Configuration files (e.g., environment variables, constants configuration). Keeps configuration unified.
- **`database/`**: Core database connection and management.
  - `migrations/`: Scripts to create/alter database tables over time.
  - `seeds/`: Initial data population scripts.
  - `schema/`: Table definitions.
- **`routes/`**: Express route definitions. Only maps endpoints to controllers. No business logic.
- **`controllers/`**: Extracts data from HTTP requests (params, body, query) and passes it to services. Sends HTTP responses.
- **`services/`**: The core business logic of the application. Handles rules, calculations, and orchestrates calls to repositories.
- **`repositories/`**: The data access layer. Directly interacts with the database to run queries. Isolates DB logic from services.
- **`middleware/`**: Express middleware functions for intercepting requests (e.g., authentication, error handling, validation).
- **`models/`**: Application-level domain models or structural representations of entities (if needed outside pure database schema).
- **`validation/`**: Request payload validation schemas (e.g., using Zod) to ensure data integrity before hitting controllers.
- **`auth/`**: Authentication and authorization logic (e.g., JWT generation, password hashing).
- **`uploads/`**: Logic for handling file uploads (e.g., Multer configurations).
- **`printer/`**: Module responsible for handling receipt/kitchen printing logic for POS hardware.
- **`backup/`**: Scripts and logic for creating system/database backups.
- **`sync/`**: Logic for synchronizing offline data with the cloud when internet is available.
- **`constants/`**: Application-wide static constants (e.g., error codes, default values, enums).
- **`helpers/`**: Small helper functions specifically tied to business logic or domain operations.
- **`utils/`**: Generic utility functions (e.g., date formatters, string manipulators) independent of the domain.

### Storage (`storage/`)
- **`database/`**: Physical location for the SQLite database file (`pos.db`).
- **`images/`**: Locally stored images organized by entity (`products`, `categories`, `users`, `business`).
- **`backups/`**: Physical location for generated database/system backup files.
- **`exports/`**: Generated files for export (e.g., CSV reports).
- **`logs/`**: Physical log files (e.g., Winston output).
- **`temp/`**: Temporary processing files.
