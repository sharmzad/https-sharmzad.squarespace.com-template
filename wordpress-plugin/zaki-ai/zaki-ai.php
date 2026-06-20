<?php
/**
 * Plugin Name:       Zaki — AI Dining Advisor for Sobhy Kaber
 * Description:        Adds the Zaki chat advisor to the site and securely connects it to the nano-gpt API. The API key stays on the server and is never exposed to visitors.
 * Version:           1.0.0
 * Author:            Sobhy Kaber
 * License:           GPL-2.0-or-later
 *
 * HOW IT WORKS
 *  - The Zaki widget (a small chat button) is added to every page.
 *  - When a guest chats, the widget calls THIS site at /wp-json/zaki/v1/chat.
 *  - This plugin adds the restaurant's menu + Zaki's personality, then calls
 *    nano-gpt with your secret API key (which never leaves the server).
 *  - If nano-gpt is slow or unavailable, the widget falls back to its built-in
 *    free engine automatically, so the chat always works.
 */

if (!defined('ABSPATH')) { exit; } // No direct access.

define('ZAKI_AI_VERSION', '1.0.0');
define('ZAKI_AI_NANOGPT_URL', 'https://nano-gpt.com/api/v1/chat/completions');

/* =====================================================================
 *  1) Settings page  (Settings → Zaki AI)
 * ===================================================================== */

add_action('admin_menu', function () {
    add_options_page('Zaki AI', 'Zaki AI', 'manage_options', 'zaki-ai', 'zaki_ai_settings_page');
});

