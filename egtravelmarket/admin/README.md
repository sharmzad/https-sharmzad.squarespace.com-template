# Flash Offers Admin Panel

## 🔐 Access

**URL:** `/admin/admin-flash.html`

**Password:** `ETM2025!`

**Session:** Automatically logs out after 6 hours of inactivity

## 📝 How to Use

### 1. Login
- Navigate to `/admin/admin-flash.html`
- Enter password: `ETM2025!`
- Click "Unlock"

### 2. Manage Offers
- Click **+ New Offer** to create a new flash offer
- Fill in the form:
  - Badge: Label like "Ends Soon", "Trip of the Week", etc.
  - Title: Name of the offer
  - Description: Details about the offer
  - Link: URL to the tour/package page (e.g., `cairo-by-flight.html`)
  - Deadline: Pick date/time or enter ISO format

### 3. Edit/Delete
- Click **Edit** button next to any offer in the table
- Make changes and click **Save Offer**
- Click **Delete** to remove an offer

### 4. Publish Changes
- Click **Save to Browser** to backup locally
- Click **Download JSON** to get `flash-offers.json` file
- Replace the `flash-offers.json` file in your project root
- Changes appear immediately on the live site

## 🎯 Features

- **Auto-save to Browser** - LocalStorage backup prevents data loss
- **Import/Export** - Import existing JSON or export for publishing
- **Copy to Clipboard** - Quick copy JSON for manual file editing
- **Date Picker** - Easy deadline selection with automatic timezone conversion
- **Live Preview** - See all offers in a table before publishing

## 🔧 Change Password

Edit line 4 in `admin-flash.js`:
```javascript
const PASSWORD = 'YourNewPassword';
```

## 🚨 Security Notes

- **DO NOT** link this page from public navigation
- Access should be via direct URL only
- Password is stored in JavaScript (client-side only)
- For production, consider server-side authentication
