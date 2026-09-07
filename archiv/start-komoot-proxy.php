<?php
declare(strict_types=1);

function env_value(string $key, mixed $default = null): mixed
{
    $value = $_SERVER[$key] ?? getenv($key);
    return $value !== false && $value !== null ? $value : $default;
}

$mode = (string) env_value('KOMOOT_PROXY_MODE', 'real');
$debug = in_array(strtolower((string) env_value('KOMOOT_PROXY_DEBUG', '0')), ['1', 'true', 'yes', 'on'], true);
$timezone = (string) env_value('KOMOOT_PROXY_TIMEZONE', 'Europe/Berlin');
$rootDir = __DIR__;
$sessionFile = (string) env_value('KOMOOT_PROXY_SESSION_FILE', $rootDir . DIRECTORY_SEPARATOR . 'artifacts' . DIRECTORY_SEPARATOR . 'komoot-proxy-session.json');
$allowedOrigins = array_values(array_filter(array_map('trim', explode(',', (string) env_value('KOMOOT_PROXY_ALLOWED_ORIGINS', 'http://localhost:5000,http://127.0.0.1:5000,https://marsrakete.github.io')))));

date_default_timezone_set($timezone);

if (!is_dir(dirname($sessionFile))) {
    mkdir(dirname($sessionFile), 0777, true);
}

function log_debug(string $message, string $level = 'INFO'): void
{
    global $debug, $timezone;
    if (!$debug) {
        return;
    }
    $timestamp = (new DateTimeImmutable('now', new DateTimeZone($timezone)))->format('Y-m-d H:i:s');
    error_log(sprintf('[%s] [%s] %s', $timestamp, $level, $message));
}

