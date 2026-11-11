# Sari2

Sari2 is a browser-based inventory monitoring system for sari-sari stores and other small retail businesses. It helps store owners and staff organize products, record stock movement, monitor low-stock and out-of-stock items, and track product expiration dates from one local application.

The application includes a public information site, account registration and login, and an authenticated inventory workspace. It is intended as a lightweight local system for day-to-day inventory monitoring.

## Installation and Setup

1. Install the required software:

   - [Node.js](https://nodejs.org/) version 18 or newer, which includes npm.
   - Git, if the project will be cloned from a repository.

2. Clone the repository:

   ```powershell
   git clone https://github.com/djkier/sari2-inventory-monitoring-system.git
   cd sari2-inventory-monitoring-system
   ```

   If the project was provided as an archive, extract it and open a terminal in the extracted project directory instead.

3. Open the backend directory:

   ```powershell
   cd backend
   ```

4. Install the backend dependencies:

   ```powershell
   npm install
   ```

5. No environment file, database server, or frontend build step is required. The backend creates local runtime storage automatically when it starts.

## Running the Application

1. From the `backend` directory, start Sari2:

   ```powershell
   npm start
   ```

2. Open the application in a browser:

   ```text
   http://localhost:3000
   ```

   Express serves both the API and the frontend. The backend must remain running while the application is in use. Do not open the HTML files directly from the filesystem.

3. Open `http://localhost:3000/html/frontfacing/login.html` to log in. External testers can select either demo account on the login page or enter these credentials manually:

   | Role | Username | Password |
   | --- | --- | --- |
   | Store Owner | `owner` | `owner123` |
   | Store Staff | `staff` | `staff123` |

4. To create an account, use the **Create an account** link on the login page:

   - A Store Owner creates a new store and receives its six-digit store code.
   - Store Staff join an existing store by entering its exact store name and six-digit code.

5. To use a different port, set the optional `PORT` environment variable before starting the server. For example, in PowerShell:

   ```powershell
   $env:PORT = 3001
   npm start
   ```

   Then open `http://localhost:3001`.

6. To stop the application, return to the terminal running the server and press `Ctrl+C`.

The health endpoint is available at `http://localhost:3000/api/health` when the default port is used.

## Key Features

### Accounts and store access

- Register as a Store Owner or Store Staff member.
- Create a store as an Owner or join one as Staff using its store name and code.
- Log in through an HTTP-only session cookie and log out from the authenticated workspace.
- Keep each store's products, categories, settings, and stock records separated by the authenticated store.

### Dashboard and monitoring

- View totals for products, low-stock items, out-of-stock items, and products expiring soon.
- Review dashboard previews for inventory items that need attention.
- Open filtered product and expiration views from dashboard links.

### Product and category management

- Add, edit, delete, search, and filter products.
- Record price, category, initial quantity, low-stock threshold, and optional expiration date.
- Reuse shared catalog products or create a new catalog entry.
- Use an image URL or upload a JPEG, PNG, WebP, or GIF image up to 5 MB.
- Add, rename, and delete categories that are not currently assigned to products.

### Stock and expiration tracking

- Record positive whole-number stock-in and stock-out transactions.
- Prevent stock-out transactions that exceed the available quantity.
- Review stock movement date, product, movement type, quantity, and resulting stock.
- Identify in-stock, low-stock, and out-of-stock products.
- Filter products by expiration status and configure the expiration warning period.

### Settings and contact form

- Allow Store Owners to update store information and inventory defaults.
- Allow Store Staff to update their own displayed account name.
- Submit validated contact messages through the public contact page.

## Technology Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Browser Fetch API for backend requests

### Backend

- Node.js 18 or newer
- Express 5
- `cors` middleware
- Node.js filesystem and cryptography APIs

### Data storage

- JSON files for users, stores, products, categories, stock movements, settings, catalog products, and contact messages
- Filesystem storage for product catalog images
- Atomic temporary-file replacement for JSON writes

### Other tools

- npm for dependency installation and startup scripts
- Git ignore rules for local runtime data

## User Roles

| Role | Main permissions and responsibilities |
| --- | --- |
| Store Owner | Creates a store, receives its store code, manages inventory, products, categories, and stock movements, and can update the store name, owner name, default low-stock threshold, and expiration warning period. The store code is shown to the Owner for inviting Staff. |
| Store Staff | Joins an existing store using its exact name and six-digit code. Staff can use the inventory, product, category, stock, dashboard, and expiration features for that store. Staff can update their own displayed name but cannot change Owner-only store settings. |

Both roles must be authenticated to access inventory APIs and pages. The current authorization rules restrict Owner-only settings, while the main inventory operations are available to both roles within their store.

## Project Structure

```text
sari2-inventory-management-system/
├── frontend/
│   ├── assets/                 # Public images and interface icons
│   ├── css/                    # Public-site and inventory styles
│   ├── html/
│   │   ├── frontfacing/        # Login, registration, and contact pages
│   │   └── inventory/          # Dashboard, products, stock, expiration, settings
│   ├── js/                     # API, authentication, and page behavior
│   └── index.html              # Public home page
├── backend/
│   ├── data/                   # Tracked original JSON dataset
│   ├── uploads/                # Tracked original catalog images
│   ├── temp_data/              # Ignored runtime data and uploads, created locally
│   ├── src/                    # Storage and application business logic
│   ├── package.json            # Dependencies and npm scripts
│   └── server.js               # Express routes, static serving, and startup
├── .gitignore
└── README.md
```

`backend/server.js` serves the files in `frontend/`, so a separate frontend process is not required.

## Data Storage and File Uploads

Sari2 uses tracked original files as a default dataset and keeps normal application changes in an ignored runtime directory.

- `backend/data/` contains the original JSON seed data tracked by Git.
- `backend/uploads/` contains the original uploaded catalog images tracked by Git.
- `backend/temp_data/` contains the active runtime JSON data and uploaded files. It is excluded from Git by the root `.gitignore`.

When the backend starts, it creates `backend/temp_data/` if necessary. Each missing JSON file is copied from `backend/data/`, and missing upload files are copied from `backend/uploads/` into `backend/temp_data/uploads/`. Files already present in runtime storage are not overwritten.

All application reads and writes use `backend/temp_data/`. New catalog images are stored in `backend/temp_data/uploads/catalog/`, while their public URLs continue to use `/uploads/catalog/<filename>`. Image replacement and cleanup affect only runtime files. Runtime deletion metadata prevents replaced original images from being copied back during later startups.

Runtime records and uploaded images persist when the server restarts. This separation prevents normal application testing from modifying the tracked default dataset.

### Resetting local runtime data

1. Stop the backend with `Ctrl+C`.
2. Back up `backend/temp_data/` if any local records or uploads must be kept.
3. Delete the entire `backend/temp_data/` directory.
4. Start the backend again with `npm start`.

The next startup recreates runtime storage from `backend/data/` and `backend/uploads/`.

**Warning:** Resetting runtime data permanently removes locally created accounts, stores, products, stock movements, settings changes, contact messages, and uploaded images stored in `temp_data/`.

## Troubleshooting

| Problem | Suggested action |
| --- | --- |
| `node` or `npm` is not recognized | Install Node.js 18 or newer, close and reopen the terminal, then verify with `node --version` and `npm --version`. |
| `npm install` fails | Confirm the terminal is inside `backend/` and that the computer can access the npm registry. Review the displayed npm error before retrying. |
| The server does not start | Confirm dependencies were installed in `backend/`. Check the terminal for missing original data, upload-directory, JSON, or permission errors. |
| Port 3000 is already in use | Stop the other process or set a different positive `PORT` value before running `npm start`. |
| The page reports that it cannot connect to the server | Keep `npm start` running and access the site through `http://localhost:<port>`, not by opening an HTML file directly. |
| Runtime data cannot be created or read | Confirm that `backend/data/` and `backend/uploads/` exist and that the current user can write to the `backend/` directory. Do not make the original directories the runtime write location. |
| Product images do not display | Confirm the referenced file exists under `backend/temp_data/uploads/catalog/`, restart the backend if runtime initialization was interrupted, and review the server terminal for invalid image metadata or file errors. |
| Login returns invalid credentials | Use the demo credentials exactly as listed or create an account. Usernames and passwords are case-sensitive. |

## Known Limitations

- JSON and uploaded-file persistence is designed for a local, single-server course project rather than concurrent production deployment.
- Passwords are stored as plain text in local JSON data. Do not use real or sensitive passwords.
- Login sessions are stored in server memory and are lost when the backend restarts, although JSON records and uploads persist.
- There is no password recovery or password-change workflow.
- Contact messages are saved locally but are not emailed and do not have an administrative inbox in the application.
- Sari2 does not provide point-of-sale, payment processing, accounting, supplier management, delivery management, or multi-branch management features.
- The project does not include an automated test command in `package.json`.
