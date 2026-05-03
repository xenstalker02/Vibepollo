; Vibepollo Inno Setup Installer
; Version: 1.15.9
; Builds to: installer\output\Vibepollo-1.15.9-Setup.exe

#define MyAppName      "Vibepollo"
#define MyAppVersion   "1.15.9"
#define MyAppPublisher "xenstalker02"
#define MyAppURL       "https://github.com/xenstalker02/Vibepollo"
#define MyAppExeName   "sunshine.exe"
#define MyAppDataDir   "{localappdata}\Sunshine"

[Setup]
AppId={{A3F1B2C4-7D8E-4F9A-B1C2-D3E4F5A6B7C8}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir=output
OutputBaseFilename=Vibepollo-{#MyAppVersion}-Setup
SetupIconFile=..\vibepollo.ico
UninstallDisplayIcon={app}\sunshine.exe
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
MinVersion=10.0.17763
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=force
CloseApplicationsFilter=sunshine.exe
RestartApplications=no
UninstallDisplayName={#MyAppName} {#MyAppVersion}
DisableWelcomePage=no
DisableProgramGroupPage=auto
CreateUninstallRegKey=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Dirs]
Name: "{app}\config"; Flags: uninsneveruninstall
Name: "{app}\config\apps"
Name: "{app}\tools"
Name: "{app}\assets"
Name: "{app}\logs"; Flags: uninsneveruninstall
Name: "{app}\drivers"
Name: "{app}\drivers\sudovda"
Name: "{app}\plugins\SunshinePlaynite"

[Files]
; Main executable — kill any running instance before copy so the file is never locked
Source: "..\build\sunshine.exe";               DestDir: "{app}";             Flags: ignoreversion; BeforeInstall: StopVibepollo

; Required runtime DLLs
; zlib1.dll: loaded dynamically by OpenSSL/zlib at runtime — must sit next to sunshine.exe
Source: "C:\msys64\ucrt64\bin\zlib1.dll";     DestDir: "{app}";             Flags: ignoreversion
; D3DCOMPILER_47.dll: in the PE import table — process dies before main() if missing on Win10 N/KN or VMs
; Sourced from the build machine's System32; shipped so clean machines don't need a DirectX SDK install
Source: "C:\Windows\System32\D3DCOMPILER_47.dll"; DestDir: "{app}";         Flags: ignoreversion

; Tools (sunshinesvc.exe removed — ApolloService deprecated, binary no longer shipped)
Source: "..\build\tools\sunshine_display_helper.exe";  DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\sunshine_wgc_capture.exe";     DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\playnite-launcher.exe";        DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\dxgi-info.exe";                DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\audio-info.exe";               DestDir: "{app}\tools"; Flags: ignoreversion

; Web UI assets
Source: "..\build\assets\web\*"; DestDir: "{app}\assets\web"; Flags: ignoreversion recursesubdirs createallsubdirs

; apps.json — copied by config::parse into config/ on first run (SUNSHINE_ASSETS_DIR="assets", relative to exe dir)
Source: "..\src_assets\windows\assets\apps.json"; DestDir: "{app}\assets"; Flags: ignoreversion

; Shaders
Source: "..\src_assets\windows\assets\shaders\*"; DestDir: "{app}\assets\shaders"; Flags: ignoreversion recursesubdirs createallsubdirs

; SudoVDA virtual display driver
Source: "..\src_assets\windows\drivers\sudovda\SudoVDA.dll";  DestDir: "{app}\drivers\sudovda"; Flags: ignoreversion
Source: "..\src_assets\windows\drivers\sudovda\SudoVDA.inf";  DestDir: "{app}\drivers\sudovda"; Flags: ignoreversion
Source: "..\src_assets\windows\drivers\sudovda\sudovda.cat";  DestDir: "{app}\drivers\sudovda"; Flags: ignoreversion
Source: "..\src_assets\windows\drivers\sudovda\sudovda.cer";  DestDir: "{app}\drivers\sudovda"; Flags: ignoreversion
Source: "..\src_assets\windows\drivers\sudovda\nefconc.exe";  DestDir: "{app}\drivers\sudovda"; Flags: ignoreversion
Source: "..\src_assets\windows\drivers\sudovda\install.bat";  DestDir: "{app}\drivers\sudovda"; Flags: ignoreversion
Source: "..\src_assets\windows\drivers\sudovda\install.ps1";  DestDir: "{app}\drivers\sudovda"; Flags: ignoreversion
Source: "..\src_assets\windows\drivers\sudovda\uninstall.bat";DestDir: "{app}\drivers\sudovda"; Flags: ignoreversion

; Playnite plugin
Source: "..\plugins\playnite\SunshinePlaynite\*"; DestDir: "{app}\plugins\SunshinePlaynite"; Flags: ignoreversion recursesubdirs createallsubdirs

; Task registration helper — deployed to {tmp} only (auto-cleaned after install, never stale in Program Files)
Source: "setup-task.ps1";    DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall

; Default config (only install if no existing config)
Source: "sunshine_default.conf"; DestDir: "{app}\config"; DestName: "sunshine.conf"; Flags: onlyifdoesntexist uninsneveruninstall

; Default apps list (only install if no existing apps.json — preserves user's configured apps on upgrade)
Source: "..\src_assets\windows\assets\apps.json"; DestDir: "{app}\config"; DestName: "apps.json"; Flags: onlyifdoesntexist uninsneveruninstall

[Icons]
Name: "{group}\{#MyAppName}";              Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\sunshine.exe"
Name: "{group}\{#MyAppName} Web UI";       Filename: "https://localhost:47990"; IconFilename: "{app}\sunshine.exe"
Name: "{group}\Uninstall {#MyAppName}";    Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}";        Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\sunshine.exe"; Tasks: desktopicon

[Run]
; Stop legacy ApolloService (running as SYSTEM — must kill before file copy completes)
; These run under the installer's elevated context; -ErrorAction is irrelevant for sc/taskkill
; Stop the service controller first so it can't restart sunshine.exe mid-install
Filename: "sc.exe";      Parameters: "stop ApolloService";              Flags: runhidden; StatusMsg: "Stopping legacy service..."
Filename: "sc.exe";      Parameters: "config ApolloService start= disabled"; Flags: runhidden; StatusMsg: "Disabling legacy service..."
Filename: "taskkill.exe"; Parameters: "/f /im sunshinesvc.exe";         Flags: runhidden; StatusMsg: "Stopping service wrapper..."
Filename: "taskkill.exe"; Parameters: "/f /im sunshine.exe";            Flags: runhidden; StatusMsg: "Stopping Vibepollo..."

; Add firewall rules
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""Vibepollo TCP"" protocol=TCP dir=in localport=47984,47989,47990 action=allow"; Flags: runhidden; StatusMsg: "Configuring firewall (TCP)..."
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""Vibepollo UDP"" protocol=UDP dir=in localport=47998-48010 action=allow"; Flags: runhidden; StatusMsg: "Configuring firewall (UDP)..."

; Register Task Scheduler autostart (30s delay, HIGHEST privilege)
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NonInteractive -File ""{tmp}\setup-task.ps1"" -AppPath ""{app}"""; Flags: runhidden; StatusMsg: "Registering autostart task..."

; Launch via Task Scheduler task after install (interactive and silent/auto-update alike).
; schtasks /run uses the task's HIGHEST RunLevel — no extra UAC prompt.
; NOTE: skipifsilent intentionally removed from the schtasks step so auto-update silent
; installs also restart Vibepollo. skipifsilent remains on the browser step so the web UI
; does not pop open on every auto-update.
Filename: "schtasks.exe"; Parameters: "/run /tn ""Vibepollo"""; Flags: runhidden nowait postinstall; Description: "Launch {#MyAppName}"
Filename: "https://localhost:47990"; Flags: shellexec nowait postinstall skipifsilent; Description: "Open {#MyAppName} Web UI"

[UninstallRun]
; Kill sunshine.exe if running
Filename: "powershell.exe"; Parameters: "-Command ""Stop-Process -Name sunshine -Force -ErrorAction SilentlyContinue"""; Flags: runhidden; RunOnceId: "KillSunshine"
Filename: "powershell.exe"; Parameters: "-Command ""Stop-Process -Name sunshinesvc -Force -ErrorAction SilentlyContinue"""; Flags: runhidden; RunOnceId: "KillSvc"

; Remove Task Scheduler task
Filename: "powershell.exe"; Parameters: "-Command ""Unregister-ScheduledTask -TaskName Vibepollo -Confirm:$false -ErrorAction SilentlyContinue"""; Flags: runhidden; RunOnceId: "RemoveTask"

; Remove legacy ApolloService if still present
Filename: "sc.exe"; Parameters: "stop ApolloService";   Flags: runhidden; RunOnceId: "StopApolloSvc"
Filename: "sc.exe"; Parameters: "delete ApolloService"; Flags: runhidden; RunOnceId: "DeleteApolloSvc"

; Remove firewall rules
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""Vibepollo TCP"""; Flags: runhidden; RunOnceId: "DelFirewallTCP"
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""Vibepollo UDP"""; Flags: runhidden; RunOnceId: "DelFirewallUDP"

[Code]
// Kill any running sunshine.exe before the file copy attempt.
// CloseApplications=force uses the Restart Manager API which can fail to close
// Task Scheduler-launched elevated processes. This explicit kill runs at the exact
// moment before the binary is overwritten, guaranteeing the file is never locked.
procedure StopVibepollo();
var
  ResultCode: Integer;
begin
  Exec('taskkill.exe', '/f /im sunshine.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // Brief pause so the OS releases the file handle before the copy starts.
  Sleep(1500);
end;

// Runtime prerequisite check.
//
// NOTE: Vibepollo is built with MSYS2 UCRT64, NOT the MSVC toolchain.
// It therefore does NOT need vc_redist.x64.exe (VCRUNTIME140.dll etc.).
// It does depend on the Windows Universal CRT (ucrtbase.dll), which is
// built into Windows 10 1809+ — satisfied by MinVersion=10.0.17763 above.
// This check is a belt-and-suspenders guard for heavily stripped images.
function CheckUCRT(): Boolean;
begin
  Result := FileExists(ExpandConstant('{sys}\ucrtbase.dll'));
  if not Result then
    MsgBox(
      'The Windows Universal C Runtime (ucrtbase.dll) was not found in System32.' + #13#10 +
      'Vibepollo requires the UCRT, which is normally included with Windows 10.' + #13#10#13#10 +
      'Please install Windows Update KB2999226 or run Windows Update, then retry.',
      mbError, MB_OK);
end;

// Prevent downgrade: check existing installed version
function InitializeSetup(): Boolean;
var
  InstalledVer: String;
begin
  // Fail fast if UCRT is absent
  if not CheckUCRT() then
  begin
    Result := False;
    Exit;
  end;

  Result := True;
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{A3F1B2C4-7D8E-4F9A-B1C2-D3E4F5A6B7C8}_is1',
    'DisplayVersion', InstalledVer) then
  begin
    // Allow reinstall / upgrade — only prompt in interactive mode
    // Silent/auto-update installs must never block on a dialog
    if InstalledVer = '{#MyAppVersion}' then
    begin
      if (not WizardSilent()) then
        if MsgBox('Vibepollo ' + InstalledVer + ' is already installed. Reinstall?',
          mbConfirmation, MB_YESNO) = IDNO then
          Result := False;
    end;
  end;
end;

// Remind user to reboot if SudoVDA driver was freshly installed
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // No mandatory reboot — sunshine.exe initialises SudoVDA at first run
  end;
end;
