/**
 * Email Branding Utility
 * Provides consistent website branding for all transactional emails
 * - Logo/Brand name
 * - Color scheme (blues, greens, oranges)
 * - Professional headers and footers
 * - Responsive layouts
 */

// Brand Configuration
const BRAND = {
  name: 'EG Travel Market',
  email: 'info@egtravelmarket.com',
  phone: '+20 122 790 3329',
  website: 'www.egtravelmarket.com',
  whatsapp: 'https://wa.me/201227903329'
};

// Brand Color Palette
const COLORS = {
  primary: '#0066cc',     // Main brand blue
  primaryDark: '#004999',
  success: '#28a745',
  successLight: '#d4edda',
  warning: '#ffc107',
  warningLight: '#fff8e1',
  info: '#17a2b8',
  infoLight: '#f0f8ff',
  secondary: '#6c757d',
  text: '#333',
  textLight: '#555',
  textMuted: '#999',
  border: '#eee',
  background: '#f4f4f4',
  white: '#ffffff',
  footer: '#f8f9fa'
};

/**
 * Generate professional email header with branding
 */
function getEmailHeader(title, subtitle = null, headerColor = COLORS.primary) {
  return `
    <tr>
      <td style="background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor === COLORS.primary ? COLORS.primaryDark : '#20c997'} 100%); padding: 40px 30px; text-align: center;">
        <h1 style="margin: 0; color: ${COLORS.white}; font-size: 28px; font-weight: bold;">
          ${title}
        </h1>
        ${subtitle ? `<p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">${subtitle}</p>` : ''}
      </td>
    </tr>
  `;
}

/**
 * Generate professional email footer with contact info
 */
function getEmailFooter() {
  const currentYear = new Date().getFullYear();
  return `
    <tr>
      <td style="padding: 30px; text-align: center; background-color: ${COLORS.footer}; border-top: 1px solid ${COLORS.border};">
        <p style="margin: 0 0 10px 0; color: ${COLORS.text}; font-size: 14px; font-weight: bold;">
          ${BRAND.name}
        </p>
        <p style="margin: 0 0 15px 0; color: ${COLORS.textMuted}; font-size: 12px; line-height: 1.6;">
          📧 <a href="mailto:${BRAND.email}" style="color: ${COLORS.primary}; text-decoration: none;">${BRAND.email}</a><br>
          📱 <a href="tel:+201227903329" style="color: ${COLORS.primary}; text-decoration: none;">+20 122 790 3329</a><br>
          💬 <a href="${BRAND.whatsapp}" style="color: #25D366; text-decoration: none; font-weight: bold;">WhatsApp Support</a>
        </p>
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid ${COLORS.border};">
          <p style="margin: 0 0 5px 0; color: ${COLORS.textMuted}; font-size: 12px;">
            © ${currentYear} ${BRAND.name}. All rights reserved.
          </p>
          <p style="margin: 0; color: ${COLORS.textMuted}; font-size: 11px;">
            This is an automated email. Please do not reply directly to this email.
          </p>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Wrap email content with professional branding template
 */
function wrapWithBranding(contentHtml, title, subtitle = null, headerColor = COLORS.primary) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', 'Helvetica', sans-serif; background-color: ${COLORS.background}; }
        table { border-collapse: collapse; }
        a { color: ${COLORS.primary}; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${COLORS.background};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLORS.background}; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              
              <!-- Header with Branding -->
              ${getEmailHeader(title, subtitle, headerColor)}
              
              <!-- Content -->
              <tr>
                <td style="padding: 30px;">
                  ${contentHtml}
                </td>
              </tr>
              
              <!-- Footer with Contact Info -->
              ${getEmailFooter()}
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Create a branded info box (for highlights, codes, etc)
 */
function createInfoBox(content, backgroundColor = COLORS.infoLight, borderColor = COLORS.primary) {
  return `
    <div style="background-color: ${backgroundColor}; border-left: 4px solid ${borderColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      ${content}
    </div>
  `;
}

/**
 * Create a branded alert box
 */
function createAlertBox(content, type = 'info') {
  const alertColors = {
    success: { bg: COLORS.successLight, border: COLORS.success, text: '#155724' },
    warning: { bg: COLORS.warningLight, border: COLORS.warning, text: '#f57c00' },
    info: { bg: COLORS.infoLight, border: COLORS.primary, text: COLORS.primary },
    error: { bg: '#f8d7da', border: '#dc3545', text: '#721c24' }
  };
  
  const colors = alertColors[type] || alertColors.info;
  
  return `
    <div style="background-color: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 15px; margin: 20px 0; border-radius: 4px; color: ${colors.text};">
      ${content}
    </div>
  `;
}

/**
 * Create a branded button
 */
function createButton(text, url, backgroundColor = COLORS.primary) {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="background-color: ${backgroundColor}; color: ${COLORS.white}; padding: 15px 40px; border-radius: 25px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px;">
        ${text}
      </a>
    </div>
  `;
}

/**
 * Create a branded divider
 */
function createDivider() {
  return `<div style="margin: 20px 0; border-top: 2px solid ${COLORS.primary};"></div>`;
}

/**
 * Format timestamp in Cairo timezone
 */
function getFormattedTime() {
  return new Date().toLocaleString('en-US', { 
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

module.exports = {
  BRAND,
  COLORS,
  getEmailHeader,
  getEmailFooter,
  wrapWithBranding,
  createInfoBox,
  createAlertBox,
  createButton,
  createDivider,
  getFormattedTime
};
