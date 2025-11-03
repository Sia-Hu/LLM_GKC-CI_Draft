<?php
// public_html/LLM_GKC-CI_Draft/api/index.php

// --- Optional debugging while you fix things (remove once stable) ---
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);

// --- CORS / content type ---
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// --- Paths ---
$APP_ROOT  = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/'); // e.g. /LLM_GKC-CI_Draft
$DATA_ROOT = realpath(__DIR__ . '/../data');                        // ../data under app
if (!$DATA_ROOT) { http_response_code(500); echo json_encode(['error'=>'data dir missing']); exit; }

// Ensure base data layout exists
@mkdir($DATA_ROOT, 0755, true);
@mkdir($DATA_ROOT . '/projects', 0755, true);
$POLICIES_JSON = $DATA_ROOT . '/policies.json';
if (!file_exists($POLICIES_JSON)) { file_put_contents($POLICIES_JSON, "{}"); @chmod($POLICIES_JSON, 0644); }

// --- Helpers ---
function ok($x){ echo json_encode($x, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT); }
function bad($code,$msg){ http_response_code($code); ok(['error'=>$msg]); exit; }
function safe($s){ return preg_replace('/[^a-zA-Z0-9\-_\. ]/', '_', $s); }
function jr($p){
  if (!file_exists($p)) return [];
  $raw = file_get_contents($p);
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}
function jw($p,$d){
  $tmp = $p . '.tmp';
  file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT), LOCK_EX);
  rename($tmp, $p);
  @chmod($p, 0644);
}
function in_root($path,$root){ $rp=realpath($path); return $rp && strncmp($rp,$root,strlen($root))===0; }
function list_files($dir){
  $out=[]; if (is_dir($dir)) foreach (scandir($dir) as $f){
    if($f==='.'||$f==='..') continue;
    $full="$dir/$f"; if(is_file($full)){
      $out[]=['name'=>$f,'size'=>filesize($full),'created'=>date(DATE_ATOM,filectime($full))];
    }
  } return $out;
}
function count_annotations($data){
  // Rough count that works for Label Studio exports
  if ($data === null) return 0;
  $n = 0;
  if (isset($data['annotations']) && is_array($data['annotations'])) {
    return count($data['annotations']);
  }
  if (is_array($data)) {
    // Array of tasks
    foreach ($data as $item) {
      if (isset($item['annotations']) && is_array($item['annotations'])) {
        $n += count($item['annotations']);
      } elseif (isset($item['result'])) {
        $n++; // fallback
      }
    }
  }
  return $n;
}

// --- Route parsing: supports ?route=... and /api/... forms ---
function detect_route(): string {
  if (isset($_GET['route'])) return ltrim($_GET['route'], '/');

  if (!empty($_SERVER['PATH_INFO'])) return ltrim($_SERVER['PATH_INFO'], '/');

  $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '';
  $pos = strpos($uri, '/api/');
  if ($pos !== false) {
    $r = substr($uri, $pos + 5); // after "/api/"
    return ltrim($r, '/');
  }
  return '';
}

$route  = detect_route();
$method = $_SERVER['REQUEST_METHOD'];

// ========== GET /api/policies  (return entire policies.json) ==========
if ($route === 'policies' && $method === 'GET') {
  if (!file_exists($POLICIES_JSON)) { ok((object)[]); exit; }
  readfile($POLICIES_JSON); exit;
}

// ========== GET /api/policies/{policy} (single policy metadata) ==========
if (preg_match('#^policies/([^/]+)$#', $route, $m) && $method === 'GET') {
  $policy = urldecode($m[1]);
  $pol = jr($POLICIES_JSON);
  if (!isset($pol[$policy])) bad(404, 'policy not found');
  ok($pol[$policy]); exit;
}

// ========== GET /api/stats (quick aggregate) ==========
if ($route === 'stats' && $method === 'GET') {
  $pol = jr($POLICIES_JSON);
  $names = array_keys($pol);
  $total = 0; $who = [];
  foreach ($pol as $pn => $pd) {
    $total += $pd['totalAnnotations'] ?? 0;
    if (!empty($pd['contributors'])) $who = array_merge($who, array_keys($pd['contributors']));
  }
  $who = array_values(array_unique($who));
  ok([
    'totalPolicies' => count($names),
    'totalContributors' => count($who),
    'totalAnnotations' => $total,
    'avgAnnotationsPerPolicy' => count($names) ? round($total / count($names)) : 0
  ]); exit;
}

