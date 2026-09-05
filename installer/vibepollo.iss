; Vibepollo Inno Setup Installer
; Bump MyAppVersion below in lockstep with CMakeLists.txt; the output filename derives
; from it (installer\output\Vibepollo-<MyAppVersion>-Setup.exe).

#define MyAppName      "Vibepollo"
#define MyAppVersion   "1.15.32"
#define MyAppPublisher "xenstalker02"
#define MyAppURL       "https://github.com/xenstalker02/Vibepollo"
#define MyAppExeName   "sunshine.exe"
#define MyAppDataDir   "{localappdata}\Sunshine"

; --- Bundled driver artifacts: refuse to build on placeholder stubs ---------------
; sunshine.exe runs drivers\sudovda\install.ps1 on demand (virtual_display.cpp) and that
; script requires both binaries below. Placeholder stubs shipped unnoticed for months
; because nothing validated them on this path: the CMake guard in
; cmake/packaging/windows.cmake only runs for CPack builds, and Inno Setup is what we
; actually release with. Fail the compile instead of packaging a broken driver.
; Provenance, hashes and expected signers: src_assets\windows\drivers\sudovda\PROVENANCE.md
#define SudoVdaDir       "..\src_assets\windows\drivers\sudovda"
#define MinDriverBytes   4096

#if !FileExists(SudoVdaDir + "\SudoVDA.dll")
  #error Driver artifact missing: SudoVDA.dll -- it is untracked by design; see src_assets\windows\drivers\sudovda\PROVENANCE.md
#endif
#if FileSize(SudoVdaDir + "\SudoVDA.dll") < MinDriverBytes
  #error Driver artifact SudoVDA.dll is a placeholder stub, not the real driver -- see src_assets\windows\drivers\sudovda\PROVENANCE.md
#endif
#if !FileExists(SudoVdaDir + "\nefconc.exe")
  #error Driver artifact missing: nefconc.exe -- see src_assets\windows\drivers\sudovda\PROVENANCE.md
#endif
#if FileSize(SudoVdaDir + "\nefconc.exe") < MinDriverBytes
  #error Driver artifact nefconc.exe is a placeholder stub, not the real binary -- see src_assets\windows\drivers\sudovda\PROVENANCE.md
#endif

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
WizardImageFile=images\wizard-sidebar.bmp
WizardSmallImageFile=images\wizard-header.bmp
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

; Tools
Source: "..\build\tools\sunshinesvc.exe";             DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\sunshine_display_helper.exe";  DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\sunshine_wgc_capture.exe";     DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\playnite-launcher.exe";        DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\dxgi-info.exe";                DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\build\tools\audio-info.exe";               DestDir: "{app}\tools"; Flags: ignoreversion

Source: "configure-firewall.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion

; Web UI assets
Source: "..\build\assets\web\*"; DestDir: "{app}\assets\web"; Flags: ignoreversion recursesubdirs createallsubdirs

; apps.json — copied by config::parse into config/ on first run (SUNSHINE_ASSETS_DIR="assets", relative to exe dir)
Source: "..\src_assets\windows\assets\apps.json"; DestDir: "{app}\assets"; Flags: ignoreversion

; Default app cover art — desktop.png, steam.png, virtual_desktop.png, box.png, etc.
; Served by sunshine via SUNSHINE_ASSETS_DIR for the /appasset endpoint.
; Missing from install = grey boxes in Moonlight/Vibelight app list.
Source: "..\src_assets\common\assets\*.png"; DestDir: "{app}\assets"; Flags: ignoreversion

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

; Default config (only install if no existing config)
Source: "sunshine_default.conf"; DestDir: "{app}\config"; DestName: "sunshine.conf"; Flags: onlyifdoesntexist uninsneveruninstall