add_action('admin_init', function () {
    register_setting('zaki_ai', 'zaki_ai_api_key',  ['sanitize_callback' => 'trim']);
    register_setting('zaki_ai', 'zaki_ai_model',    ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('zaki_ai', 'zaki_ai_enabled',  ['sanitize_callback' => 'absint']);
});

/**
 * The key may also be defined in wp-config.php for extra safety:
 *   define('ZAKI_NANOGPT_KEY', 'your-key-here');
 * A constant always wins over the value saved in the settings page.
 */
function zaki_ai_get_key() {
    if (defined('ZAKI_NANOGPT_KEY') && ZAKI_NANOGPT_KEY) {
        return ZAKI_NANOGPT_KEY;
    }
    return trim((string) get_option('zaki_ai_api_key', ''));
}

function zaki_ai_get_model() {
    $m = trim((string) get_option('zaki_ai_model', ''));
    return $m !== '' ? $m : 'gpt-4o-mini'; // change to any model id from your nano-gpt account
}

function zaki_ai_settings_page() {
    if (!current_user_can('manage_options')) { return; }
    $key_in_config = defined('ZAKI_NANOGPT_KEY') && ZAKI_NANOGPT_KEY;
    ?>
    <div class="wrap">
        <h1>Zaki — AI Dining Advisor</h1>
        <p>Connect Zaki to nano-gpt. Your API key stays on this server and is never visible to visitors.</p>
        <form action="options.php" method="post">
            <?php settings_fields('zaki_ai'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="zaki_ai_enabled">Enable AI replies</label></th>
                    <td>
                        <input type="checkbox" id="zaki_ai_enabled" name="zaki_ai_enabled" value="1"
                               <?php checked(1, (int) get_option('zaki_ai_enabled', 0)); ?> />
                        <span class="description">When off, Zaki still works using its free built-in engine (no API calls).</span>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="zaki_ai_api_key">nano-gpt API key</label></th>
                    <td>
                        <?php if ($key_in_config) : ?>
                            <em>Set in wp-config.php (ZAKI_NANOGPT_KEY) — this field is ignored.</em>
                        <?php else : ?>
                            <input type="password" id="zaki_ai_api_key" name="zaki_ai_api_key" class="regular-text"
                                   value="<?php echo esc_attr(get_option('zaki_ai_api_key', '')); ?>" autocomplete="off" />
                            <p class="description">From nano-gpt → Create API Key. Begins after “Bearer ” in their example.</p>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="zaki_ai_model">Model</label></th>
                    <td>
                        <input type="text" id="zaki_ai_model" name="zaki_ai_model" class="regular-text"
                               value="<?php echo esc_attr(get_option('zaki_ai_model', '')); ?>"
                               placeholder="gpt-4o-mini" />
                        <p class="description">
                            Copy the exact model id from your nano-gpt model list. Good cheap multilingual picks:
                            <code>gpt-4o-mini</code>, a Gemini Flash id, or a Qwen2.5 id. Leave blank to use <code>gpt-4o-mini</code>.
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
        <hr />
        <p><strong>Test:</strong> open your site, click the red chat button, and ask “what do you recommend for 4 people?”.
           If the AI is connected you’ll get a written, conversational answer; if anything fails it silently falls back to the free engine.</p>
    </div>
    <?php
}

/* =====================================================================
 *  2) Load the Zaki widget on the front end + point it at our proxy
 * ===================================================================== */

add_action('wp_enqueue_scripts', function () {
    if (is_admin()) { return; }

    wp_enqueue_script(
        'zaki-widget',
        plugins_url('assets/zaki-widget.js', __FILE__),
        [],
        ZAKI_AI_VERSION,
        true
    );

    // Tell the widget where the proxy lives — only when AI is enabled AND a key exists.
    $endpoint = 'null';
    if ((int) get_option('zaki_ai_enabled', 0) === 1 && zaki_ai_get_key() !== '') {
        $endpoint = wp_json_encode(esc_url_raw(rest_url('zaki/v1/chat')));
    }
    wp_add_inline_script(
        'zaki-widget',
        'window.ZAKI_CONFIG = Object.assign(window.ZAKI_CONFIG || {}, { aiEndpoint: ' . $endpoint . ' });',
        'before'
    );
});

/* =====================================================================
 *  3) The proxy endpoint  POST /wp-json/zaki/v1/chat
 * ===================================================================== */

add_action('rest_api_init', function () {
    register_rest_route('zaki/v1', '/chat', [
        'methods'             => 'POST',
        'callback'            => 'zaki_ai_chat',
        'permission_callback' => '__return_true', // public chatbot endpoint
    ]);
});

/** Build the system prompt: who Zaki is + the real menu + the rules. */
function zaki_ai_system_prompt($lang) {
    $menu = <<<MENU
CHARCOAL GRILLS (prices in EGP, by portion ¼ / ⅓ / ½ / 1kg):
- Kofta — hand-minced beef. ¼ 330 · ⅓ 450 · ½ 650 · 1kg 1300. Bestseller, kid-friendly.
- Kebab — tender beef chunks. ¼ 400 · ⅓ 535 · ½ 800 · 1kg 1600.
- Tarb (fat-wrapped kofta) — smoky, juicy, a connoisseur's choice. ¼ 350 · ⅓ 465 · ½ 700 · 1kg 1400. Signature.
- Veal Cutlets (Neefa). ¼ 400 · ⅓ 550 · ½ 800 · 1kg 1600.
- Lamb Chops (Reesh) — our signature. ¼ 450 · ⅓ 600 · ½ 900 · 1kg 1800. Bestseller.
- Shish Tawook (chicken) — light, kid-friendly. ¼ 170 · ⅓ 190 · ½ 290 · 1kg 550.
- Grilled Sausage (Sogo'). ¼ 250 · ⅓ 335 · ½ 500 · 1kg 1000.
- Grilled Pigeon — 230. Stuffed Pigeon (Hamam Mahshi) — 230, a signature delicacy.
- Hawawshi — spiced minced meat in baladi bread, baked. 130.

MIXED GRILL PLATTERS (for sharing, by portion ⅓ / ½ / 1kg):
- Mixed Kebab, Kofta & Shish Tawook — ⅓ 370 · ½ 550 · 1kg 1100. Bestseller.
- Mixed Kofta & Shish Tawook — ⅓ 315 · ½ 465 · 1kg 925. Great value.
- Mixed Kebab, Kofta & Lamb Chops — ⅓ 530 · ½ 800 · 1kg 1580. Premium.
- Mixed Tarb, Kofta & Kebab — ⅓ 495 · ½ 730 · 1kg 1460.

FROM THE OVEN (casseroles):
- Molokhia (plain) 130 · Molokhia with meat 400.
- Torly (mixed vegetables) 400 · Freekh casserole 400.

NOTE: No seafood. No desserts or drinks are on the published menu — say so honestly if asked.
MENU;

    $rules = "You are Zaki (\xD8\xB2\xD9\x83\xD9\x8A), the warm, knowledgeable dining advisor for Sobhy Kaber, an authentic Egyptian charcoal-grill restaurant in the Old Market of Sharm El Sheikh, facing Al Sahaba Mosque, since 1996. "
        . "Sharm is a tourist city, so reply in the SAME language the guest uses (Arabic, English, Russian, German, Italian, etc.). "
        . "Recommend dishes from the MENU only, with real EGP prices; gently suggest a good pairing (e.g. molokhia with kofta) without being pushy; favour the bestsellers and signatures. "
        . "Keep answers short, friendly, and useful (2-5 sentences). Never invent dishes, prices, or opening hours you don't have. "
        . "To book a table or speak to a person, tell the guest to use the booking button or contact the team on WhatsApp at +20 110 110 7542. "
        . "Address: Old Market (the souk), facing Al Sahaba Mosque, Sharm El Sheikh.";

    return $rules . "\n\nMENU:\n" . $menu;
}

function zaki_ai_chat(WP_REST_Request $request) {
    // Fail soft: any problem returns { reply: null } so the widget uses its free engine.
    $fallback = new WP_REST_Response(['reply' => null], 200);

    $key = zaki_ai_get_key();
    if ((int) get_option('zaki_ai_enabled', 0) !== 1 || $key === '') {
        return $fallback;
    }

    // Light per-IP rate limit: 20 requests / minute.
    $ip  = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    $tk  = 'zaki_rl_' . md5($ip);
    $hit = (int) get_transient($tk);
    if ($hit >= 20) { return $fallback; }
    set_transient($tk, $hit + 1, MINUTE_IN_SECONDS);

    $body = json_decode($request->get_body(), true);
    $lang = (isset($body['lang']) && $body['lang'] === 'ar') ? 'ar' : 'en';

    // Take only the conversation turns; never trust a client-sent system prompt.
    $turns = [];
    if (!empty($body['messages']) && is_array($body['messages'])) {
        foreach ($body['messages'] as $m) {
            $role = isset($m['role']) ? $m['role'] : '';
            if ($role !== 'user' && $role !== 'assistant') { continue; }
            $content = isset($m['content']) ? wp_strip_all_tags((string) $m['content']) : '';
            if ($content === '') { continue; }
            $turns[] = ['role' => $role, 'content' => mb_substr($content, 0, 800)];
        }
    }
    if (empty($turns)) { return $fallback; }
    $turns = array_slice($turns, -12); // last 12 turns is plenty of context

    $messages = array_merge(
        [['role' => 'system', 'content' => zaki_ai_system_prompt($lang)]],
        $turns
    );

    $response = wp_remote_post(ZAKI_AI_NANOGPT_URL, [
        'timeout' => 20,
        'headers' => [
            'Authorization' => 'Bearer ' . $key,
            'Content-Type'  => 'application/json',
        ],
        'body' => wp_json_encode([
            'model'       => zaki_ai_get_model(),
            'messages'    => $messages,
            'max_tokens'  => 400,
            'temperature' => 0.4,
        ]),
    ]);

    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        return $fallback;
    }

    $data  = json_decode(wp_remote_retrieve_body($response), true);
    $reply = isset($data['choices'][0]['message']['content'])
        ? trim((string) $data['choices'][0]['message']['content'])
        : '';

    if ($reply === '') { return $fallback; }
    return new WP_REST_Response(['reply' => $reply], 200);
}