// ========== GET /api/policies/{policy}/files (list saved files) ==========
if (preg_match('#^policies/([^/]+)/files$#', $route, $m) && $method === 'GET') {
  $policy = urldecode($m[1]);
  $dir = realpath($DATA_ROOT . "/projects/$policy");
  if (!$dir || !in_root($dir,$DATA_ROOT)) bad(404,'policy not found');
  ok([
    'policyName' => $policy,
    'directory'  => $APP_ROOT . '/data/projects/' . rawurlencode($policy),
    'files'      => list_files($dir)
  ]); exit;
}

// ========== GET /api/policy-file/{policy}/{file} (serve JSON content) ==========
if (preg_match('#^policy-file/([^/]+)/([^/]+)$#', $route, $m) && $method === 'GET') {
  $policy = urldecode($m[1]); $file = urldecode($m[2]);
  $path = realpath($DATA_ROOT . "/projects/$policy/$file");
  if (!$path || !in_root($path,$DATA_ROOT) || !is_file($path)) bad(404,'file not found');
  header('Content-Type: application/json');
  readfile($path); exit;
}

// ========== POST /api/upload (multipart form) ==========
if ($route === 'upload' && $method === 'POST') {
  if (!isset($_FILES['annotationFile'])) bad(400,'no file');

  $rawPolicy = $_POST['policyName'] ?? 'unassigned';
  $policy    = safe($rawPolicy); // stored key + folder name
  $student   = $_POST['studentName']  ?? 'Unknown';
  $email     = $_POST['studentEmail'] ?? '';
  $univ      = $_POST['university']   ?? '';

  $pdir = $DATA_ROOT . "/projects/$policy";
  @mkdir($pdir, 0755, true);

  $orig = $_FILES['annotationFile']['name'] ?? ('upload_' . time() . '.json');
  $save = time().'_'.safe($orig);
  $dest = $pdir . '/' . $save;

  if (!move_uploaded_file($_FILES['annotationFile']['tmp_name'], $dest)) {
    bad(500,'move failed');
  }
  @chmod($dest, 0644);

  $json = json_decode(file_get_contents($dest), true);
  $ann  = count_annotations($json);

  $pol = jr($POLICIES_JSON);
  if (!isset($pol[$policy])) {
    $pol[$policy] = [
      'displayName'      => $rawPolicy,      // keep original for UI
      'createdAt'        => date(DATE_ATOM),
      'contributors'     => [],
      'totalAnnotations' => 0
    ];
  }
  if (!isset($pol[$policy]['contributors'][$student])) {
    $pol[$policy]['contributors'][$student] = [
      'uploads'          => [],
      'email'            => $email,
      'university'       => $univ,
      'totalAnnotations' => 0
    ];
  }

  $pol[$policy]['contributors'][$student]['uploads'][] = [
    'filename'        => $orig,
    'storedAs'        => $save,
    'filePath'        => $dest,
    'annotationCount' => $ann,
    'uploadedAt'      => date(DATE_ATOM),
    'source'          => 'upload'
  ];
  $pol[$policy]['contributors'][$student]['totalAnnotations'] += $ann;
  $pol[$policy]['totalAnnotations'] += $ann;
  $pol[$policy]['lastUpdated'] = date(DATE_ATOM);

  jw($POLICIES_JSON, $pol);

  ok([
    'success'          => true,
    'policyName'       => $policy,      // sanitized name to be used in URLs
    'displayName'      => $rawPolicy,   // how the user typed it
    'annotationCount'  => $ann,
    'isNewPolicy'      => false
  ]); exit;
}