; Default apps list (only install if no existing apps.json — preserves user's configured apps on upgrade)
Source: "..\src_assets\windows\assets\apps.json"; DestDir: "{app}\config"; DestName: "apps.json"; Flags: onlyifdoesntexist uninsneveruninstall

[Icons]
Name: "{group}\{#MyAppName}";              Filename: "{app}\{#MyAppExeName}"; Parameters: "--shortcut"; WorkingDir: "{app}"; IconFilename: "{app}\sunshine.exe"
Name: "{group}\{#MyAppName} Web UI";       Filename: "https://localhost:47990"; IconFilename: "{app}\sunshine.exe"
Name: "{group}\Uninstall {#MyAppName}";    Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}";        Filename: "{app}\{#MyAppExeName}"; Parameters: "--shortcut"; WorkingDir: "{app}"; IconFilename: "{app}\sunshine.exe"; Tasks: desktopicon

[InstallDelete]
; Removed watchdog.vbs left this legacy shortcut calling a missing script at login.
Type: files; Name: "{userstartup}\Vibepollo.lnk"

[Run]
; Remove legacy launch paths before enabling the supported LocalSystem service.
Filename: "sc.exe";      Parameters: "stop ApolloService";              Flags: runhidden; StatusMsg: "Stopping legacy service..."
Filename: "sc.exe";      Parameters: "config ApolloService start= disabled"; Flags: runhidden; StatusMsg: "Disabling legacy service..."
Filename: "schtasks.exe"; Parameters: "/delete /tn ""Vibepollo"" /f"; Flags: runhidden; StatusMsg: "Removing legacy autostart task..."

; Firewall configuration is checked immediately before service installation.

; The wrapper runs as LocalSystem and launches Sunshine into the active console session.
; That token can follow the input desktop onto Winlogon/PIN, unlike an elevated user task.
Filename: "sc.exe"; Parameters: "create VibepollService binPath= ""{app}\tools\sunshinesvc.exe"" DisplayName= ""Vibepollo Service"" start= auto error= normal"; Flags: runhidden; StatusMsg: "Installing Vibepollo service..."; Check: EnsureVibepolloFirewall
Filename: "sc.exe"; Parameters: "config VibepollService binPath= ""{app}\tools\sunshinesvc.exe"" DisplayName= ""Vibepollo Service"" start= auto error= normal"; Flags: runhidden; StatusMsg: "Configuring Vibepollo service..."; Check: EnsureVibepolloFirewall
Filename: "sc.exe"; Parameters: "failure VibepollService reset= 86400 actions= restart/3000/restart/10000/none/0"; Flags: runhidden; StatusMsg: "Configuring service recovery..."; Check: EnsureVibepolloFirewall
Filename: "sc.exe"; Parameters: "failureflag VibepollService 1"; Flags: runhidden; Check: EnsureVibepolloFirewall
Filename: "sc.exe"; Parameters: "start VibepollService"; Flags: runhidden; StatusMsg: "Starting Vibepollo..."; Check: EnsureVibepolloFirewall
Filename: "https://localhost:47990"; Flags: shellexec nowait postinstall skipifsilent; Description: "Open {#MyAppName} Web UI"; Check: EnsureVibepolloFirewall

[UninstallRun]
; Stop and remove the service before deleting its binaries.
Filename: "sc.exe"; Parameters: "stop VibepollService";   Flags: runhidden; RunOnceId: "StopVibepollSvc"
Filename: "sc.exe"; Parameters: "delete VibepollService"; Flags: runhidden; RunOnceId: "DeleteVibepollSvc"
Filename: "taskkill.exe"; Parameters: "/f /im sunshine.exe";    Flags: runhidden; RunOnceId: "KillSunshine"
Filename: "taskkill.exe"; Parameters: "/f /im sunshinesvc.exe"; Flags: runhidden; RunOnceId: "KillSvc"

; Remove Task Scheduler task
Filename: "powershell.exe"; Parameters: "-Command ""Unregister-ScheduledTask -TaskName Vibepollo -Confirm:$false -ErrorAction SilentlyContinue"""; Flags: runhidden; RunOnceId: "RemoveTask"

; Remove legacy ApolloService if still present
Filename: "sc.exe"; Parameters: "stop ApolloService";   Flags: runhidden; RunOnceId: "StopApolloSvc"
Filename: "sc.exe"; Parameters: "delete ApolloService"; Flags: runhidden; RunOnceId: "DeleteApolloSvc"

; Remove only recognized installer rules, preserving user-defined same-name rules.
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\tools\configure-firewall.ps1"" -Program ""{app}\sunshine.exe"" -Mode Remove"; Flags: runhidden; RunOnceId: "DelManagedFirewall"

[Code]
var
  FirewallAttempted: Boolean;
  FirewallConfigured: Boolean;

function EnsureVibepolloFirewall(): Boolean;
var
  ResultCode: Integer;
begin
  // Check functions may be evaluated repeatedly. Attempt the migration once;
  // a failure must keep every service/start/UI entry disabled for this run.
  if not FirewallAttempted then
  begin
    FirewallAttempted := True;
    ResultCode := -1;
    FirewallConfigured := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
      ExpandConstant('{app}\tools\configure-firewall.ps1') + '" -Program "' +
      ExpandConstant('{app}\sunshine.exe') + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    FirewallConfigured := FirewallConfigured and (ResultCode = 0);
    if not FirewallConfigured then
    begin
      Log('ERROR: Firewall configuration failed; service configuration/start and Web UI were skipped. Installer exit code will be nonzero.');
      if not WizardSilent() then
        MsgBox('Firewall configuration failed. Vibepollo was not started. Review installer-managed rules and rerun Setup. Installed files have not been rolled back.', mbError, MB_OK);
    end;
  end;
  Result := FirewallConfigured;
end;

function GetCustomSetupExitCode(): Integer;
begin
  Result := 0;
  if FirewallAttempted and not FirewallConfigured then
    Result := 1;
end;

// Kill any running sunshine.exe before the file copy attempt.
// CloseApplications=force uses the Restart Manager API which can fail to close
// Task Scheduler-launched elevated processes. This explicit kill runs at the exact
// moment before the binary is overwritten, guaranteeing the file is never locked.
procedure StopVibepollo();
var
  ResultCode: Integer;
begin
  Exec('sc.exe', 'stop VibepollService', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('schtasks.exe', '/end /tn "Vibepollo"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/f /im sunshinesvc.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
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
