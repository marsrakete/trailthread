param(
  [int]$Port = 8787,
  [ValidateSet("real", "stub")]
  [string]$Mode = "real",
  [switch]$DebugLog
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$script:ShouldStop = $false

$cancelHandler = [ConsoleCancelEventHandler]{
  param($Sender, $EventArgs)
  $EventArgs.Cancel = $true
  $script:ShouldStop = $true
  Write-Host ""
  Write-Host "Beende TrailCanvas Komoot Proxy..." -ForegroundColor Yellow
}

[Console]::TreatControlCAsInput = $false
[Console]::add_CancelKeyPress($cancelHandler)

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

$session = @{
  LoggedIn = $false
  UserId = $null
  Token = $null
  User = $null
}

function Write-DebugLog([string]$Message, [string]$Level = "INFO") {
  if (-not $DebugLog) {
    return
  }

  $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $color = switch ($Level) {
    "ERROR" { "Red" }
    "WARN" { "Yellow" }
    "OK" { "Green" }
    default { "DarkGray" }
  }
  Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Set-CorsHeaders($Response, $Request) {
  $origin = $Request.Headers["Origin"]
  if ($origin -match '^https?://(localhost|127\.0\.0\.1)(:\d+)?$') {
    $Response.Headers["Access-Control-Allow-Origin"] = $origin
  } else {
    $Response.Headers["Access-Control-Allow-Origin"] = "http://localhost:5000"
  }

  $requestedHeaders = $Request.Headers["Access-Control-Request-Headers"]
  if ([string]::IsNullOrWhiteSpace($requestedHeaders)) {
    $requestedHeaders = "Content-Type"
  }

  $requestedMethod = $Request.Headers["Access-Control-Request-Method"]
  if ([string]::IsNullOrWhiteSpace($requestedMethod)) {
    $requestedMethod = "GET, POST, OPTIONS"
  } else {
    $requestedMethod = "$requestedMethod, OPTIONS"
  }

  $Response.Headers["Access-Control-Allow-Headers"] = $requestedHeaders
  $Response.Headers["Access-Control-Allow-Methods"] = $requestedMethod
  $Response.Headers["Access-Control-Allow-Private-Network"] = "true"
  $Response.Headers["Vary"] = "Origin, Access-Control-Request-Headers, Access-Control-Request-Method"
}

$demoTours = @(
  @{ id = "komoot-demo-1"; name = "Isar Riverside Loop"; sport = "bike"; type = "tour_recorded"; distanceKm = 28.4; date = "2026-04-21"; description = "Lockere Feierabendrunde entlang der Isar mit kurzen Stadtpassagen und flotten Uferabschnitten."; photos = @(@{ url = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=80"; title = "Isar riverside" }) },
  @{ id = "komoot-demo-2"; name = "Vosges Morning Hike"; sport = "hike"; type = "tour_planned"; distanceKm = 14.2; date = "2026-03-18"; description = "Geplante Morgenwanderung mit Waldpfaden, Aussichtspunkt und ruhigem Schlussanstieg."; photos = @(@{ url = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=640&q=80"; title = "Vosges trail" }) },
  @{ id = "komoot-demo-3"; name = "Lakeside Tempo Ride"; sport = "road_bike"; type = "tour_recorded"; distanceKm = 61.7; date = "2026-02-07"; description = "Schnelle Seerunde mit langen Geraden, wenig Ampeln und offenem Blick aufs Wasser."; photos = @(@{ url = "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=640&q=80"; title = "Road ride" }) }
)

function ConvertTo-JsonBytes($Object) {
  [System.Text.Encoding]::UTF8.GetBytes(($Object | ConvertTo-Json -Depth 12))
}

function Read-BodyText($Request) {
  $reader = [System.IO.StreamReader]::new($Request.InputStream, $Request.ContentEncoding)
  try {
    $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Write-JsonResponse($Context, $Object, [int]$StatusCode = 200) {
  $bytes = ConvertTo-JsonBytes $Object
  Write-DebugLog "Response $StatusCode for $($Context.Request.HttpMethod) $($Context.Request.Url.AbsolutePath)"
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = "application/json; charset=utf-8"
  $Context.Response.ContentLength64 = $bytes.Length
  Set-CorsHeaders -Response $Context.Response -Request $Context.Request
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function New-BasicAuthHeader([string]$User, [string]$Password) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes("$User`:$Password")
  @{
    Authorization = "Basic $([Convert]::ToBase64String($bytes))"
  }
}

function Invoke-KomootApi([string]$Url, [hashtable]$Headers = @{}) {
  Write-DebugLog "Upstream GET $Url"
  try {
    $result = Invoke-RestMethod -Uri $Url -Headers $Headers -Method Get
    Write-DebugLog "Upstream OK $Url" "OK"
    return $result
  } catch {
    Write-DebugLog "Upstream failed for $Url :: $($_.Exception.Message)" "ERROR"
    throw
  }
}

function Escape-Xml([string]$Value) {
  if ($null -eq $Value) {
    return ""
  }
  return [System.Security.SecurityElement]::Escape([string]$Value)
}

function Get-FirstNonEmptyText($Values) {
  foreach ($Value in $Values) {
    if ($null -eq $Value) {
      continue
    }
    if ($Value -is [System.Collections.IDictionary]) {
      continue
    }
    if (($Value -is [psobject]) -and -not ($Value -is [string]) -and @($Value.PSObject.Properties).Count) {
      continue
    }
    if (($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])) {
      continue
    }
    $text = ([string]$Value).Trim()
    if ($text) {
      return $text
    }
  }
  return $null
}

function Add-PhotoCandidate([hashtable]$Map, [string]$Url, [string]$Title = $null) {
  if ([string]::IsNullOrWhiteSpace($Url) -or $Url -notmatch '^https?://') {
    return
  }
  if (-not $Map.ContainsKey($Url)) {
    $Map[$Url] = @{
      url = $Url
      title = if ([string]::IsNullOrWhiteSpace($Title)) { $null } else { $Title.Trim() }
    }
  }
}

function Add-PhotoCandidatesFromNode($Node, [string]$Path, [hashtable]$Map) {
  if ($null -eq $Node) {
    return
  }

  if ($Node -is [string]) {
    if ($Path -match '(photo|image|picture|gallery|cover|avatar|thumbnail|timeline)') {
      Add-PhotoCandidate -Map $Map -Url $Node
    }
    return
  }

  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [hashtable]) -and -not ($Node -is [pscustomobject])) {
    foreach ($Item in $Node) {
      Add-PhotoCandidatesFromNode -Node $Item -Path $Path -Map $Map
    }
    return
  }

  $properties = @($Node.PSObject.Properties)
  if (-not $properties.Count) {
    return
  }

  $propertyNames = $properties.Name
  $looksLikeMediaNode = $Path -match '(photo|image|picture|gallery|cover|avatar|thumbnail|timeline)' -or ($propertyNames -match '^(url|src|href|image|photo|picture|large|medium|small|thumb|thumbnail)$').Count -gt 0
  if ($looksLikeMediaNode) {
    $title = Get-FirstNonEmptyText @($Node.title, $Node.name, $Node.caption, $Node.text, $Node.label)
    foreach ($key in @('url', 'src', 'href', 'thumb', 'thumbnail', 'large', 'medium', 'small')) {
      $value = $Node.$key
      if ($value -is [string]) {
        Add-PhotoCandidate -Map $Map -Url $value -Title $title
      }
    }
    foreach ($key in @('image', 'photo', 'picture')) {
      $value = $Node.$key
      if ($value -is [string]) {
        Add-PhotoCandidate -Map $Map -Url $value -Title $title
      }
    }
  }

  foreach ($property in $properties) {
    Add-PhotoCandidatesFromNode -Node $property.Value -Path "$Path.$($property.Name)" -Map $Map
  }
}

function Get-TourPhotos($Tour) {
  $map = @{}
  Add-PhotoCandidatesFromNode -Node $Tour -Path "tour" -Map $map
  @($map.Values)
}

function Get-DebugFieldPreview($Node) {
  if ($null -eq $Node) {
    return @()
  }

  @($Node.PSObject.Properties.Name | Sort-Object -Unique)
}

function Write-CoverImageDebug($Items) {
  if (-not $DebugLog) {
    return
  }

  $index = 0
  foreach ($item in @($Items)) {
    $fields = Get-DebugFieldPreview $item
    $urlCandidates = @()
    foreach ($key in @('url', 'src', 'href', 'thumb', 'thumbnail', 'small', 'medium', 'large', 'full', 'image', 'photo', 'picture')) {
      $value = $item.$key
      if ($value -is [string] -and $value -match '^https?://') {
        $urlCandidates += "${key}=$value"
      }
    }

    foreach ($property in @($item.PSObject.Properties)) {
      if ($property.Value -is [pscustomobject] -or $property.Value -is [hashtable]) {
        foreach ($nestedKey in @('url', 'src', 'href', 'small', 'medium', 'large', 'full')) {
          $nestedValue = $property.Value.$nestedKey
          if ($nestedValue -is [string] -and $nestedValue -match '^https?://') {
            $urlCandidates += "$($property.Name).${nestedKey}=$nestedValue"
          }
        }
      }
    }

    Write-DebugLog "cover_images[$index] fields: $($fields -join ', ')" "INFO"
    if ($urlCandidates.Count) {
      Write-DebugLog "cover_images[$index] urls: $($urlCandidates -join ' | ')" "INFO"
    }
    if ($null -ne $item.location) {
      Write-DebugLog "cover_images[$index] location: $(($item.location | ConvertTo-Json -Depth 6 -Compress))" "INFO"
    }
    if ($null -ne $item.line_location) {
      Write-DebugLog "cover_images[$index] line_location: $(($item.line_location | ConvertTo-Json -Depth 6 -Compress))" "INFO"
    }
    $index += 1
  }
}

function Get-RealTourCoverImages([string]$TourId) {
  $headers = New-BasicAuthHeader -User $session.UserId -Password $session.Token
  $currentUri = "https://api.komoot.de/v007/tours/${TourId}/cover_images/"
  $items = @()

  while ($currentUri) {
    $response = Invoke-KomootApi -Url $currentUri -Headers $headers
    $pageItems = @($response._embedded.items)
    $items += $pageItems
    if ($DebugLog) {
      Write-DebugLog "cover_images page loaded: $(@($pageItems).Count) item(s) for tour $TourId" "OK"
      Write-CoverImageDebug $pageItems
    }

    if ($response._links.next.href) {
      $currentUri = $response._links.next.href
    } else {
      $currentUri = $null
    }
  }

  $items
}

function Get-CoverImagePhotoCandidates($CoverImages) {
  $candidates = @()
  foreach ($item in @($CoverImages)) {
    $src = $item.src
    if ($src -isnot [string] -or [string]::IsNullOrWhiteSpace($src)) {
      continue
    }

    $candidates += @{
      url = $src
      title = Get-FirstNonEmptyText @($item.title, $item.caption, $item.name)
      caption = Get-FirstNonEmptyText @($item.caption, $item.name)
      createdAt = if ($item.created_at) { [string]$item.created_at } else { $null }
      attribution = if ($item.attribution) { [string]$item.attribution } else { $null }
      attributionUrl = if ($item.attribution_url) { [string]$item.attribution_url } else { $null }
      widthPx = if ($item.width_px) { [int]$item.width_px } else { $null }
      heightPx = if ($item.height_px) { [int]$item.height_px } else { $null }
      type = if ($item.type) { [string]$item.type } else { $null }
      id = if ($item.id) { [string]$item.id } else { $null }
      location = $item.location
      lineLocation = $item.line_location
      raw = $item
    }
  }

  $candidates
}

function Copy-Headers([hashtable]$Headers = @{}) {
  $copy = @{}
  foreach ($key in $Headers.Keys) {
    $copy[$key] = $Headers[$key]
  }
  $copy
}

function Expand-PhotoCandidateUrl([string]$Url) {
  if ([string]::IsNullOrWhiteSpace($Url)) {
    return $null
  }

  $value = $Url.Trim()
  $value = $value.Replace('{width}', '960').Replace('{height}', '720').Replace('{crop}', 'true')
  if ($value -match 'api\.komoot\.de\/v\d+\/tours\/[^/]+\/(translations|tour_line|timeline|details|faqs)\/?$') {
    return $null
  }
  $value
}

function Invoke-KomootBinary([string]$Url, [hashtable]$Headers = @{}) {
  Write-DebugLog "Upstream BINARY GET $Url"
  try {
    $response = Invoke-WebRequest -Uri $Url -Headers $Headers -Method Get -MaximumRedirection 5 -UseBasicParsing
    Write-DebugLog "Upstream BINARY OK $Url" "OK"
    return $response
  } catch {
    Write-DebugLog "Upstream BINARY failed for $Url :: $($_.Exception.Message)" "WARN"
    return $null
  }
}

function Convert-ResponseToInlinePhoto($Response, [string]$Title = $null) {
  if ($null -eq $Response) {
    return $null
  }

  $contentType = [string]$Response.Headers['Content-Type']
  if ([string]::IsNullOrWhiteSpace($contentType) -or $contentType -notmatch '^image\/') {
    return $null
  }

  $stream = [System.IO.MemoryStream]::new()
  try {
    $Response.RawContentStream.CopyTo($stream)
    $bytes = $stream.ToArray()
  } finally {
    $stream.Dispose()
  }

  if (-not $bytes.Length) {
    return $null
  }

  @{
    url = "data:$contentType;base64,$([Convert]::ToBase64String($bytes))"
    title = if ([string]::IsNullOrWhiteSpace($Title)) { $null } else { $Title.Trim() }
  }
}

function Copy-PhotoCandidateMetadata($Photo, $Candidate, [string]$ResolvedUrl = $null) {
  if ($null -eq $Photo -or $null -eq $Candidate) {
    return $Photo
  }

  if (-not [string]::IsNullOrWhiteSpace($ResolvedUrl)) {
    $Photo.sourceUrl = $ResolvedUrl
  }
  if ($Candidate.ContainsKey('caption')) { $Photo.caption = $Candidate.caption }
  if ($Candidate.ContainsKey('createdAt')) { $Photo.createdAt = $Candidate.createdAt }
  if ($Candidate.ContainsKey('attribution')) { $Photo.attribution = $Candidate.attribution }
  if ($Candidate.ContainsKey('attributionUrl')) { $Photo.attributionUrl = $Candidate.attributionUrl }
  if ($Candidate.ContainsKey('widthPx')) { $Photo.widthPx = $Candidate.widthPx }
  if ($Candidate.ContainsKey('heightPx')) { $Photo.heightPx = $Candidate.heightPx }
  if ($Candidate.ContainsKey('type')) { $Photo.type = $Candidate.type }
  if ($Candidate.ContainsKey('id')) { $Photo.id = $Candidate.id }
  if ($Candidate.ContainsKey('location')) { $Photo.location = $Candidate.location }
  if ($Candidate.ContainsKey('lineLocation')) { $Photo.lineLocation = $Candidate.lineLocation }
  if ($Candidate.ContainsKey('raw')) { $Photo.raw = $Candidate.raw }
  $Photo
}

function Resolve-PhotoCandidate($Candidate, [hashtable]$Headers = @{}) {
  if ($null -eq $Candidate) {
    return $null
  }

  $photoUrl = Expand-PhotoCandidateUrl $Candidate.url
  if (-not $photoUrl) {
    return $null
  }

  $requestHeaders = if ($photoUrl -match '^https?:\/\/api\.komoot\.de\/') { Copy-Headers $Headers } else { @{} }
  $response = Invoke-KomootBinary -Url $photoUrl -Headers $requestHeaders
  $photo = Convert-ResponseToInlinePhoto -Response $response -Title $Candidate.title
  if ($null -eq $photo) {
    $photo = @{
      url = $photoUrl
      sourceUrl = $photoUrl
      title = if ([string]::IsNullOrWhiteSpace($Candidate.title)) { $null } else { $Candidate.title.Trim() }
      loadError = "inline-fetch-failed"
    }
  } else {
    $photo.inlineLoaded = $true
  }

  Copy-PhotoCandidateMetadata -Photo $photo -Candidate $Candidate -ResolvedUrl $photoUrl
}

function Get-InlineTourPhotosFromCandidates($Candidates, [hashtable]$Headers = @{}) {
  $resolvedPhotos = @()
  $seen = @{}

  foreach ($candidate in @($Candidates)) {
    $photoUrl = Expand-PhotoCandidateUrl $candidate.url
    if (-not $photoUrl -or $seen.ContainsKey($photoUrl)) {
      continue
    }

    $seen[$photoUrl] = $true
    $photo = Resolve-PhotoCandidate -Candidate $candidate -Headers $Headers
    if ($null -eq $photo) {
      continue
    }

    $resolvedPhotos += $photo
  }

  $resolvedPhotos
}

function Get-DescriptionLocale([string]$Language = "en") {
  switch -Regex ($Language) {
    '^de' { return @{ Culture = 'de-DE'; Distance = 'Distanz'; Duration = 'Geschaetzte Dauer'; Up = 'Hoehenmeter bergauf'; Down = 'Hoehenmeter bergab' } }
    '^fr' { return @{ Culture = 'fr-FR'; Distance = 'Distance'; Duration = 'Duree estimee'; Up = 'Denivele positif'; Down = 'Denivele negatif' } }
    default { return @{ Culture = 'en-US'; Distance = 'Distance'; Duration = 'Estimated duration'; Up = 'Elevation up'; Down = 'Elevation down' } }
  }
}

function Get-TourDescription($Tour, [string]$Language = "en") {
  $locale = Get-DescriptionLocale $Language
  $culture = [System.Globalization.CultureInfo]::GetCultureInfo($locale.Culture)
  $distanceKm = ([double]($Tour.distance / 1000)).ToString('F2', $culture)
  $durationHours = ([double]($Tour.duration / 3600)).ToString('F2', $culture)
  $elevationUp = ([math]::Round([double]$Tour.elevation_up, 0)).ToString('F0', $culture)
  $elevationDown = ([math]::Round([double]$Tour.elevation_down, 0)).ToString('F0', $culture)
  $fallback = "{0}: {1} km, {2}: {3} h, {4}: {5} m, {6}: {7} m" -f `
    $locale.Distance, `
    $distanceKm, `
    $locale.Duration, `
    $durationHours, `
    $locale.Up, `
    $elevationUp, `
    $locale.Down, `
    $elevationDown
  Get-FirstNonEmptyText @($Tour.description, $Tour.subtitle, $Tour.summary, $fallback)
}

function Format-TrackPointsXml($Items) {
  ($Items | ForEach-Object {
    $lat = $_.lat
    $lng = $_.lng
    $alt = $_.alt
    $time = $_.t
    $parts = @("<trkpt lat=""$lat"" lon=""$lng"">")
    if ($null -ne $alt) {
      $parts += "<ele>$alt</ele>"
    }
    if ($null -ne $time) {
      $epochValue = [int64]$time
      if ([math]::Abs($epochValue) -lt 100000000000) {
        $parts += "<time>$([DateTimeOffset]::FromUnixTimeSeconds($epochValue).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))</time>"
      } else {
        $parts += "<time>$([DateTimeOffset]::FromUnixTimeMilliseconds($epochValue).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))</time>"
      }
    }
    $parts += "</trkpt>"
    $parts -join ""
  }) -join "`n      "
}

function Convert-TourToGpx($Tour, [string]$Language = "en") {
  $title = Escape-Xml $Tour.name
  $description = Escape-Xml (Get-TourDescription $Tour $Language)
  $creatorName = Escape-Xml $Tour._embedded.creator.display_name
  $creatorUser = Escape-Xml ([string]$Tour._embedded.creator.username)
  $tourLink = "https://www.komoot.de/tour/$($Tour.id)"
  $trackPoints = Format-TrackPointsXml $Tour._embedded.coordinates.items

  @"
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailCanvas Komoot Proxy" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>$title</name>
    <desc>$description</desc>
    <author>
      <name>$creatorName</name>
      <link href="https://www.komoot.de/user/$creatorUser">
        <text>Komoot profile</text>
      </link>
    </author>
    <link href="$tourLink">
      <text>Komoot tour</text>
    </link>
  </metadata>
  <trk>
    <name>$title</name>
    <desc>$description</desc>
    <trkseg>
      $trackPoints
    </trkseg>
  </trk>
</gpx>
"@
}

function Convert-RealTourSummary($Tour) {
  @{
    id = [string]$Tour.id
    name = $Tour.name
    sport = $Tour.sport
    type = $Tour.type
    distanceKm = [math]::Round(($Tour.distance / 1000), 1)
    date = if ($Tour.date) { ([datetimeoffset]$Tour.date).ToString("yyyy-MM-dd") } else { $null }
  }
}

function Login-RealKomoot([string]$Email, [string]$Password) {
  $loginUrl = "https://api.komoot.de/v006/account/email/$Email/"
  $response = Invoke-KomootApi -Url $loginUrl -Headers (New-BasicAuthHeader -User $Email -Password $Password)
  $session.LoggedIn = $true
  $session.UserId = [string]$response.username
  $session.Token = [string]$response.password
  $session.User = @{
    id = [string]$response.username
    name = $response.user.displayname
    email = $Email
  }
  $session.User
}

function Get-RealTourMap {
  if (-not $session.LoggedIn) {
    throw "Not logged in"
  }

  $headers = New-BasicAuthHeader -User $session.UserId -Password $session.Token
  $currentUri = "https://api.komoot.de/v007/users/$($session.UserId)/tours/"
  $results = @{}

  while ($currentUri) {
    $response = Invoke-KomootApi -Url $currentUri -Headers $headers
    foreach ($tour in $response._embedded.tours) {
      $results[[string]$tour.id] = $tour
    }
    if ($response._links.next.href) {
      $currentUri = $response._links.next.href
    } else {
      $currentUri = $null
    }
  }

  $results
}

function Get-RealTourDetail([string]$TourId, [string]$Language = "en") {
  $headers = New-BasicAuthHeader -User $session.UserId -Password $session.Token
  $url = "https://api.komoot.de/v007/tours/${TourId}?_embedded=coordinates,way_types,surfaces,directions,participants,timeline&hl=$Language&directions=v2&fields=timeline&format=coordinate_array&timeline_highlights_fields=tips,recommenders"
  Invoke-KomootApi -Url $url -Headers $headers
}

function Get-KomootObjectProperty($InputObject, [string]$Name) {
  if ($null -eq $InputObject) {
    return $null
  }
  if ($InputObject -is [hashtable]) {
    if ($InputObject.ContainsKey($Name)) {
      return $InputObject[$Name]
    }
    return $null
  }
  $property = $InputObject.PSObject.Properties[$Name]
  if ($property) {
    return $property.Value
  }
  $null
}

function Get-KomootEmbeddedItems($Value) {
  if ($null -eq $Value) {
    return @()
  }
  if ($Value -is [string]) {
    return @($Value)
  }
  if ($Value -is [hashtable] -or $Value.PSObject.Properties.Count -gt 0) {
    foreach ($key in @('items', 'segments', 'elements', 'results', 'values', 'data', 'collection')) {
      $nested = Get-KomootObjectProperty -InputObject $Value -Name $key
      if ($null -ne $nested) {
        return @(Get-KomootEmbeddedItems $nested)
      }
    }
    if ((Get-KomootObjectProperty -InputObject $Value -Name 'name') -or (Get-KomootObjectProperty -InputObject $Value -Name 'type') -or (Get-KomootObjectProperty -InputObject $Value -Name 'instruction') -or $null -ne (Get-KomootObjectProperty -InputObject $Value -Name 'distance') -or $null -ne (Get-KomootObjectProperty -InputObject $Value -Name 'segment_length')) {
      return @($Value)
    }
  }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @()
    foreach ($entry in $Value) {
      $items += @(Get-KomootEmbeddedItems $entry)
    }
    return $items
  }
  @($Value)
}

function Get-DemoGpx([string]$TourId, [string]$TourName) {
  $routes = @{
    "komoot-demo-1" = @(@{ lat = 48.1402; lng = 11.5568 }, @{ lat = 48.1376; lng = 11.5659 }, @{ lat = 48.1343; lng = 11.5748 }, @{ lat = 48.1287; lng = 11.5814 }, @{ lat = 48.1221; lng = 11.5872 })
    "komoot-demo-2" = @(@{ lat = 48.0331; lng = 7.2833 }, @{ lat = 48.0365; lng = 7.2902 }, @{ lat = 48.0408; lng = 7.2967 }, @{ lat = 48.0433; lng = 7.3049 }, @{ lat = 48.0462; lng = 7.3114 })
    "komoot-demo-3" = @(@{ lat = 47.6881; lng = 9.1885 }, @{ lat = 47.6842; lng = 9.2011 }, @{ lat = 47.6787; lng = 9.2174 }, @{ lat = 47.6711; lng = 9.2288 }, @{ lat = 47.6643; lng = 9.2412 })
  }
  $points = $routes[$TourId]
  if (-not $points) {
    $points = @(@{ lat = 51.0; lng = 10.0 }, @{ lat = 51.02; lng = 10.03 }, @{ lat = 51.05; lng = 10.08 })
  }
  $trackPoints = Format-TrackPointsXml $points
  $safeTitle = Escape-Xml $TourName
  $safeDescription = Escape-Xml ((@($demoTours | Where-Object { $_.id -eq $TourId })[0]).description)
  @"
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailCanvas Komoot Stub" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>$safeTitle</name>
    <desc>$safeDescription</desc>
  </metadata>
  <trk>
    <name>$safeTitle</name>
    <desc>$safeDescription</desc>
    <trkseg>
      $trackPoints
    </trkseg>
  </trk>
</gpx>
"@
}

function Ensure-LoggedIn {
  if (-not $session.LoggedIn) {
    throw "Not logged in"
  }
}

Write-Host "TrailCanvas Komoot Proxy laeuft auf http://localhost:$Port/ (mode: $Mode)"
Write-Host "Zum Beenden Strg+C druecken."
if ($DebugLog) {
  Write-Host "Debug-Logging ist aktiviert." -ForegroundColor Yellow
}

try {
  while ($listener.IsListening -and -not $script:ShouldStop) {
    $contextTask = $listener.GetContextAsync()
    while (-not $contextTask.Wait(250)) {
      if ($script:ShouldStop -or -not $listener.IsListening) {
        break
      }
    }

    if ($script:ShouldStop -or -not $listener.IsListening) {
      break
    }

    $context = $contextTask.Result
    $request = $context.Request
    $path = $request.Url.AbsolutePath.TrimEnd("/")
    Write-DebugLog "Incoming $($request.HttpMethod) $path"

    if ($request.HttpMethod -eq "OPTIONS") {
      Write-JsonResponse $context @{ ok = $true; mode = $Mode }
      continue
    }

    try {
      switch ($path) {
        "/api/komoot/health" {
          Write-DebugLog "Route: health"
          Write-JsonResponse $context @{
            ok = $true
            mode = $Mode
            running = $true
            serverTime = (Get-Date).ToUniversalTime().ToString("o")
          }
          continue
        }

        "/api/komoot/status" {
          Write-DebugLog "Route: status (loggedIn=$($session.LoggedIn), mode=$Mode)"
          Write-JsonResponse $context @{
            ok = $true
            mode = $Mode
            loggedIn = $session.LoggedIn
            user = $session.User
          }
          continue
        }

        "/api/komoot/login" {
          Write-DebugLog "Route: login"
          $bodyText = Read-BodyText $request
          $body = if ($bodyText) { $bodyText | ConvertFrom-Json } else { $null }
          if (-not $body.email -or -not $body.password) {
            throw "Email and password are required"
          }
          Write-DebugLog "Login attempt for $($body.email) using mode=$Mode"

          if ($Mode -eq "stub") {
            $session.LoggedIn = $true
            $session.UserId = "stub-user-1"
            $session.Token = "stub-token"
            $session.User = @{
              id = "stub-user-1"
              name = ($body.email -split "@")[0]
              email = $body.email
            }
          } else {
            Login-RealKomoot -Email $body.email -Password $body.password | Out-Null
          }

          Write-DebugLog "Login successful for $($session.User.email)" "OK"
          Write-JsonResponse $context @{
            ok = $true
            mode = $Mode
            user = $session.User
          }
          continue
        }

        "/api/komoot/logout" {
          Write-DebugLog "Route: logout"
          $session.LoggedIn = $false
          $session.UserId = $null
          $session.Token = $null
          $session.User = $null
          Write-JsonResponse $context @{
            ok = $true
            mode = $Mode
          }
          continue
        }

        "/api/komoot/tours" {
          Write-DebugLog "Route: tours"
          Ensure-LoggedIn
          if ($Mode -eq "stub") {
            $tours = $demoTours
          } else {
            $tours = @(Get-RealTourMap).Values | ForEach-Object { Convert-RealTourSummary $_ } | Sort-Object date -Descending
          }
          Write-DebugLog "Tours loaded: $(@($tours).Count)" "OK"
          Write-JsonResponse $context @{
            ok = $true
            mode = $Mode
            tours = $tours
          }
          continue
        }

        "/api/komoot/import" {
          Write-DebugLog "Route: import"
          Ensure-LoggedIn
          $bodyText = Read-BodyText $request
          $body = if ($bodyText) { $bodyText | ConvertFrom-Json } else { $null }
          $tourIds = @($body.tourIds)
          $language = if ($body.language) { [string]$body.language } else { "en" }
          $items = @()
          Write-DebugLog "Import requested for $(@($tourIds).Count) tour(s), language=$language"

          if ($Mode -eq "stub") {
            $selected = @($demoTours | Where-Object { $tourIds -contains $_.id })
            foreach ($tour in $selected) {
              $items += @{
                id = $tour.id
                fileName = "$($tour.name)-$($tour.id).gpx"
                gpx = Get-DemoGpx -TourId $tour.id -TourName $tour.name
                description = $tour.description
                photos = $tour.photos
                dateStart = $tour.date
                durationHours = $null
                sport = $tour.sport
                surfaces = @()
                wayTypes = @()
              }
            }
          } else {
            foreach ($tourId in $tourIds) {
              Write-DebugLog "Loading tour detail for $tourId"
              $tour = Get-RealTourDetail -TourId ([string]$tourId) -Language $language
              $headers = New-BasicAuthHeader -User $session.UserId -Password $session.Token
              $coverImages = @(Get-RealTourCoverImages -TourId ([string]$tourId))
              $photoCandidates = @(Get-CoverImagePhotoCandidates $coverImages)
              $surfaceItems = @(Get-KomootEmbeddedItems $tour._embedded.surfaces)
              $wayTypeItems = @(Get-KomootEmbeddedItems $tour._embedded.way_types)
              $directionItems = @(Get-KomootEmbeddedItems $tour._embedded.directions)
              $items += @{
                id = [string]$tour.id
                fileName = "$($tour.name)-$($tour.id).gpx"
                gpx = Convert-TourToGpx -Tour $tour -Language $language
                description = Get-TourDescription $tour $language
                photos = @(Get-InlineTourPhotosFromCandidates -Candidates $photoCandidates -Headers $headers)
                dateStart = if ($tour.date) { ([datetimeoffset]$tour.date).ToString("yyyy-MM-dd") } else { $null }
                durationHours = if ($tour.duration) { [math]::Round(([double]$tour.duration / 3600), 1) } else { $null }
                sport = $tour.sport
                surfaces = @($surfaceItems | ForEach-Object { if ($_ -is [string]) { $_ } elseif ($_.name) { $_.name } elseif ($_.type) { $_.type } })
                wayTypes = @($wayTypeItems | ForEach-Object { if ($_ -is [string]) { $_ } elseif ($_.name) { $_.name } elseif ($_.type) { $_.type } })
                directions = @($directionItems | ForEach-Object {
                  @{
                    instruction = if ($_.instruction) { [string]$_.instruction } elseif ($_.text) { [string]$_.text } elseif ($_.name) { [string]$_.name } elseif ($_.title) { [string]$_.title } else { $null }
                    distanceM = if ($null -ne $_.distance) { [double]$_.distance } elseif ($null -ne $_.segment_length) { [double]$_.segment_length } elseif ($null -ne $_.length) { [double]$_.length } else { $null }
                    type = if ($_.type) { [string]$_.type } elseif ($_._type) { [string]$_._type } elseif ($_.icon) { [string]$_.icon } else { $null }
                  }
                })
              }
              if (-not $surfaceItems.Count) {
                Write-DebugLog "Tour $($tour.id) returned no surfaces from Komoot" "INFO"
              } else {
                Write-DebugLog "Tour $($tour.id) surfaces: $($surfaceItems.Count) item(s)" "INFO"
              }
              if (-not $wayTypeItems.Count) {
                Write-DebugLog "Tour $($tour.id) returned no way_types from Komoot" "INFO"
              } else {
                Write-DebugLog "Tour $($tour.id) way_types: $($wayTypeItems.Count) item(s)" "INFO"
              }
              if (-not $directionItems.Count) {
                Write-DebugLog "Tour $($tour.id) returned no directions from Komoot" "INFO"
              } else {
                Write-DebugLog "Tour $($tour.id) directions: $($directionItems.Count) item(s)" "INFO"
              }
            }
          }

          Write-DebugLog "Import generated $(@($items).Count) GPX item(s)" "OK"
          Write-JsonResponse $context @{
            ok = $true
            mode = $Mode
            items = $items
          }
          continue
        }

        "/api/komoot/photo-inline" {
          Write-DebugLog "Route: photo-inline"
          $bodyText = Read-BodyText $request
          $body = if ($bodyText) { $bodyText | ConvertFrom-Json } else { $null }
          $headers = if ($session.LoggedIn) { New-BasicAuthHeader -User $session.UserId -Password $session.Token } else { @{} }
          $items = @()
          foreach ($photo in @($body.photos)) {
            $candidate = @{
              url = [string]$photo.url
              title = if ($photo.title) { [string]$photo.title } else { $null }
              caption = if ($photo.caption) { [string]$photo.caption } else { $null }
              createdAt = if ($photo.createdAt) { [string]$photo.createdAt } else { $null }
              attribution = if ($photo.attribution) { [string]$photo.attribution } else { $null }
              attributionUrl = if ($photo.attributionUrl) { [string]$photo.attributionUrl } else { $null }
              widthPx = $photo.widthPx
              heightPx = $photo.heightPx
              type = if ($photo.type) { [string]$photo.type } else { $null }
              id = if ($photo.id) { [string]$photo.id } else { $null }
              location = $photo.location
              lineLocation = $photo.lineLocation
            }
            $resolved = Resolve-PhotoCandidate -Candidate $candidate -Headers $headers
            if ($null -ne $resolved) {
              $items += $resolved
            }
          }
          Write-JsonResponse $context @{
            ok = $true
            mode = $Mode
            items = $items
          }
          continue
        }

        default {
          Write-DebugLog "Route not found: $path" "WARN"
          Write-JsonResponse $context @{ ok = $false; mode = $Mode; error = "Not found" } 404
        }
      }
    } catch {
      $message = $_.Exception.Message
      $statusCode = if ($message -eq "Not logged in") { 401 } else { 500 }
      Write-DebugLog "Request failed on $path :: $message" "ERROR"
      if ($DebugLog -and $_.ScriptStackTrace) {
        Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
      }
      Write-JsonResponse $context @{
        ok = $false
        mode = $Mode
        error = $message
      } $statusCode
    }
  }
}
finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
  [Console]::remove_CancelKeyPress($cancelHandler)
}