// ========== POST /api/upload-json (raw JSON in body) ==========
if ($route === 'upload-json' && $method === 'POST') {
  $body   = json_decode(file_get_contents('php://input'), true);
  if (!$body || !isset($body['jsonData'])) bad(400,'missing jsonData');

  $rawPolicy = $body['policyName'] ?? 'unassigned';
  $policy    = safe($rawPolicy);
  $student   = $body['studentName']  ?? 'Unknown';
  $email     = $body['studentEmail'] ?? '';
  $univ      = $body['university']   ?? '';

  $pdir = $DATA_ROOT . "/projects/$policy";
  @mkdir($pdir, 0755, true);

  $save = 'paste_' . time() . '.json';
  $dest = $pdir . '/' . $save;

  $json = json_decode($body['jsonData'], true);
  if ($json === null) bad(400,'invalid JSON');

  file_put_contents($dest, json_encode($json, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT), LOCK_EX);
  @chmod($dest, 0644);

  $ann  = count_annotations($json);

  $pol = jr($POLICIES_JSON);
  if (!isset($pol[$policy])) {
    $pol[$policy] = [
      'displayName'      => $rawPolicy,
      'createdAt'        => date(DATE_ATOM),
      'contributors'     => [],
      'totalAnnotations' => 0
    ];
  }
  if (!isset($pol[$policy]['contributors'][$student])) {
    $pol[$policy]['contributors'][$student] = [
      'uploads'          => [],
      'email'            => $email,
      'university'       => $univ,
      'totalAnnotations' => 0
    ];
  }

  $pol[$policy]['contributors'][$student]['uploads'][] = [
    'filename'        => $save,
    'storedAs'        => $save,
    'filePath'        => $dest,
    'annotationCount' => $ann,
    'uploadedAt'      => date(DATE_ATOM),
    'source'          => 'paste'
  ];
  $pol[$policy]['contributors'][$student]['totalAnnotations'] += $ann;
  $pol[$policy]['totalAnnotations'] += $ann;
  $pol[$policy]['lastUpdated'] = date(DATE_ATOM);

  jw($POLICIES_JSON, $pol);

  ok([
    'success'          => true,
    'policyName'       => $policy,
    'displayName'      => $rawPolicy,
    'annotationCount'  => $ann,
    'isNewPolicy'      => false
  ]); exit;
}

// ========== DELETE /api/policies/{policy} (remove folder + entry) ==========
if (preg_match('#^policies/([^/]+)$#', $route, $m) && $method === 'DELETE') {
  $policy = urldecode($m[1]);

  $dir = $DATA_ROOT . "/projects/$policy";
  if (is_dir($dir)) {
    foreach (scandir($dir) as $f) {
      if ($f==='.'||$f==='..') continue;
      @unlink("$dir/$f");
    }
    @rmdir($dir);
  }

  $pol = jr($POLICIES_JSON);
  if (isset($pol[$policy])) { unset($pol[$policy]); jw($POLICIES_JSON, $pol); }

  ok(['success'=>true]); exit;
}

// ========== DELETE /api/policies/{policy}/files/{file} (delete one file) ==========
if (preg_match('#^policies/([^/]+)/files/([^/]+)$#', $route, $m) && $method === 'DELETE') {
  $policy = urldecode($m[1]); $file = urldecode($m[2]);
  $path = $DATA_ROOT . "/projects/$policy/$file";
  if (!is_file($path)) bad(404,'file not found');

  // Try to decrement counts using policies.json
  $pol = jr($POLICIES_JSON);
  if (isset($pol[$policy]['contributors'])) {
    foreach ($pol[$policy]['contributors'] as $name => &$c) {
      foreach ($c['uploads'] as $idx => $u) {
        if (($u['storedAs'] ?? '') === $file) {
          $ann = $u['annotationCount'] ?? 0;
          unset($c['uploads'][$idx]);
          $pol[$policy]['totalAnnotations'] = max(0, ($pol[$policy]['totalAnnotations'] ?? 0) - $ann);
          $c['totalAnnotations'] = max(0, ($c['totalAnnotations'] ?? 0) - $ann);
          $pol[$policy]['lastUpdated'] = date(DATE_ATOM);
          break 2;
        }
      }
    }
  }
  jw($POLICIES_JSON, $pol);

  @unlink($path);
  ok(['success'=>true]); exit;
}

// --- Fallback ---
bad(404,'unknown route');