function debug_json_sample(array $items): string
{
    $sample = array_slice($items, 0, 2);
    if ($sample === []) {
        return '[]';
    }
    $json = json_encode($sample, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return $json !== false ? $json : '[unserializable sample]';
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . cors_origin());
    header('Access-Control-Allow-Headers: ' . ($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? 'Content-Type'));
    header('Access-Control-Allow-Methods: ' . ($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'] ?? 'GET, POST, OPTIONS'));
    header('Access-Control-Allow-Private-Network: true');
    header('Vary: Origin, Access-Control-Request-Headers, Access-Control-Request-Method');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function cors_origin(): string
{
    global $allowedOrigins;
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        return $origin;
    }
    return $allowedOrigins[0] ?? '*';
}

function normalized_request_path(): string
{
    $path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/');
    if ($path === '') {
        $path = '/';
    }

    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    if ($scriptName !== '' && str_starts_with($path, $scriptName)) {
        $path = substr($path, strlen($scriptName));
        $path = $path === false || $path === '' ? '/' : $path;
    }

    $scriptBase = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
    if ($scriptBase !== '' && $scriptBase !== '.' && str_starts_with($path, $scriptBase . '/')) {
        $path = substr($path, strlen($scriptBase));
        $path = $path === false || $path === '' ? '/' : $path;
    }

    return rtrim($path, '/') ?: '/';
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    return $raw !== '' ? (json_decode($raw, true) ?: []) : [];
}

function load_proxy_session(): array
{
    global $sessionFile;
    if (!is_file($sessionFile)) {
        return ['loggedIn' => false, 'userId' => null, 'token' => null, 'user' => null];
    }
    $data = json_decode((string) file_get_contents($sessionFile), true);
    return is_array($data) ? $data : ['loggedIn' => false, 'userId' => null, 'token' => null, 'user' => null];
}

function save_proxy_session(array $session): void
{
    global $sessionFile;
    file_put_contents($sessionFile, json_encode($session, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function reset_proxy_session(): array
{
    $session = ['loggedIn' => false, 'userId' => null, 'token' => null, 'user' => null];
    save_proxy_session($session);
    return $session;
}

function basic_auth_headers(string $user, string $password): array
{
    return ['Authorization: Basic ' . base64_encode($user . ':' . $password)];
}

/**
 * Maps known upstream client errors to their original HTTP response status.
 *
 * @param Throwable $error The exception raised while handling a proxy request.
 * @return int The HTTP status sent back to the browser.
 */
function proxy_error_status(Throwable $error): int
{
    $message = $error->getMessage();
    if ($message === 'Not logged in') {
        return 401;
    }
    if (preg_match('/^HTTP (4\\d\\d)$/', $message, $matches)) {
        return (int) $matches[1];
    }
    return 500;
}

function request_json(string $url, array $headers = []): array
{
    log_debug("Upstream GET $url");
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_FAILONERROR => false,
        CURLOPT_USERAGENT => 'TrailCanvas-Komoot-Proxy-PHP',
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false || $error !== '') {
        log_debug("Upstream failed for $url :: $error", 'ERROR');
        throw new RuntimeException($error !== '' ? $error : 'HTTP request failed');
    }
    if ($status >= 400) {
        log_debug("Upstream failed for $url :: HTTP $status", 'ERROR');
        throw new RuntimeException("HTTP $status");
    }
    log_debug("Upstream OK $url", 'OK');
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid JSON response');
    }
    return $decoded;
}

function request_binary(string $url, array $headers = []): ?array
{
    log_debug("Upstream BINARY GET $url");
    $responseHeaders = [];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_FAILONERROR => false,
        CURLOPT_USERAGENT => 'TrailCanvas-Komoot-Proxy-PHP',
        CURLOPT_HEADERFUNCTION => static function ($curl, string $headerLine) use (&$responseHeaders): int {
            $length = strlen($headerLine);
            $parts = explode(':', $headerLine, 2);
            if (count($parts) === 2) {
                $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return $length;
        },
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false || $error !== '' || $status >= 400) {
        $message = $error !== '' ? $error : "HTTP $status";
        log_debug("Upstream BINARY failed for $url :: $message", 'WARN');
        return null;
    }

    log_debug("Upstream BINARY OK $url", 'OK');
    return ['body' => $body, 'headers' => $responseHeaders];
}

function first_text(...$values): ?string
{
    foreach ($values as $value) {
        if ($value === null) {
            continue;
        }
        if (is_array($value) || is_object($value)) {
            continue;
        }
        $text = trim((string) $value);
        if ($text !== '') {
            return $text;
        }
    }
    return null;
}

function komoot_object_property($value, string $key): mixed
{
    if (!is_array($value)) {
        return null;
    }
    return $value[$key] ?? null;
}

function komoot_embedded_items(mixed $value): array
{
    if ($value === null) {
        return [];
    }
    if (is_string($value)) {
        $text = trim($value);
        return $text === '' ? [] : [$text];
    }
    if (is_array($value)) {
        foreach (['items', 'segments', 'elements', 'results', 'values', 'data', 'collection'] as $key) {
            if (array_key_exists($key, $value)) {
                return komoot_embedded_items($value[$key]);
            }
        }
        $looksLikeItem = array_key_exists('name', $value)
            || array_key_exists('type', $value)
            || array_key_exists('instruction', $value)
            || array_key_exists('distance', $value)
            || array_key_exists('segment_length', $value);
        if ($looksLikeItem) {
            return [$value];
        }
        $items = [];
        foreach ($value as $entry) {
            $items = array_merge($items, komoot_embedded_items($entry));
        }
        return $items;
    }
    return [$value];
}

function normalize_photo_url(?string $url): ?string
{
    if ($url === null) {
        return null;
    }
    $value = trim($url);
    if ($value === '') {
        return null;
    }
    $value = str_replace(['{width}', '{height}', '{crop}'], ['960', '720', 'true'], $value);
    return $value;
}

function inline_photo_from_url(string $url, ?string $title = null, array $headers = []): ?array
{
    $normalized = normalize_photo_url($url);
    if ($normalized === null) {
        return null;
    }
    $response = request_binary($normalized, preg_match('#^https?://api\.komoot\.de/#i', $normalized) ? $headers : []);
    if ($response === null) {
        return null;
    }
    $contentType = $response['headers']['content-type'] ?? '';
    if (!preg_match('#^image/#i', $contentType)) {
        return null;
    }
    return [
        'url' => 'data:' . $contentType . ';base64,' . base64_encode($response['body']),
        'title' => first_text($title),
    ];
}

function cover_image_candidates(array $items): array
{
    $candidates = [];
    foreach ($items as $index => $item) {
        $fields = array_keys($item);
        log_debug('cover_images[' . $index . '] fields: ' . implode(', ', $fields));
        if (isset($item['src'])) {
            log_debug('cover_images[' . $index . '] urls: src=' . $item['src']);
        }
        if (array_key_exists('location', $item)) {
            log_debug('cover_images[' . $index . '] location: ' . json_encode($item['location'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }
        if (array_key_exists('line_location', $item)) {
            log_debug('cover_images[' . $index . '] line_location: ' . json_encode($item['line_location'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        if (!isset($item['src']) || !is_string($item['src'])) {
            continue;
        }
        $candidates[] = [
            'url' => $item['src'],
            'title' => first_text($item['title'] ?? null, $item['caption'] ?? null, $item['name'] ?? null),
        ];
    }
    return $candidates;
}

function real_login(string $email, string $password): array
{
    $response = request_json('https://api.komoot.de/v006/account/email/' . rawurlencode($email) . '/', basic_auth_headers($email, $password));
    return [
        'id' => (string) ($response['username'] ?? ''),
        'name' => $response['user']['displayname'] ?? explode('@', $email)[0],
        'email' => $email,
        'token' => (string) ($response['password'] ?? ''),
    ];
}

function ensure_logged_in(array $session): void
{
    if (empty($session['loggedIn'])) {
        throw new RuntimeException('Not logged in');
    }
}

function real_tour_map(array $session): array
{
    $headers = basic_auth_headers((string) $session['userId'], (string) $session['token']);
    $currentUrl = 'https://api.komoot.de/v007/users/' . rawurlencode((string) $session['userId']) . '/tours/';
    $results = [];

    while ($currentUrl) {
        $response = request_json($currentUrl, $headers);
        foreach (($response['_embedded']['tours'] ?? []) as $tour) {
            $results[(string) $tour['id']] = $tour;
        }
        $currentUrl = $response['_links']['next']['href'] ?? null;
    }

    return $results;
}

function tour_summary(array $tour): array
{
    return [
        'id' => (string) ($tour['id'] ?? ''),
        'name' => $tour['name'] ?? 'Tour',
        'sport' => $tour['sport'] ?? null,
        'type' => $tour['type'] ?? 'tour_recorded',
        'distanceKm' => round(((float) ($tour['distance'] ?? 0)) / 1000, 1),
        'date' => !empty($tour['date']) ? (new DateTimeImmutable($tour['date']))->format('Y-m-d') : null,
    ];
}

function real_tour_detail(array $session, string $tourId, string $language): array
{
    $headers = basic_auth_headers((string) $session['userId'], (string) $session['token']);
    $url = 'https://api.komoot.de/v007/tours/' . rawurlencode($tourId) . '?_embedded=coordinates,way_types,surfaces,directions,participants,timeline&hl=' . rawurlencode($language) . '&directions=v2&fields=timeline&format=coordinate_array&timeline_highlights_fields=tips,recommenders';
    return request_json($url, $headers);
}

function real_cover_images(array $session, string $tourId): array
{
    $headers = basic_auth_headers((string) $session['userId'], (string) $session['token']);
    $currentUrl = 'https://api.komoot.de/v007/tours/' . rawurlencode($tourId) . '/cover_images/';
    $items = [];

    while ($currentUrl) {
        $response = request_json($currentUrl, $headers);
        $pageItems = $response['_embedded']['items'] ?? [];
        log_debug('cover_images page loaded: ' . count($pageItems) . ' item(s) for tour ' . $tourId, 'OK');
        $items = array_merge($items, $pageItems);
        $currentUrl = $response['_links']['next']['href'] ?? null;
    }

    return $items;
}

function description_locale(string $language): array
{
    if (str_starts_with($language, 'de')) {
        return ['locale' => 'de_DE', 'distance' => 'Distanz', 'duration' => 'Geschätzte Dauer', 'up' => 'Höhenmeter bergauf', 'down' => 'Höhenmeter bergab'];
    }
    if (str_starts_with($language, 'fr')) {
        return ['locale' => 'fr_FR', 'distance' => 'Distance', 'duration' => 'Duree estimee', 'up' => 'Denivele positif', 'down' => 'Denivele negatif'];
    }
    return ['locale' => 'en_US', 'distance' => 'Distance', 'duration' => 'Estimated duration', 'up' => 'Elevation up', 'down' => 'Elevation down'];
}

function tour_description(array $tour, string $language): string
{
    $locale = description_locale($language);
    $distanceKm = number_format(((float) ($tour['distance'] ?? 0)) / 1000, 2, '.', '');
    $durationHours = number_format(((float) ($tour['duration'] ?? 0)) / 3600, 2, '.', '');
    $elevationUp = number_format((float) ($tour['elevation_up'] ?? 0), 0, '.', '');
    $elevationDown = number_format((float) ($tour['elevation_down'] ?? 0), 0, '.', '');
    return first_text(
        $tour['description'] ?? null,
        $tour['subtitle'] ?? null,
        $tour['summary'] ?? null,
        sprintf('%s: %s km, %s: %s h, %s: %s m, %s: %s m', $locale['distance'], $distanceKm, $locale['duration'], $durationHours, $locale['up'], $elevationUp, $locale['down'], $elevationDown)
    ) ?? 'Tour';
}

function xml_escape(?string $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_XML1 | ENT_COMPAT, 'UTF-8');
}

function format_track_points_xml(array $items): string
{
    $rows = [];
    foreach ($items as $item) {
        $lat = (string) ($item['lat'] ?? '');
        $lng = (string) ($item['lng'] ?? '');
        $row = '<trkpt lat="' . $lat . '" lon="' . $lng . '">';
        if (isset($item['alt'])) {
            $row .= '<ele>' . $item['alt'] . '</ele>';
        }
        if (isset($item['t'])) {
            $time = (int) $item['t'];
            $dt = abs($time) < 100000000000
                ? (new DateTimeImmutable('@' . $time))->setTimezone(new DateTimeZone('UTC'))
                : (new DateTimeImmutable('@' . (int) floor($time / 1000)))->setTimezone(new DateTimeZone('UTC'));
            $row .= '<time>' . $dt->format('Y-m-d\TH:i:s\Z') . '</time>';
        }
        $row .= '</trkpt>';
        $rows[] = $row;
    }
    return implode("\n      ", $rows);
}

function convert_tour_to_gpx(array $tour, string $language): string
{
    $title = xml_escape((string) ($tour['name'] ?? 'Tour'));
    $description = xml_escape(tour_description($tour, $language));
    $creatorName = xml_escape((string) ($tour['_embedded']['creator']['display_name'] ?? 'Komoot'));
    $creatorUser = xml_escape((string) ($tour['_embedded']['creator']['username'] ?? ''));
    $tourLink = 'https://www.komoot.de/tour/' . ($tour['id'] ?? '');
    $trackPoints = format_track_points_xml($tour['_embedded']['coordinates']['items'] ?? []);

    return <<<GPX
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailCanvas Komoot Proxy PHP" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>{$title}</name>
    <desc>{$description}</desc>
    <author>
      <name>{$creatorName}</name>
      <link href="https://www.komoot.de/user/{$creatorUser}">
        <text>Komoot profile</text>
      </link>
    </author>
    <link href="{$tourLink}">
      <text>Komoot tour</text>
    </link>
  </metadata>
  <trk>
    <name>{$title}</name>
    <desc>{$description}</desc>
    <trkseg>
      {$trackPoints}
    </trkseg>
  </trk>
</gpx>
GPX;
}

$demoTours = [
    ['id' => 'komoot-demo-1', 'name' => 'Isar Riverside Loop', 'sport' => 'bike', 'type' => 'tour_recorded', 'distanceKm' => 28.4, 'date' => '2026-04-21', 'description' => 'Lockere Feierabendrunde entlang der Isar.', 'photos' => []],
    ['id' => 'komoot-demo-2', 'name' => 'Vosges Morning Hike', 'sport' => 'hike', 'type' => 'tour_planned', 'distanceKm' => 14.2, 'date' => '2026-03-18', 'description' => 'Geplante Morgenwanderung.', 'photos' => []],
];

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    json_response(['ok' => true, 'mode' => $mode]);
}

$path = normalized_request_path();
log_debug('Incoming ' . $_SERVER['REQUEST_METHOD'] . ' ' . $path);

try {
    $session = load_proxy_session();

    switch ($path) {
        case '/api/komoot/health':
            json_response(['ok' => true, 'mode' => $mode, 'running' => true, 'serverTime' => gmdate('c')]);
            break;

        case '/api/komoot/status':
            json_response(['ok' => true, 'mode' => $mode, 'loggedIn' => (bool) ($session['loggedIn'] ?? false), 'user' => $session['user'] ?? null]);
            break;

        case '/api/komoot/login':
            $body = read_json_body();
            if (empty($body['email']) || empty($body['password'])) {
                throw new RuntimeException('Email and password are required');
            }
            if ($mode === 'stub') {
                $user = ['id' => 'stub-user-1', 'name' => explode('@', (string) $body['email'])[0], 'email' => (string) $body['email'], 'token' => 'stub-token'];
            } else {
                $user = real_login((string) $body['email'], (string) $body['password']);
            }
            $session = ['loggedIn' => true, 'userId' => $user['id'], 'token' => $user['token'], 'user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']]];
            save_proxy_session($session);
            json_response(['ok' => true, 'mode' => $mode, 'user' => $session['user']]);
            break;

        case '/api/komoot/logout':
            reset_proxy_session();
            json_response(['ok' => true, 'mode' => $mode]);
            break;

        case '/api/komoot/tours':
            ensure_logged_in($session);
            if ($mode === 'stub') {
                json_response(['ok' => true, 'mode' => $mode, 'tours' => $demoTours]);
            }
            $tours = array_values(array_map('tour_summary', real_tour_map($session)));
            usort($tours, static fn(array $a, array $b): int => strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? '')));
            json_response(['ok' => true, 'mode' => $mode, 'tours' => $tours]);
            break;

        case '/api/komoot/import':
            ensure_logged_in($session);
            $body = read_json_body();
            $tourIds = array_values(array_map('strval', $body['tourIds'] ?? []));
            $language = (string) ($body['language'] ?? 'en');
            $items = [];

            if ($mode === 'stub') {
                foreach ($demoTours as $tour) {
                    if (!in_array($tour['id'], $tourIds, true)) {
                        continue;
                    }
                    $items[] = [
                        'id' => $tour['id'],
                        'fileName' => $tour['name'] . '-' . $tour['id'] . '.gpx',
                        'gpx' => convert_tour_to_gpx([
                            'id' => $tour['id'],
                            'name' => $tour['name'],
                            'distance' => $tour['distanceKm'] * 1000,
                            'duration' => 0,
                            'elevation_up' => 0,
                            'elevation_down' => 0,
                            '_embedded' => ['creator' => ['display_name' => 'Stub', 'username' => 'stub'], 'coordinates' => ['items' => [['lat' => 48.14, 'lng' => 11.55], ['lat' => 48.13, 'lng' => 11.58]]]],
                        ], $language),
                        'description' => $tour['description'],
                        'photos' => [],
                        'dateStart' => $tour['date'],
                        'durationHours' => null,
                        'sport' => $tour['sport'],
                        'surfaces' => [],
                        'wayTypes' => [],
                    ];
                }
                json_response(['ok' => true, 'mode' => $mode, 'items' => $items]);
            }

            $headers = basic_auth_headers((string) $session['userId'], (string) $session['token']);
            foreach ($tourIds as $tourId) {
                $tour = real_tour_detail($session, $tourId, $language);
                $coverImages = real_cover_images($session, $tourId);
                $photoCandidates = cover_image_candidates($coverImages);
                $surfaceItems = komoot_embedded_items($tour['_embedded']['surfaces'] ?? null);
                $wayTypeItems = komoot_embedded_items($tour['_embedded']['way_types'] ?? null);
                $directionItems = komoot_embedded_items($tour['_embedded']['directions'] ?? null);
                $photos = [];
                $seen = [];
                foreach ($photoCandidates as $candidate) {
                    $candidateUrl = $candidate['url'];
                    if (isset($seen[$candidateUrl])) {
                        continue;
                    }
                    $seen[$candidateUrl] = true;
                    $inline = inline_photo_from_url($candidateUrl, $candidate['title'], $headers);
                    if ($inline !== null) {
                        $photos[] = $inline;
                    }
                    if (count($photos) >= 6) {
                        break;
                    }
                }

                $items[] = [
                    'id' => (string) ($tour['id'] ?? $tourId),
                    'fileName' => ($tour['name'] ?? 'tour') . '-' . ($tour['id'] ?? $tourId) . '.gpx',
                    'gpx' => convert_tour_to_gpx($tour, $language),
                    'description' => tour_description($tour, $language),
                    'photos' => $photos,
                    'dateStart' => !empty($tour['date']) ? (new DateTimeImmutable($tour['date']))->format('Y-m-d') : null,
                    'durationHours' => !empty($tour['duration']) ? round(((float) $tour['duration']) / 3600, 1) : null,
                    'sport' => $tour['sport'] ?? null,
                    'surfaces' => array_values(array_unique(array_filter(array_map(static fn($item) => is_array($item) ? ($item['name'] ?? $item['type'] ?? $item['label'] ?? $item['surface'] ?? $item['surface_type'] ?? (!empty($item['element']) ? preg_replace('/^[a-z]+#/', '', (string) $item['element']) : null) ?? $item['slug'] ?? $item['value'] ?? null) : $item, $surfaceItems)))),
                    'surfaceSegments' => array_values(array_filter(array_map(static function ($item) {
                        if (!is_array($item)) {
                            return null;
                        }
                        $value = $item['name'] ?? $item['type'] ?? $item['label'] ?? $item['surface'] ?? $item['surface_type'] ?? (!empty($item['element']) ? preg_replace('/^[a-z]+#/', '', (string) $item['element']) : null) ?? $item['slug'] ?? $item['value'] ?? null;
                        if (!isset($item['from'], $item['to']) || $value === null || $value === '') {
                            return null;
                        }
                        return [
                            'from' => (int) $item['from'],
                            'to' => (int) $item['to'],
                            'value' => (string) $value,
                            'raw' => !empty($item['element']) ? (string) $item['element'] : (string) $value,
                        ];
                    }, $surfaceItems))),
                    'wayTypes' => array_values(array_unique(array_filter(array_map(static fn($item) => is_array($item) ? ($item['name'] ?? $item['type'] ?? $item['label'] ?? $item['way_type'] ?? $item['wayType'] ?? (!empty($item['element']) ? preg_replace('/^[a-z]+#/', '', (string) $item['element']) : null) ?? $item['slug'] ?? $item['value'] ?? null) : $item, $wayTypeItems)))),
                    'wayTypeSegments' => array_values(array_filter(array_map(static function ($item) {
                        if (!is_array($item)) {
                            return null;
                        }
                        $value = $item['name'] ?? $item['type'] ?? $item['label'] ?? $item['way_type'] ?? $item['wayType'] ?? (!empty($item['element']) ? preg_replace('/^[a-z]+#/', '', (string) $item['element']) : null) ?? $item['slug'] ?? $item['value'] ?? null;
                        if (!isset($item['from'], $item['to']) || $value === null || $value === '') {
                            return null;
                        }
                        return [
                            'from' => (int) $item['from'],
                            'to' => (int) $item['to'],
                            'value' => (string) $value,
                            'raw' => !empty($item['element']) ? (string) $item['element'] : (string) $value,
                        ];
                    }, $wayTypeItems))),
                    'directions' => array_values(array_filter(array_map(static function ($item) {
                        if (!is_array($item)) {
                            return null;
                        }
                        return [
                            'instruction' => $item['instruction'] ?? $item['text'] ?? $item['name'] ?? $item['title'] ?? null,
                            'distanceM' => isset($item['distance']) ? (float) $item['distance'] : (isset($item['segment_length']) ? (float) $item['segment_length'] : (isset($item['length']) ? (float) $item['length'] : null)),
                            'type' => $item['type'] ?? $item['_type'] ?? $item['icon'] ?? null,
                        ];
                    }, $directionItems))),
                ];
                if (!$surfaceItems) {
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' returned no surfaces from Komoot', 'INFO');
                } else {
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' surfaces: ' . count($surfaceItems) . ' item(s)', 'INFO');
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' surfaces raw sample: ' . debug_json_sample($surfaceItems), 'INFO');
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' surfaces mapped sample: ' . debug_json_sample($items[array_key_last($items)]['surfaces'] ?? []), 'INFO');
                }
                if (!$wayTypeItems) {
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' returned no way_types from Komoot', 'INFO');
                } else {
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' way_types: ' . count($wayTypeItems) . ' item(s)', 'INFO');
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' way_types raw sample: ' . debug_json_sample($wayTypeItems), 'INFO');
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' way_types mapped sample: ' . debug_json_sample($items[array_key_last($items)]['wayTypes'] ?? []), 'INFO');
                }
                if (!$directionItems) {
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' returned no directions from Komoot', 'INFO');
                } else {
                    log_debug('Tour ' . ($tour['id'] ?? $tourId) . ' directions: ' . count($directionItems) . ' item(s)', 'INFO');
                }
            }

            log_debug('Import generated ' . count($items) . ' GPX item(s)', 'OK');
            json_response(['ok' => true, 'mode' => $mode, 'items' => $items]);
            break;

        default:
            json_response(['ok' => false, 'mode' => $mode, 'error' => 'Not found'], 404);
    }
} catch (Throwable $e) {
    log_debug('Request failed on ' . $path . ' :: ' . $e->getMessage(), 'ERROR');
    json_response(['ok' => false, 'mode' => $mode, 'error' => $e->getMessage()], proxy_error_status($e));
}
